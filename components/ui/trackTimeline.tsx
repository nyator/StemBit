import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { G, Line, Path, Rect } from "react-native-svg";

import { COLORS } from "../../constants/theme";
import type { CueSection } from "../../context/SessionsContext";
import type { TrackMix } from "../../context/SessionPlaybackContext";

// The arrange window: every stem on its own lane, against one ruler, under one
// playhead.
//
// The performance view shows the song as section pads and track tiles because
// on stage you are not reading, you are hitting. This is the other half of the
// job -- the part you do sitting down, before the gig, working out where the
// sections actually fall and what the arrangement is doing. For that the useful
// picture is the one every DAW draws: parts stacked in time, so you can see the
// drums drop out under the bridge instead of hunting for it by ear.
//
// Why one Svg for all the lanes rather than one per track: a component per lane
// re-measures and re-rasterises on every layout pass, and the whole point of
// this view is that it stays still while a playhead moves across it. The
// waveforms are drawn once into a memoised child; the playhead is an
// Animated.View on top, driven by an Animated.Value, so 16 position updates a
// second move a 2px bar and re-render nothing at all.
//
// Gestures are split by surface, which is the only way two of them fit on a
// phone without guessing at intent:
//
//   ruler / marker band   drag  -> move the playhead, or drag a marker
//   lanes                 drag  -> scroll the arrangement
//   anywhere              pinch -> zoom
//
// That is the desktop DAW arrangement (the ruler is where you scrub, the
// arrangement is where you navigate) and it means neither gesture has to wait
// to find out whether it was meant to be the other one.

const HEADER_WIDTH = 92;
const RULER_HEIGHT = 20;
const MARKER_HEIGHT = 22;
const LANE_HEIGHT = 52;
const LANE_GAP = 4;
// Wide enough to grab a marker flag with a fingertip, on either side of it.
const MARKER_TOUCH_WIDTH = 34;

/** Steps a bar grid is allowed to snap to, coarsest last. */
const BAR_STEPS = [1, 2, 4, 8, 16, 32, 64, 128];

// Zoom stops for the buttons. 1 is the whole song across the screen; 32 is
// about a bar and a half of a mid-tempo song, which is close enough to put a
// marker on the snare rather than near it.
const ZOOM_STOPS = [1, 2, 4, 8, 16, 32];
const MIN_ZOOM = ZOOM_STOPS[0];
const MAX_ZOOM = ZOOM_STOPS[ZOOM_STOPS.length - 1];

// Pinching reports a continuous scale, and every distinct value rebuilds four
// waveform paths. Rounded to this, a pinch across the whole range recomputes a
// couple of dozen times instead of once per frame, and the difference is not
// visible in the drawing.
const ZOOM_STEP = 0.25;

export type TimelineTrack = {
  id: string;
  name: string;
};

type TrackTimelineProps = {
  tracks: TimelineTrack[];
  /** One peak array per track id, from the engine. Missing means not measured yet. */
  peaks: Record<string, number[]>;
  /** Song length in seconds, for converting x to time. */
  duration: number;
  bpm: number;
  sections: CueSection[];
  mix: Record<string, TrackMix>;
  soloed: string | null;
  /**
   * The performance view's master mute, which silences everything without
   * touching a single track's own state.
   *
   * Passed in rather than left to that view because the two are the same song:
   * lanes drawn as sounding while the master is down would have the studio
   * disagreeing with what is actually coming out.
   */
  masterMuted?: boolean;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  /**
   * Where the audio has reached, in seconds, as an Animated.Value.
   *
   * A value rather than a number because this component would otherwise
   * re-render at the engine's report rate, and re-rendering a few hundred SVG
   * path points sixteen times a second is exactly the thing that makes a
   * timeline feel like it is dragging its feet.
   */
  playheadSeconds: Animated.Value;
  /** True while the transport runs, so a zoomed view can follow the playhead. */
  isPlaying: boolean;
  /** Where the transport will start from -- the line you drag. */
  cursorSeconds: number;
  /** Fires continuously through a drag, so the cursor tracks the finger. */
  onScrub: (seconds: number) => void;
  /** Fires once on release. Seek here, not on every frame. */
  onSeek: (seconds: number) => void;
  /**
   * One edge of a section was dragged along the ruler.
   *
   * Which edge is part of the event because a section is a span rather than a
   * point: its start and its end are grabbed separately, and the caller has to
   * know which one moved to keep them from crossing.
   */
  onMoveSection: (
    sectionId: string,
    seconds: number,
    edge: "start" | "end"
  ) => void;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string | null) => void;
  width: number;
};

export default function TrackTimeline({
  tracks,
  peaks,
  duration,
  bpm,
  sections,
  mix,
  soloed,
  masterMuted = false,
  onToggleMute,
  onToggleSolo,
  playheadSeconds,
  isPlaying,
  cursorSeconds,
  onScrub,
  onSeek,
  onMoveSection,
  selectedSectionId,
  onSelectSection,
  width,
}: TrackTimelineProps) {
  const laneWidth = Math.max(1, width - HEADER_WIDTH);
  const lanesHeight = tracks.length * (LANE_HEIGHT + LANE_GAP);

  // Zoom and scroll move together -- every zoom has to reposition the view to
  // keep something anchored -- so they are one piece of state. As two, a zoom
  // and the scroll it implies could interleave and land somewhere neither
  // asked for.
  const [viewport, setViewport] = useState({ zoom: MIN_ZOOM, scrollX: 0 });
  const contentWidth = laneWidth * viewport.zoom;

  const clampScroll = (x: number, content: number) =>
    Math.max(0, Math.min(Math.max(0, content - laneWidth), x));

  const xOf = (seconds: number) =>
    duration > 0 ? (seconds / duration) * contentWidth : 0;

  /**
   * Moves to a zoom level, keeping whatever is under `anchorX` where it is.
   *
   * Without an anchor a zoom throws away your place: you are looking at bar 40,
   * you zoom to see it better, and you are now looking at bar 3.
   */
  const applyZoom = (next: number, anchorX: number) => {
    setViewport((current) => {
      const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      const content = laneWidth * zoom;
      const ratio = zoom / current.zoom;
      return {
        zoom,
        scrollX: clampScroll(
          (current.scrollX + anchorX) * ratio - anchorX,
          content
        ),
      };
    });
  };

  const stepZoom = (direction: 1 | -1) => {
    const stops = direction === 1 ? ZOOM_STOPS : [...ZOOM_STOPS].reverse();
    const next =
      stops.find((stop) =>
        direction === 1
          ? stop > viewport.zoom + 0.01
          : stop < viewport.zoom - 0.01
      ) ?? viewport.zoom;
    // Anchored on the middle of the view, which is where you are looking when
    // you reach for a zoom button.
    applyZoom(next, laneWidth / 2);
  };

  // Refs, because a PanResponder is built once and would otherwise hold the
  // first render's callbacks, sections and viewport forever.
  const stateRef = useRef({
    sections,
    duration,
    laneWidth,
    contentWidth,
    viewport,
    onScrub,
    onSeek,
    onMoveSection,
    onSelectSection,
  });
  stateRef.current = {
    sections,
    duration,
    laneWidth,
    contentWidth,
    viewport,
    onScrub,
    onSeek,
    onMoveSection,
    onSelectSection,
  };

  /** Viewport x (what a touch reports) to a moment in the song. */
  const secondsFrom = (x: number) => {
    const { duration: d, contentWidth: content, viewport: view } =
      stateRef.current;
    if (d <= 0 || content <= 0) return 0;
    return Math.max(0, Math.min(d, ((x + view.scrollX) / content) * d));
  };

  /* ---------------------------------------------------------------------- */
  /* Gestures                                                                */
  /* ---------------------------------------------------------------------- */

  // A pinch begins as a single touch, so the lane responder has already granted
  // by the time the second finger lands. This tells it to stand down rather
  // than scrolling on the centroid of two fingers that are pinching.
  const pinchingRef = useRef(false);
  const pinchStartRef = useRef(MIN_ZOOM);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        // On the JS thread: everything it touches -- the viewport state, the
        // scroll clamp -- lives there, and a worklet would have to hop back for
        // all of it anyway.
        .runOnJS(true)
        .onStart(() => {
          pinchingRef.current = true;
          pinchStartRef.current = stateRef.current.viewport.zoom;
        })
        .onUpdate((event) => {
          const raw = pinchStartRef.current * event.scale;
          // Rounded, so a pinch rebuilds the waveform paths a few times rather
          // than sixty times a second.
          const stepped = Math.round(raw / ZOOM_STEP) * ZOOM_STEP;
          applyZoom(stepped, event.focalX);
        })
        .onFinalize(() => {
          pinchingRef.current = false;
        }),
    // Rebuilt when the lane width changes, since applyZoom closes over it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [laneWidth]
  );

  // Dragging the lanes navigates. Scrubbing lives on the ruler instead, the way
  // it does on a desktop DAW -- one gesture per surface, so neither has to be
  // guessed at.
  const scrollStartRef = useRef(0);
  const laneResponder = useMemo(
    () =>
      PanResponder.create({
        // Deliberately not claimed on touch-down. Granting on start would mean
        // this responder owns the touch before anyone knows which way it is
        // going, and a vertical flick to scroll the page would die on the
        // lanes. It is claimed only once the finger has travelled, and only if
        // it travelled sideways.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 4 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          scrollStartRef.current = stateRef.current.viewport.scrollX;
        },
        onPanResponderMove: (_event, gesture) => {
          if (pinchingRef.current) return;
          setViewport((current) => ({
            ...current,
            scrollX: clampScroll(
              scrollStartRef.current - gesture.dx,
              stateRef.current.laneWidth * current.zoom
            ),
          }));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [laneWidth]
  );

  // The marker band is its own responder so the two gestures can't fight: a
  // finger on a section flag moves the flag, a finger on empty ruler moves the
  // playhead, and neither has to guess which was meant.
  // Which edge of which section is in hand. Both edges of every section are
  // grabbable, so what the finger landed on is a section AND a side of it.
  const draggingMarkerRef = useRef<{
    id: string;
    edge: "start" | "end";
  } | null>(null);
  const markerResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const x = event.nativeEvent.locationX;
          const {
            sections: liveSections,
            duration: d,
            contentWidth: content,
            viewport: view,
          } = stateRef.current;

          const xAt = (seconds: number) =>
            (d > 0 ? (seconds / d) * content : 0) - view.scrollX;

          // The nearest edge, not the nearest section. On a short section both
          // of its edges are inside one thumb, and picking by section would
          // make the end of a four-bar loop ungrabbable.
          let closest: { id: string; edge: "start" | "end" } | null = null;
          let best = MARKER_TOUCH_WIDTH / 2;
          for (const section of liveSections) {
            const edges: { edge: "start" | "end"; seconds: number }[] = [
              { edge: "start", seconds: section.startSeconds },
            ];
            // A section with no end has no handle to grab for it -- there is no
            // point on the ruler that means "the end of the file".
            if (section.endSeconds !== undefined) {
              edges.push({ edge: "end", seconds: section.endSeconds });
            }

            for (const { edge, seconds } of edges) {
              const distance = Math.abs(xAt(seconds) - x);
              if (distance > best) continue;
              // Two sections meeting at the same point -- which is what placing
              // markers straight through a song gives you -- put two handles
              // under one thumb. The start wins: a start is what a marker has
              // always been, and it keeps the section you are reaching for, the
              // one beginning there, under the finger.
              if (distance === best && closest && edge !== "start") continue;
              best = distance;
              closest = { id: section.id, edge };
            }
          }

          draggingMarkerRef.current = closest;
          stateRef.current.onSelectSection(closest?.id ?? null);
          // A tap on empty ruler is a scrub -- it is the gesture people reach
          // for first, and refusing it would make the top of the timeline feel
          // dead.
          if (!closest) stateRef.current.onScrub(secondsFrom(x));
        },
        onPanResponderMove: (event) => {
          if (pinchingRef.current) return;
          const held = draggingMarkerRef.current;
          const seconds = secondsFrom(event.nativeEvent.locationX);
          if (held) {
            stateRef.current.onMoveSection(held.id, seconds, held.edge);
          } else {
            stateRef.current.onScrub(seconds);
          }
        },
        onPanResponderRelease: (event) => {
          if (!draggingMarkerRef.current) {
            stateRef.current.onSeek(secondsFrom(event.nativeEvent.locationX));
          }
          draggingMarkerRef.current = null;
        },
        onPanResponderTerminate: () => {
          draggingMarkerRef.current = null;
        },
      }),
    []
  );

  /* ---------------------------------------------------------------------- */
  /* Following the playhead                                                  */
  /* ---------------------------------------------------------------------- */

  // Zoomed in, the playhead walks off the right-hand edge within a few bars and
  // the view is showing a part of the song that finished a while ago. This
  // pages it along, the way a DAW does -- jumping a screen at a time rather
  // than sliding continuously, which at 16 reports a second would be a re-render
  // per report and a view that never sits still long enough to read.
  useEffect(() => {
    if (!isPlaying || viewport.zoom <= MIN_ZOOM || duration <= 0) return;

    const id = playheadSeconds.addListener(({ value }) => {
      const { contentWidth: content, viewport: view } = stateRef.current;
      const x = (value / duration) * content - view.scrollX;
      if (x >= 0 && x <= laneWidth * 0.92) return;

      setViewport((current) => ({
        ...current,
        // Landed a tenth in from the left, so there is most of a screen of
        // song ahead of it before this has to happen again.
        scrollX: clampScroll(
          (value / duration) * (laneWidth * current.zoom) - laneWidth * 0.1,
          laneWidth * current.zoom
        ),
      }));
    });

    return () => playheadSeconds.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, viewport.zoom, duration, laneWidth, playheadSeconds]);

  /* ---------------------------------------------------------------------- */
  /* Drawing                                                                 */
  /* ---------------------------------------------------------------------- */

  // The bar grid, spaced so it stays readable rather than turning into a solid
  // block. A five-minute song at 160bpm is two hundred bars; drawing a line for
  // each across a phone would be a grey rectangle, so the step widens until the
  // lines are far enough apart to read as a grid, and labels thin out further.
  // Zooming in narrows it again, which is most of what zoom is for.
  //
  // Windowed to what is on screen, not built for the whole song. Zoomed to 32x
  // a five-minute song is nine thousand pixels of content, and a bar line every
  // bar over that is a couple of hundred SVG nodes and as many label views --
  // almost all of them off-screen, all of them costing layout. Only the bars in
  // view are built, so the cost of the ruler is the same at every zoom level.
  const grid = useMemo(() => {
    const secondsPerBar = (60 / (bpm || 120)) * 4;
    if (duration <= 0 || secondsPerBar <= 0) return null;

    const bars = Math.ceil(duration / secondsPerBar);
    const pxPerBar = contentWidth / bars;
    const stepFor = (minimumPx: number) =>
      BAR_STEPS.find((step) => step * pxPerBar >= minimumPx) ??
      BAR_STEPS[BAR_STEPS.length - 1];

    const lineStep = stepFor(9);
    const labelStep = stepFor(38);

    // A bar's edge, in viewport coordinates. Anything outside the lane plus a
    // little margin is not built at all.
    const firstVisible = Math.max(
      0,
      Math.floor(viewport.scrollX / (pxPerBar * lineStep)) * lineStep
    );
    const lastVisible = Math.min(
      bars,
      Math.ceil((viewport.scrollX + laneWidth) / (pxPerBar * lineStep)) * lineStep
    );

    const lines: { bar: number; x: number; major: boolean }[] = [];
    for (let bar = firstVisible; bar <= lastVisible; bar += lineStep) {
      lines.push({
        bar,
        x: bar * pxPerBar - viewport.scrollX,
        major: bar % labelStep === 0,
      });
    }

    return { lines, labels: lines.filter((line) => line.major) };
  }, [bpm, duration, contentWidth, viewport.scrollX, laneWidth]);

  // Memoised because a scroll drag re-renders this component at the frame rate,
  // and an interpolation rebuilt on each of those frames allocates for no
  // reason -- the mapping only changes when the song's length or the content's
  // width does.
  const playheadX = useMemo(
    () =>
      playheadSeconds.interpolate({
        inputRange: [0, Math.max(duration, 0.001)],
        outputRange: [0, contentWidth],
        extrapolate: "clamp",
      }),
    [playheadSeconds, duration, contentWidth]
  );

  // Sections in view, in viewport coordinates, as spans rather than points.
  //
  // Clipped to the lane rather than filtered on the start alone: a section that
  // begins off the left edge and runs across the whole screen is one you are
  // looking straight at, and filtering by its start would draw nothing at all.
  // A section without an end runs to the end of the song, which is where the
  // content ends.
  const visibleSections = useMemo(
    () =>
      // Nothing until the stems have been measured. With no duration there is
      // no mapping from seconds to x, so every section would collapse onto the
      // left edge and any open-ended one would span the whole ruler -- a pile
      // of overlapping bands that looks like corrupt data and is really just a
      // song that hasn't finished decoding.
      duration <= 0
        ? []
        : sections
        .map((section) => {
          const x = xOf(section.startSeconds) - viewport.scrollX;
          const endX =
            (section.endSeconds !== undefined
              ? xOf(section.endSeconds)
              : contentWidth) - viewport.scrollX;
          return { section, x, endX, width: Math.max(1, endX - x) };
        })
        .filter(
          ({ x, endX }) =>
            endX >= -MARKER_TOUCH_WIDTH && x <= laneWidth + MARKER_TOUCH_WIDTH
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, viewport.scrollX, contentWidth, duration, laneWidth]
  );

  const zoomLabel =
    viewport.zoom <= MIN_ZOOM
      ? "FIT"
      : `${viewport.zoom.toFixed(2).replace(/\.?0+$/, "")}×`;

  return (
    <View style={{ width }}>
      <View style={{ flexDirection: "row" }}>
        {/* Track headers, in a fixed column that the arrangement scrolls under.
            Names and their M/S sit beside the lane they belong to rather than
            above it, so a stem is one horizontal read: what it is, whether it's
            sounding, what it looks like. */}
        <View style={{ width: HEADER_WIDTH }}>
          <View style={{ height: RULER_HEIGHT + MARKER_HEIGHT }} />
          {tracks.map((track) => {
            const isSolo = soloed === track.id;
            const isSilent =
              masterMuted || (soloed ? !isSolo : mix[track.id]?.muted === true);
            return (
              <View
                key={track.id}
                style={{
                  height: LANE_HEIGHT,
                  marginBottom: LANE_GAP,
                  justifyContent: "center",
                  paddingRight: 6,
                }}
              >
                <Text
                  numberOfLines={1}
                  className="text-micro text-white font-satoshiBold"
                  style={{ opacity: isSilent ? 0.4 : 1 }}
                >
                  {track.name}
                </Text>

                <View style={{ flexDirection: "row", marginTop: 5 }}>
                  <LaneButton
                    label="M"
                    active={mix[track.id]?.muted === true}
                    activeColor={COLORS.danger}
                    onPress={() => onToggleMute(track.id)}
                    accessibilityLabel={`${
                      mix[track.id]?.muted ? "Unmute" : "Mute"
                    } ${track.name}`}
                  />
                  <LaneButton
                    label="S"
                    active={isSolo}
                    activeColor={COLORS.warning}
                    onPress={() => onToggleSolo(track.id)}
                    accessibilityLabel={`${isSolo ? "Clear solo on" : "Solo"} ${
                      track.name
                    }`}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <GestureDetector gesture={pinch}>
          <View style={{ width: laneWidth, overflow: "hidden" }}>
            {/* Ruler and markers. One band, one responder. */}
            <View
              {...markerResponder.panHandlers}
              style={{
                height: RULER_HEIGHT + MARKER_HEIGHT,
                overflow: "hidden",
              }}
            >
              <Svg width={laneWidth} height={RULER_HEIGHT + MARKER_HEIGHT}>
                {grid?.lines.map((line) => (
                  <Line
                    key={line.bar}
                    x1={line.x}
                    y1={RULER_HEIGHT - 6}
                    x2={line.x}
                    y2={RULER_HEIGHT}
                    stroke={COLORS.white}
                    strokeWidth={1}
                    opacity={line.major ? 0.45 : 0.18}
                  />
                ))}
              </Svg>

              {/* Bar numbers as text rather than SVG glyphs: RN's Svg <Text>
                  does not take the app's font families, and a ruler in a
                  different typeface to everything around it looks like a bug. */}
              {grid?.labels.map((label) => (
                <Text
                  key={label.bar}
                  pointerEvents="none"
                  className="text-micro text-ink-muted font-spaceBold"
                  style={{ position: "absolute", left: label.x + 3, top: 1 }}
                >
                  {label.bar + 1}
                </Text>
              ))}

              {/* Sections, drawn as the spans they are.
                  A bar from start to end rather than a flag at the start, so
                  the length you will loop is the length you can see -- which is
                  the only way to tell a four-bar chorus loop from one that runs
                  on into the next verse. Named, because a section you cannot
                  read is only a line, and the whole reason for marking one is
                  to know what you are about to launch.

                  Both edges are drawn as grab handles and both are live to the
                  responder above. */}
              {visibleSections.map(({ section, x, width }) => {
                const isSelected = selectedSectionId === section.id;
                const hasEnd = section.endSeconds !== undefined;
                const accent = isSelected ? COLORS.warning : COLORS.brandFrom;
                return (
                  <View
                    key={section.id}
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: x,
                      top: RULER_HEIGHT,
                      width,
                      height: MARKER_HEIGHT - 2,
                      // Pushed in when the section starts off the left edge, so
                      // a span you are sitting inside still shows its name at
                      // the edge of the screen instead of thousands of pixels
                      // to the left of it.
                      paddingLeft:
                        x < 0 ? Math.max(5, Math.min(width - 20, -x + 5)) : 5,
                      paddingRight: 3,
                      justifyContent: "center",
                      borderLeftWidth: 2,
                      borderLeftColor: accent,
                      // Only when it has one. An open-ended section fades out
                      // rather than claiming an edge it doesn't have.
                      borderRightWidth: hasEnd ? 2 : 0,
                      borderRightColor: accent,
                      backgroundColor: isSelected
                        ? "rgba(245,158,11,0.22)"
                        : "rgba(88,190,236,0.14)",
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      className="text-micro font-spaceBold"
                      style={{
                        color: isSelected ? COLORS.warning : COLORS.white,
                      }}
                    >
                      {section.name}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* The lanes. */}
            <View
              {...laneResponder.panHandlers}
              style={{ height: lanesHeight, overflow: "hidden" }}
            >
              <Waveforms
                tracks={tracks}
                peaks={peaks}
                mix={mix}
                soloed={soloed}
                masterMuted={masterMuted}
                laneWidth={laneWidth}
                contentWidth={contentWidth}
                scrollX={viewport.scrollX}
                height={lanesHeight}
              />

              {/* Sections carried down through every lane, so a span reads
                  against the audio it covers rather than as a mark on the
                  ruler. The selected one is washed as well as ruled: when you
                  are trimming a loop, seeing which bars are inside it is the
                  whole job. */}
              <View pointerEvents="none" style={FILL}>
                <Svg width={laneWidth} height={lanesHeight}>
                  {visibleSections.map(({ section, x, endX, width }) => {
                    const isSelected = selectedSectionId === section.id;
                    return (
                      <G key={section.id}>
                        {isSelected && (
                          <Rect
                            x={x}
                            y={0}
                            width={width}
                            height={lanesHeight}
                            fill={COLORS.warning}
                            opacity={0.1}
                          />
                        )}
                        <Line
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={lanesHeight}
                          stroke={isSelected ? COLORS.warning : COLORS.white}
                          strokeWidth={1}
                          opacity={isSelected ? 0.9 : 0.25}
                        />
                        {section.endSeconds !== undefined && (
                          <Line
                            x1={endX}
                            y1={0}
                            x2={endX}
                            y2={lanesHeight}
                            stroke={isSelected ? COLORS.warning : COLORS.white}
                            strokeWidth={1}
                            // Dashed, so an end never reads as the start of the
                            // section after it -- which is what a second solid
                            // line at the same weight would look like.
                            strokeDasharray="3 3"
                            opacity={isSelected ? 0.9 : 0.25}
                          />
                        )}
                      </G>
                    );
                  })}
                </Svg>
              </View>
            </View>

            {/* Cursor: where play will start from. Distinct from the playhead
                because they are different promises -- one is where the audio
                is, the other is where you have said to go next, and while the
                transport is stopped only the second one exists. */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: RULER_HEIGHT,
                height: MARKER_HEIGHT + lanesHeight,
                left: xOf(cursorSeconds) - viewport.scrollX,
                width: 1,
                backgroundColor: COLORS.white,
                opacity: 0.55,
              }}
            />

            {/* Playhead. Spans the ruler and every lane, and moves without a
                render -- see the note on playheadSeconds. */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                height: RULER_HEIGHT + MARKER_HEIGHT + lanesHeight,
                left: 0,
                width: 2,
                backgroundColor: COLORS.brand,
                transform: [
                  { translateX: Animated.subtract(playheadX, viewport.scrollX) },
                ],
              }}
            />
          </View>
        </GestureDetector>
      </View>

      {/* Zoom, with the pinch it mirrors. Buttons as well as the gesture
          because a pinch is a two-handed move and this is a one-handed screen
          as often as not -- and because "one step in" is a thing you can ask
          for exactly, which a pinch never is. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-end",
          marginTop: 6,
        }}
      >
        <Text className="mr-2 text-micro text-ink-muted font-satoshiRegular">
          drag lanes to scroll · pinch to zoom
        </Text>
        <ZoomButton
          label="−"
          disabled={viewport.zoom <= MIN_ZOOM}
          onPress={() => stepZoom(-1)}
          accessibilityLabel="Zoom out"
        />
        <View style={{ width: 46, alignItems: "center" }}>
          <Text className="text-nav text-white font-spaceBold">
            {zoomLabel}
          </Text>
        </View>
        <ZoomButton
          label="+"
          disabled={viewport.zoom >= MAX_ZOOM}
          onPress={() => stepZoom(1)}
          accessibilityLabel="Zoom in"
        />
      </View>
    </View>
  );
}

const FILL = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

/**
 * The waveform lanes.
 *
 * Split out and memoised so the playhead, the cursor and every meter tick can
 * move without re-walking the path points. Mute state is in here because it
 * changes the drawing; nothing else that moves is.
 *
 * Drawn at the lane's width and windowed to the buckets actually in view,
 * rather than at the content's width and scrolled. Zoomed to 32x the content is
 * nine thousand pixels across, and handing react-native-svg a canvas that size
 * per lane is a large off-screen surface to keep around for the sake of the
 * 3% of it you can see. The window also makes scrolling cheaper the further in
 * you are: the number of buckets on screen is the total divided by the zoom, so
 * the rebuild a scroll frame costs shrinks exactly as the scroll gets more
 * likely.
 */
const Waveforms = memo(function Waveforms({
  tracks,
  peaks,
  mix,
  soloed,
  masterMuted,
  laneWidth,
  contentWidth,
  scrollX,
  height,
}: {
  tracks: TimelineTrack[];
  peaks: Record<string, number[]>;
  mix: Record<string, TrackMix>;
  soloed: string | null;
  masterMuted: boolean;
  laneWidth: number;
  contentWidth: number;
  scrollX: number;
  height: number;
}) {
  const paths = useMemo(
    () =>
      tracks.map((track) => {
        const values = peaks[track.id] ?? [];
        if (values.length === 0) return { id: track.id, d: "" };

        const middle = LANE_HEIGHT / 2;
        const step = contentWidth / values.length;
        if (step <= 0) return { id: track.id, d: "" };

        // One bucket of margin either side, so the path does not visibly end
        // just inside the edge it is being scrolled past.
        const first = Math.max(0, Math.floor(scrollX / step) - 1);
        const last = Math.min(
          values.length,
          Math.ceil((scrollX + laneWidth) / step) + 1
        );
        if (last <= first) return { id: track.id, d: "" };

        // Mirrored around the lane's centre line, so it reads as audio rather
        // than as a bar chart.
        let top = "";
        let bottom = "";
        for (let index = first; index < last; index++) {
          const x = index * step - scrollX;
          const half = Math.max(0.5, values[index] * (LANE_HEIGHT / 2 - 3));
          top += `${top ? " L" : "M"} ${x.toFixed(1)} ${(middle - half).toFixed(1)}`;
          bottom = ` L ${x.toFixed(1)} ${(middle + half).toFixed(1)}${bottom}`;
        }

        return { id: track.id, d: `${top}${bottom} Z` };
      }),
    [tracks, peaks, contentWidth, scrollX, laneWidth]
  );

  return (
    <Svg width={laneWidth} height={height}>
      {paths.map((path, index) => {
        const isSolo = soloed === path.id;
        const isSilent =
          masterMuted || (soloed ? !isSolo : mix[path.id]?.muted === true);
        return (
          <G key={path.id} y={index * (LANE_HEIGHT + LANE_GAP)}>
            <Rect
              x={0}
              y={0}
              width={laneWidth}
              height={LANE_HEIGHT}
              rx={4}
              fill={COLORS.surface}
            />
            {path.d ? (
              <Path
                d={path.d}
                fill={isSolo ? COLORS.warning : COLORS.brandFrom}
                opacity={isSilent ? 0.18 : 0.6}
              />
            ) : null}
          </G>
        );
      })}
    </Svg>
  );
});

function ZoomButton({
  label,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      activeOpacity={0.7}
      style={{
        width: 30,
        height: 26,
        borderRadius: 5,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: COLORS.border,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Text className="text-label text-white font-spaceBold">{label}</Text>
    </TouchableOpacity>
  );
}

function LaneButton({
  label,
  active,
  activeColor,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      activeOpacity={0.7}
      style={{
        width: 22,
        height: 18,
        marginRight: 4,
        borderRadius: 3,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? activeColor : "rgba(255,255,255,0.08)",
      }}
    >
      <Text
        className="text-nav font-spaceBold"
        style={{ color: active ? COLORS.black : COLORS.textMuted }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
