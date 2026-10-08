import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { G, Line, Path, Rect } from "react-native-svg";

import { COLORS } from "../../constants/theme";
import { BAR_STEPS, secondsPerBar, snapSeconds } from "../../constants/barGrid";
import type { CueSection } from "../../context/SessionsContext";
import type { TrackMix } from "../../context/SessionPlaybackContext";

// Minimum duration in seconds allowed for any section so its start and end cannot invert.
const MIN_SECTION_DURATION = 0.1;

const HEADER_WIDTH = 92;
const RULER_HEIGHT = 20;
const MARKER_HEIGHT = 22;
const LANE_HEIGHT = 52;
const LANE_GAP = 4;
const MARKER_TOUCH_WIDTH = 34;

const ZOOM_STOPS = [1, 2, 4, 8, 16, 32];
const MIN_ZOOM = ZOOM_STOPS[0];
const MAX_ZOOM = ZOOM_STOPS[ZOOM_STOPS.length - 1];

const ZOOM_STEP = 0.25;

/**
 * Clamps zoom values within the designated minimum and maximum zoom constraints.
 */
export function stepsToZoom(val: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, val));
}

/**
 * Calculates clamped seconds for a section edge being trimmed so that
 * it never crosses its own opposite edge or neighboring sections.
 */
export function clampSectionEdge({
  sections,
  sectionId,
  edge,
  targetSeconds,
  duration,
  minDuration = MIN_SECTION_DURATION,
}: {
  sections: CueSection[];
  sectionId: string;
  edge: "start" | "end";
  targetSeconds: number;
  duration: number;
  minDuration?: number;
}): number {
  const sorted = [...sections].sort((a, b) => a.startSeconds - b.startSeconds);
  const index = sorted.findIndex((s) => s.id === sectionId);
  if (index === -1) return targetSeconds;

  const current = sorted[index];
  const prev = index > 0 ? sorted[index - 1] : null;
  const next = index < sorted.length - 1 ? sorted[index + 1] : null;

  let min = 0;
  let max = duration > 0 ? duration : Infinity;

  if (edge === "start") {
    if (prev) {
      min = prev.endSeconds !== undefined ? prev.endSeconds : prev.startSeconds;
    } else {
      min = 0;
    }

    if (current.endSeconds !== undefined) {
      max = current.endSeconds - minDuration;
    } else if (next) {
      max = next.startSeconds - minDuration;
    } else if (duration > 0) {
      max = duration - minDuration;
    }
  } else {
    min = current.startSeconds + minDuration;

    if (next) {
      max = next.startSeconds;
    } else if (duration > 0) {
      max = duration;
    }
  }

  if (min > max) {
    return edge === "start" ? min : max;
  }

  return Math.max(min, Math.min(max, targetSeconds));
}

export function getNewSectionBounds({
  sections,
  desiredStartSeconds,
  desiredDurationSeconds,
  songDuration,
  minDuration = MIN_SECTION_DURATION,
}: {
  sections: CueSection[];
  desiredStartSeconds: number;
  desiredDurationSeconds: number;
  songDuration: number;
  minDuration?: number;
}): { startSeconds: number; endSeconds: number } | null {
  const sorted = [...sections].sort((a, b) => a.startSeconds - b.startSeconds);
  let prevSection: CueSection | null = null;
  let nextSection: CueSection | null = null;

  for (const section of sorted) {
    if (section.startSeconds <= desiredStartSeconds) {
      prevSection = section;
    } else {
      nextSection = section;
      break;
    }
  }

  let start = desiredStartSeconds;

  if (prevSection) {
    const prevEnd = prevSection.endSeconds ?? prevSection.startSeconds;
    if (start < prevEnd) {
      start = prevEnd;
    }
  }

  const maxEnd = nextSection
    ? nextSection.startSeconds
    : songDuration > 0
      ? songDuration
      : Infinity;

  if (start >= maxEnd - minDuration) {
    return null;
  }

  const end = Math.min(maxEnd, start + desiredDurationSeconds);
  return { startSeconds: start, endSeconds: end };
}

export type TimelineTrack = {
  id: string;
  name: string;
};

type TrackTimelineProps = {
  tracks: TimelineTrack[];
  peaks: Record<string, number[]>;
  duration: number;
  bpm: number;
  sections: CueSection[];
  mix: Record<string, TrackMix>;
  soloed: string | null;
  masterMuted?: boolean;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  playheadSeconds: Animated.Value;
  isPlaying: boolean;
  cursorSeconds: number;
  onScrub: (seconds: number) => void;
  onSeek: (seconds: number) => void;
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

  const [viewport, setViewport] = useState({ zoom: MIN_ZOOM, scrollX: 0 });
  const contentWidth = laneWidth * viewport.zoom;

  const [isAutoFollowDisabled, setIsAutoFollowDisabled] = useState(false);
  const isInteractingRef = useRef(false);
  const autoFollowTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clampScroll = (x: number, content: number) =>
    Math.max(0, Math.min(Math.max(0, content - laneWidth), x));

  const xOf = (seconds: number) =>
    duration > 0 ? (seconds / duration) * contentWidth : 0;

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
    applyZoom(next, laneWidth / 2);
  };

  const stateRef = useRef({
    sections,
    duration,
    bpm,
    laneWidth,
    contentWidth,
    viewport,
    isAutoFollowDisabled,
    onScrub,
    onSeek,
    onMoveSection,
    onSelectSection,
  });
  stateRef.current = {
    sections,
    duration,
    bpm,
    laneWidth,
    contentWidth,
    viewport,
    isAutoFollowDisabled,
    onScrub,
    onSeek,
    onMoveSection,
    onSelectSection,
  };

  const secondsFrom = (x: number) => {
    const { duration: d, contentWidth: content, viewport: view } =
      stateRef.current;
    if (d <= 0 || content <= 0) return 0;
    return Math.max(0, Math.min(d, ((x + view.scrollX) / content) * d));
  };

  const pxPerSecondOf = (state: { duration: number; contentWidth: number }) =>
    state.duration > 0 ? state.contentWidth / state.duration : 0;

  /**
   * Suspends auto-scrolling immediately upon gesture interaction.
   */
  const suspendAutoFollow = () => {
    setIsAutoFollowDisabled(true);
    if (autoFollowTimeoutRef.current) {
      clearTimeout(autoFollowTimeoutRef.current);
    }
  };

  /**
   * Schedules re-enabling playhead auto-follow. Will only execute
   * once all touch interactions have completely ceased.
   */
  const startAutoFollowTimer = () => {
    if (autoFollowTimeoutRef.current) {
      clearTimeout(autoFollowTimeoutRef.current);
    }
    autoFollowTimeoutRef.current = setTimeout(() => {
      if (!isInteractingRef.current) {
        setIsAutoFollowDisabled(false);
      }
    }, 5000); // Wait 5 seconds of absolute idle before snapping back
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (autoFollowTimeoutRef.current) clearTimeout(autoFollowTimeoutRef.current);
    };
  }, []);

  // Instantly re-engage auto-follow when playback state starts or restarts
  useEffect(() => {
    if (isPlaying) {
      setIsAutoFollowDisabled(false);
      if (autoFollowTimeoutRef.current) {
        clearTimeout(autoFollowTimeoutRef.current);
      }
    }
  }, [isPlaying]);

  /* ---------------------------------------------------------------------- */
  /* Gestures                                                                */
  /* ---------------------------------------------------------------------- */

  const pinchStartRef = useRef(MIN_ZOOM);
  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .onStart(() => {
          isInteractingRef.current = true;
          suspendAutoFollow();
          pinchStartRef.current = stateRef.current.viewport.zoom;
        })
        .onUpdate((event) => {
          const raw = pinchStartRef.current * event.scale;
          const stepped = Math.round(raw / ZOOM_STEP) * ZOOM_STEP;
          applyZoom(stepsToZoom(stepped), event.focalX);
        })
        .onEnd(() => {
          isInteractingRef.current = false;
          startAutoFollowTimer();
        })
        .onFinalize(() => {
          isInteractingRef.current = false;
          startAutoFollowTimer();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [laneWidth]
  );

  const laneScrollStartRef = useRef(0);
  const lanePan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-6, 6])
        .failOffsetY([-14, 14])
        .minPointers(1)
        .maxPointers(1)
        .onStart(() => {
          isInteractingRef.current = true;
          suspendAutoFollow();
          laneScrollStartRef.current = stateRef.current.viewport.scrollX;
        })
        .onUpdate((event) => {
          setViewport((current) => ({
            ...current,
            scrollX: clampScroll(
              laneScrollStartRef.current - event.translationX,
              stateRef.current.laneWidth * current.zoom
            ),
          }));
        })
        .onEnd(() => {
          isInteractingRef.current = false;
          startAutoFollowTimer();
        })
        .onFinalize(() => {
          isInteractingRef.current = false;
          startAutoFollowTimer();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [laneWidth]
  );

  const draggingMarkerRef = useRef<{
    id: string;
    edge: "start" | "end";
  } | null>(null);

  const pickMarkerAt = (x: number) => {
    const {
      sections: liveSections,
      duration: d,
      contentWidth: content,
      viewport: view,
    } = stateRef.current;

    const xAt = (seconds: number) =>
      (d > 0 ? (seconds / d) * content : 0) - view.scrollX;

    let closest: { id: string; edge: "start" | "end" } | null = null;
    let best = MARKER_TOUCH_WIDTH / 2;
    for (const section of liveSections) {
      const edges: { edge: "start" | "end"; seconds: number }[] = [
        { edge: "start", seconds: section.startSeconds },
      ];
      if (section.endSeconds !== undefined) {
        edges.push({ edge: "end", seconds: section.endSeconds });
      }

      for (const { edge, seconds } of edges) {
        const distance = Math.abs(xAt(seconds) - x);
        if (distance > best) continue;
        if (distance === best && closest && edge !== "start") continue;
        best = distance;
        closest = { id: section.id, edge };
      }
    }
    return closest;
  };

  const markerPan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-2, 2])
        .activeOffsetY([-2, 2])
        .minPointers(1)
        .maxPointers(1)
        .onBegin((event) => {
          isInteractingRef.current = true;
          suspendAutoFollow();
          const held = pickMarkerAt(event.x);
          draggingMarkerRef.current = held;
          stateRef.current.onSelectSection(held?.id ?? null);
          if (!held) stateRef.current.onScrub(secondsFrom(event.x));
        })
        .onUpdate((event) => {
          const held = draggingMarkerRef.current;
          const rawSeconds = secondsFrom(event.x);
          if (held) {
            const snapped = snapSeconds(
              rawSeconds,
              stateRef.current.bpm,
              pxPerSecondOf(stateRef.current)
            );
            const clamped = clampSectionEdge({
              sections: stateRef.current.sections,
              sectionId: held.id,
              edge: held.edge,
              targetSeconds: snapped,
              duration: stateRef.current.duration,
            });
            stateRef.current.onMoveSection(held.id, clamped, held.edge);
          } else {
            stateRef.current.onScrub(rawSeconds);
          }
        })
        .onEnd((event) => {
          if (!draggingMarkerRef.current) {
            stateRef.current.onSeek(secondsFrom(event.x));
          }
          draggingMarkerRef.current = null;
          isInteractingRef.current = false;
          startAutoFollowTimer();
        })
        .onFinalize(() => {
          draggingMarkerRef.current = null;
          isInteractingRef.current = false;
          startAutoFollowTimer();
        }),
    []
  );

  const laneGesture = useMemo(
    () => Gesture.Simultaneous(pinch, lanePan),
    [pinch, lanePan]
  );

  const markerGesture = useMemo(
    () => Gesture.Simultaneous(pinch, markerPan),
    [pinch, markerPan]
  );

  /* ---------------------------------------------------------------------- */
  /* Following the playhead                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!isPlaying || viewport.zoom <= MIN_ZOOM || duration <= 0) return;

    const id = playheadSeconds.addListener(({ value }) => {
      if (stateRef.current.isAutoFollowDisabled) return;

      const { contentWidth: content, viewport: view } = stateRef.current;
      const x = (value / duration) * content - view.scrollX;
      if (x >= 0 && x <= laneWidth * 0.92) return;

      setViewport((current) => ({
        ...current,
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

  const grid = useMemo(() => {
    const perBar = secondsPerBar(bpm);
    if (duration <= 0 || perBar <= 0) return null;

    const bars = Math.ceil(duration / perBar);
    const pxPerBar = contentWidth / bars;
    const stepFor = (minimumPx: number) =>
      BAR_STEPS.find((step) => step * pxPerBar >= minimumPx) ??
      BAR_STEPS[BAR_STEPS.length - 1];

    const lineStep = stepFor(9);
    const labelStep = stepFor(38);

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

  const playheadX = useMemo(
    () =>
      playheadSeconds.interpolate({
        inputRange: [0, Math.max(duration, 0.001)],
        outputRange: [0, contentWidth],
        extrapolate: "clamp",
      }),
    [playheadSeconds, duration, contentWidth]
  );

  const visibleSections = useMemo(
    () =>
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
                    accessibilityLabel={`${mix[track.id]?.muted ? "Unmute" : "Mute"
                      } ${track.name}`}
                  />
                  <LaneButton
                    label="S"
                    active={isSolo}
                    activeColor={COLORS.warning}
                    onPress={() => onToggleSolo(track.id)}
                    accessibilityLabel={`${isSolo ? "Clear solo on" : "Solo"} ${track.name
                      }`}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ width: laneWidth, overflow: "hidden" }}>
          {/* Ruler and markers */}
          <GestureDetector gesture={markerGesture}>
            <View
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
                      paddingLeft:
                        x < 0 ? Math.max(5, Math.min(width - 20, -x + 5)) : 5,
                      paddingRight: 3,
                      justifyContent: "center",
                      borderLeftWidth: 2,
                      borderLeftColor: accent,
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
          </GestureDetector>

          {/* Lanes */}
          <GestureDetector gesture={laneGesture}>
            <View style={{ height: lanesHeight, overflow: "hidden" }}>
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
          </GestureDetector>

          {/* Cursor */}
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

          {/* Playhead */}
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
      </View>

      {/* Manual Zoom HUD & Status */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text className="text-micro text-ink-muted font-satoshiRegular">
            drag lanes to scroll · pinch to zoom
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {isAutoFollowDisabled && isPlaying && (
            <TouchableOpacity
              onPress={() => {
                setIsAutoFollowDisabled(false);
                if (autoFollowTimeoutRef.current) {
                  clearTimeout(autoFollowTimeoutRef.current);
                }
              }}
              className="mr-3 px-2 py-1 rounded bg-brand/10 border border-brand/20"
            >
              <Text className="text-[10px] text-brand font-spaceBold">FOLLOW</Text>
            </TouchableOpacity>
          )}
          <ZoomButton
            label="−"
            disabled={viewport.zoom <= MIN_ZOOM}
            onPress={() => {
              suspendAutoFollow();
              stepZoom(-1);
              startAutoFollowTimer();
            }}
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
            onPress={() => {
              suspendAutoFollow();
              stepZoom(1);
              startAutoFollowTimer();
            }}
            accessibilityLabel="Zoom in"
          />
        </View>
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

        const first = Math.max(0, Math.floor(scrollX / step) - 1);
        const last = Math.min(
          values.length,
          Math.ceil((scrollX + laneWidth) / step) + 1
        );
        if (last <= first) return { id: track.id, d: "" };

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
