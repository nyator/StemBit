import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { COLORS } from "../../constants/theme";

// The waveform of a file the user is importing, with a draggable handle at each
// end of the loop region. Everything outside the region is dimmed, so what will
// actually loop is what looks lit.
//
// The peaks are computed by the audio engine, not here (constants/loopEngine.ts
// "analyze") — it already has the decoded buffer, and nothing in React Native
// can decode audio. They arrive as one already-downsampled value per bar.
//
// Drawn as a single SVG Path rather than a View per bar: a few hundred Views
// costs a frame or two on every drag, one Path costs nothing. Handles stay
// Views, because they're what the finger has to land on.
//
// ZOOM: pinch, or the buttons underneath, and drag the waveform to scroll --
// the same three controls the stem timeline has, because it is the same
// problem. Zoomed out, a few hundred pixels stand in for the whole file, so one
// pixel is tens of milliseconds and an edge can only land NEAR a beat.
//
// This replaced a hold-a-handle-to-zoom gesture that opened a window around one
// edge and dropped it the moment you lifted. It was invisible, it only zoomed
// where the handle already was, and it snapped back before you could check the
// result. A zoom that stays does everything it did: set it once and both
// handles drag at that resolution, against audio you can scroll through.
//
// The view is drawn from a visible time range rather than always from the whole
// file, which is what lets one set of drawing code serve every zoom level.

export const HEIGHT = 66;
const HANDLE_WIDTH = 14;
/** Shortest region the handles will let you make. */
export const MIN_TRIM_SECONDS = 0.3;

/** Zoom stops for the buttons -- the ladder the stem timeline climbs, extended.
 *
 * Further than the timeline's 32 because the jobs differ: there you are placing
 * a marker somewhere inside a bar, here you are putting a loop point on a
 * transient, and a loop that is two milliseconds long at the seam ticks on
 * every pass. */
const ZOOM_STOPS = [1, 2, 4, 8, 16, 32, 64, 128];
const MIN_ZOOM = ZOOM_STOPS[0];
const MAX_ZOOM = ZOOM_STOPS[ZOOM_STOPS.length - 1];

// Pinching reports a continuous scale, and every distinct value re-slices the
// peaks and rebuilds the path. Rounded to this, a pinch across the whole range
// redraws a couple of dozen times rather than once per frame.
const ZOOM_STEP = 0.25;

/**
 * The narrowest the view is allowed to get.
 *
 * A cap on the zoom rather than a fixed number of stops, because how far in the
 * top stop lands depends on how long the file is. Below this a pixel is worth
 * well under a millisecond and the handle stops being able to land on anything
 * the waveform can show.
 */
const MIN_VIEW_SECONDS = 0.08;

// Drag a zoomed edge within this fraction of the view's side and the view starts
// scrolling with it, so the handle is never pushed off the screen it's being
// dragged on. Enough of a gap that the audio ahead is visible before the edge
// reaches it -- scrolling only once the handle is at the very edge would mean
// trimming against audio you haven't seen yet.
const ZOOM_SCROLL_MARGIN = 0.2;

/**
 * The measured audio behind a zoomed view.
 *
 * Deliberately wider than what's on screen. The view scrolls, and re-measuring
 * on every frame of that would mean a round trip to the engine per frame; a
 * buffer a few times the window means scrolling is just re-slicing numbers
 * already in hand, and the engine is only asked again when the view approaches
 * the end of what's been measured.
 */
export type TrimZoom = {
  /** Bounds of the measured audio, seconds into the file. */
  bufferStart: number;
  bufferEnd: number;
  /** Peaks across the buffer. Empty while the engine is still measuring. */
  peaks: number[];
};

/** What the trimmer is showing: a window into the file, or the whole thing. */
export type TrimView = { start: number; end: number } | null;

type WaveformTrimmerProps = {
  /** Peak amplitudes, 0–1, evenly spaced across the whole file. */
  peaks: number[];
  /** Length of the whole file, seconds. */
  duration: number;
  /** The loop region, seconds. */
  start: number;
  end: number;
  classname?: string;
  /** Live during a drag — cheap updates only (readouts). */
  onChange: (start: number, end: number) => void;
  /** Once, on release: reload the preview here, not on every frame. */
  onComplete: (start: number, end: number) => void;
  /**
   * The visible window moved -- zoomed, scrolled, or pulled back out to the
   * whole file, which arrives as null. The parent decides what to measure for
   * it; this component only says what it is looking at.
   */
  onViewChange?: (view: TrimView) => void;
  /** Measured audio for the current window. Null draws from the overview. */
  zoom?: TrimZoom | null;
  /**
   * Where playback has reached, seconds into the file, or null when stopped.
   * Comes off the engine's audio clock, so it marks what is actually being heard
   * rather than where a timer in React thinks it should be.
   */
  playhead?: number | null;
};

export default function WaveformTrimmer({
  peaks,
  duration,
  start,
  end,
  classname,
  onChange,
  onComplete,
  onViewChange,
  zoom,
  playhead,
}: WaveformTrimmerProps) {
  const [width, setWidth] = useState(0);
  // The zoom, as a level and a left edge, rather than as a pair of times. The
  // level is what the buttons step and the pinch scales; the start is what a
  // scroll moves. Held apart because a zoom has to keep its place and a scroll
  // has to keep its magnification.
  const [zoomLevel, setZoomLevel] = useState(MIN_ZOOM);
  const [viewStart, setViewStart] = useState(0);

  // How far in this particular file can go before a pixel stops meaning
  // anything. A four-second loop reaches it long before a four-minute one.
  const maxZoom =
    duration > 0
      ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, duration / MIN_VIEW_SECONDS))
      : MIN_ZOOM;

  const zoomed = zoomLevel > MIN_ZOOM && duration > 0;
  const viewSpan = zoomed ? Math.min(duration, duration / zoomLevel) : duration;
  const clampedStart = Math.min(
    Math.max(0, viewStart),
    Math.max(0, duration - viewSpan)
  );
  const view: TrimView = zoomed
    ? { start: clampedStart, end: clampedStart + viewSpan }
    : null;

  // The responders are built once, so everything they read lives in a ref.
  const widthRef = useRef(0);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const maxZoomRef = useRef(maxZoom);
  maxZoomRef.current = maxZoom;
  const zoomLevelRef = useRef(zoomLevel);
  zoomLevelRef.current = zoomLevel;
  const viewRef = useRef<TrimView>(view);
  viewRef.current = view;
  const boundsRef = useRef({ start, end });
  boundsRef.current = { start, end };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;

  /** Where the drag is measured from, so a move is always relative to the grab. */
  const dragFromRef = useRef({ start, end });

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  };

  // Told once per settled window rather than per frame of a pinch: the parent
  // answers this by asking the engine to measure audio, which is not something
  // to do sixty times a second.
  useEffect(() => {
    onViewChangeRef.current?.(view ? { ...view } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.start, view?.end]);

  /* ---------------------------------------------------------------------- */
  /* Zoom                                                                    */
  /* ---------------------------------------------------------------------- */

  /**
   * Move to a zoom level, keeping whatever is under `anchorX` where it is.
   *
   * Without an anchor a zoom throws away your place: you are looking at the
   * loop's end, you zoom to see it better, and you are now looking at the
   * middle of the file.
   */
  const applyZoom = (next: number, anchorX: number) => {
    const total = durationRef.current;
    const pixels = widthRef.current;
    if (total <= 0 || pixels <= 0) return;

    const level = Math.min(maxZoomRef.current, Math.max(MIN_ZOOM, next));
    const current = viewRef.current;
    const currentSpan = current ? current.end - current.start : total;
    const currentStart = current ? current.start : 0;
    const fraction = anchorX / pixels;
    const at = currentStart + fraction * currentSpan;

    const span = level <= MIN_ZOOM ? total : Math.min(total, total / level);
    const from = Math.min(
      Math.max(0, at - fraction * span),
      Math.max(0, total - span)
    );

    zoomLevelRef.current = level;
    viewRef.current =
      level <= MIN_ZOOM ? null : { start: from, end: from + span };
    setZoomLevel(level);
    setViewStart(from);
  };
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;

  const stepZoom = (direction: 1 | -1) => {
    const stops = direction === 1 ? ZOOM_STOPS : [...ZOOM_STOPS].reverse();
    const next =
      stops.find((stop) =>
        direction === 1 ? stop > zoomLevel + 0.01 : stop < zoomLevel - 0.01
      ) ?? zoomLevel;
    // Anchored on the middle of the view, which is where you are looking when
    // you reach for a zoom button.
    applyZoom(next, widthRef.current / 2);
  };

  // A pinch begins as a single touch, so the scroll responder has already
  // granted by the time the second finger lands. This tells it to stand down
  // rather than scrolling on the centroid of two fingers that are pinching.
  const pinchingRef = useRef(false);
  const pinchStartRef = useRef(MIN_ZOOM);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        // On the JS thread: everything it touches -- the zoom level, the view
        // -- lives there, and a worklet would have to hop back for all of it.
        .runOnJS(true)
        .onStart(() => {
          pinchingRef.current = true;
          pinchStartRef.current = zoomLevelRef.current;
        })
        .onUpdate((event) => {
          const raw = pinchStartRef.current * event.scale;
          const stepped = Math.round(raw / ZOOM_STEP) * ZOOM_STEP;
          applyZoomRef.current(stepped, event.focalX);
        })
        .onFinalize(() => {
          pinchingRef.current = false;
        }),
    []
  );

  /* ---------------------------------------------------------------------- */
  /* Scrolling                                                               */
  /* ---------------------------------------------------------------------- */

  const scrollFromRef = useRef(0);

  // Dragging the waveform moves the view along the file. Only while zoomed --
  // at full view there is nowhere to go, and claiming the gesture anyway would
  // eat the vertical flick that scrolls the page this sits on.
  //
  // Never claimed on touch-down, and only once the finger has travelled
  // sideways, for the same reason. A handle that already has the gesture keeps
  // it: they refuse termination.
  const scrollResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          !!viewRef.current &&
          Math.abs(gesture.dx) > 4 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          scrollFromRef.current = viewRef.current?.start ?? 0;
        },
        onPanResponderMove: (_event, gesture) => {
          if (pinchingRef.current) return;
          const current = viewRef.current;
          const total = durationRef.current;
          const pixels = widthRef.current;
          if (!current || pixels <= 0) return;

          const span = current.end - current.start;
          // Against the finger: dragging left walks forward through the file,
          // the way dragging a piece of paper does.
          const from = Math.min(
            Math.max(0, scrollFromRef.current - (gesture.dx / pixels) * span),
            Math.max(0, total - span)
          );
          viewRef.current = { start: from, end: from + span };
          setViewStart(from);
        },
      }),
    []
  );

  // Slide the view so a dragged edge stays on screen with room ahead of it. Only
  // when it comes near a side -- the handle moves freely through the middle,
  // which is what makes the scroll feel like the view getting out of the way
  // rather than the waveform sliding under a stuck handle.
  const scrollToKeep = (at: number) => {
    const current = viewRef.current;
    const total = durationRef.current;
    if (!current || total <= 0) return;

    const span = current.end - current.start;
    const margin = span * ZOOM_SCROLL_MARGIN;
    let from = current.start;

    if (at < current.start + margin) from = at - margin;
    else if (at > current.end - margin) from = at + margin - span;
    else return;

    from = Math.min(Math.max(0, from), Math.max(0, total - span));
    if (Math.abs(from - current.start) < 0.0001) return;

    viewRef.current = { start: from, end: from + span };
    setViewStart(from);
  };

  /* ---------------------------------------------------------------------- */
  /* Trimming                                                                */
  /* ---------------------------------------------------------------------- */

  // Where this edge lands after travelling `dx` pixels from where it was
  // anchored. Each edge stops MIN_TRIM_SECONDS short of the other rather than
  // passing it, so the handles can't cross and produce an inside-out region.
  //
  // What a pixel is worth is the only thing the zoom changes here: a fraction of
  // the visible window rather than of the whole file. The edge itself is free to
  // travel the whole file either way -- the view scrolls to follow it.
  const resolve = (edge: "start" | "end", dx: number) => {
    const total = durationRef.current;
    const pixels = widthRef.current;
    if (pixels <= 0 || total <= 0) return boundsRef.current;

    const window = viewRef.current;
    const visible = window ? window.end - window.start : total;
    const delta = (dx / pixels) * visible;
    const from = dragFromRef.current;

    if (edge === "start") {
      const limit = Math.max(0, from.end - MIN_TRIM_SECONDS);
      return {
        start: Math.min(limit, Math.max(0, from.start + delta)),
        end: from.end,
      };
    }

    const limit = Math.min(total, from.start + MIN_TRIM_SECONDS);
    return {
      start: from.start,
      end: Math.max(limit, Math.min(total, from.end + delta)),
    };
  };

  const makeResponder = (edge: "start" | "end") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The trimmer sits in a ScrollView, and the waveform behind it now takes
      // horizontal drags of its own; without this either would steal a drag
      // mid-gesture and the edge would stick where it was.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragFromRef.current = boundsRef.current;
      },
      onPanResponderMove: (_event, gesture) => {
        const next = resolve(edge, gesture.dx);
        boundsRef.current = next;
        scrollToKeep(edge === "start" ? next.start : next.end);
        onChangeRef.current(next.start, next.end);
      },
      onPanResponderRelease: () => {
        onCompleteRef.current(boundsRef.current.start, boundsRef.current.end);
      },
      onPanResponderTerminate: () => {
        onCompleteRef.current(boundsRef.current.start, boundsRef.current.end);
      },
    });

  const startResponder = useMemo(() => makeResponder("start"), []);
  const endResponder = useMemo(() => makeResponder("end"), []);

  /**
   * Put the nearer edge of the region on the moment that was tapped.
   *
   * Without this a zoomed view is a trap. An edge that has been scrolled off
   * the side draws no grip -- deliberately, since a grip pinned to the frame
   * would claim the region ends there -- so there is nothing left to drag, and
   * the only way to move an edge somewhere distant is to haul it the whole way
   * with the view scrolling along behind it. Which is to say: you could not
   * simply go to 0:00 and put the start there.
   *
   * The nearer edge, because that is unambiguous wherever you tap: outside the
   * region it is the edge you are outside of, and inside it is whichever half
   * you tapped. Committed immediately rather than on a release, because a tap
   * has no drag to finish.
   */
  const placeEdgeAt = (x: number) => {
    const total = durationRef.current;
    const pixels = widthRef.current;
    if (pixels <= 0 || total <= 0) return;

    const window = viewRef.current;
    const from = window ? window.start : 0;
    const span = window ? window.end - window.start : total;
    const at = Math.max(0, Math.min(total, from + (x / pixels) * span));

    const bounds = boundsRef.current;
    const next =
      Math.abs(at - bounds.start) <= Math.abs(at - bounds.end)
        ? {
            start: Math.min(at, Math.max(0, bounds.end - MIN_TRIM_SECONDS)),
            end: bounds.end,
          }
        : {
            start: bounds.start,
            end: Math.max(
              at,
              Math.min(total, bounds.start + MIN_TRIM_SECONDS)
            ),
          };

    boundsRef.current = next;
    onChangeRef.current(next.start, next.end);
    onCompleteRef.current(next.start, next.end);
  };
  const placeEdgeAtRef = useRef(placeEdgeAt);
  placeEdgeAtRef.current = placeEdgeAt;

  // Composed rather than nested: a tap and a pinch never mean the same gesture,
  // so whichever the fingers turn out to be doing wins outright.
  const gestures = useMemo(
    () =>
      Gesture.Race(
        pinch,
        Gesture.Tap()
          .runOnJS(true)
          .onEnd((event) => placeEdgeAtRef.current(event.x))
      ),
    [pinch]
  );

  /* ---------------------------------------------------------------------- */
  /* Drawing                                                                 */
  /* ---------------------------------------------------------------------- */

  const viewFrom = view ? view.start : 0;
  const viewTo = view ? view.end : duration;
  const visibleSpan = Math.max(0.0001, viewTo - viewFrom);

  // Sliced from the buffer, so scrolling costs nothing but an array slice. Until
  // the engine's measurements land, the overview's own peaks are stretched across
  // the window instead -- blocky, but it keeps the shape of the audio under the
  // finger rather than blanking the view.
  const viewPeaks = zoomed
    ? zoom && zoom.peaks.length > 0
      ? sliceBuffer(zoom, viewFrom, viewTo)
      : sliceForWindow(peaks, duration, viewFrom, viewTo)
    : peaks;

  const toX = (seconds: number) =>
    width > 0 ? ((seconds - viewFrom) / visibleSpan) * width : 0;

  const startX = toX(start);
  const endX = toX(end);
  // An edge scrolled off the side has no handle to draw: a grip pinned to the
  // frame would claim the region ends there, which is the one thing this view
  // must never say.
  const showStartHandle = startX >= -HANDLE_WIDTH && startX <= width + HANDLE_WIDTH;
  const showEndHandle = endX >= -HANDLE_WIDTH && endX <= width + HANDLE_WIDTH;

  const playX = playhead == null ? 0 : toX(playhead);
  const playVisible =
    playhead != null && width > 0 && playX >= 0 && playX <= width;

  const zoomLabel = zoomed
    ? `${zoomLevel.toFixed(2).replace(/\.?0+$/, "")}×`
    : "FIT";

  return (
    <View onLayout={handleLayout} style={{ width: "100%" }} className={classname}>
      {/* The pan responder sits on an inner view rather than on the detector's
          own child. Gesture-handler attaches natively to the element it is
          given, and the legacy responder system on that same element is the
          arrangement where one of them quietly wins -- which is what left the
          waveform unscrollable. The stem timeline layers them the same way. */}
      <GestureDetector gesture={gestures}>
        <View style={{ height: HEIGHT, justifyContent: "center" }}>
          <View
            {...scrollResponder.panHandlers}
            style={{ height: HEIGHT, justifyContent: "center" }}
          >
          {width > 0 && (
            <Svg width={width} height={HEIGHT}>
              <Rect
                x={0}
                y={0}
                width={width}
                height={HEIGHT}
                rx={10}
                fill={COLORS.surfaceSunken}
              />
              <Path
                d={buildPath(viewPeaks, width, HEIGHT)}
                stroke={COLORS.brandFrom}
                strokeWidth={zoomed ? 1.2 : 1.4}
              />
              {/* Dim what won't loop. Clamped, so an edge off the side of a
                  zoomed window still dims the right side of what is on screen. */}
              <Rect
                x={0}
                y={0}
                width={Math.max(0, Math.min(width, startX))}
                height={HEIGHT}
                fill="rgba(16,17,22,0.72)"
              />
              <Rect
                x={Math.max(0, Math.min(width, endX))}
                y={0}
                width={Math.max(0, width - Math.max(0, Math.min(width, endX)))}
                height={HEIGHT}
                fill="rgba(16,17,22,0.72)"
              />
              {/* The kept region's edges. */}
              <Rect
                x={Math.max(0, Math.min(width, startX))}
                y={0}
                width={Math.max(
                  1,
                  Math.min(width, endX) - Math.max(0, Math.min(width, startX))
                )}
                height={HEIGHT}
                rx={4}
                fill="none"
                stroke={COLORS.brand}
                strokeWidth={1.5}
              />
              {/* The playhead. Drawn last so it reads over the dimming and the
                  region outline -- it's the one thing on here that moves, and it
                  answers "where am I hearing" at a glance. */}
              {playVisible && (
                <Line
                  x1={playX}
                  y1={0}
                  x2={playX}
                  y2={HEIGHT}
                  stroke={COLORS.white}
                  strokeWidth={2}
                />
              )}
            </Svg>
          )}

          {/* Handles. Centred on their edge and wider than they look, so the grip
              is a thumb-sized target over a 1.5px line. */}
          {width > 0 && (
            <>
              {showStartHandle && (
                <Handle
                  x={startX - HANDLE_WIDTH / 2}
                  responder={startResponder}
                  label="Loop start"
                  hint="Drag to trim, or tap the waveform to move this edge there."
                />
              )}
              {showEndHandle && (
                <Handle
                  x={endX - HANDLE_WIDTH / 2}
                  responder={endResponder}
                  label="Loop end"
                  hint="Drag to trim, or tap the waveform to move this edge there."
                />
              )}
            </>
          )}
          </View>
        </View>
      </GestureDetector>

      {/* Zoom, with the pinch it mirrors. Buttons as well as the gesture because
          a pinch is a two-handed move and this is a one-handed screen as often
          as not -- and because "one step in" is a thing you can ask for exactly,
          which a pinch never is. */}
      <View className="flex-row items-center mt-2">
        <Text
          className="flex-1 text-nav font-satoshiRegular"
          style={{ color: zoomed ? COLORS.brand : COLORS.textMuted }}
          numberOfLines={1}
        >
          {zoomed
            ? `${formatWindow(visibleSpan)} view · ${msPerPixel(visibleSpan, width)}ms per pixel · drag to scroll, tap to place`
            : "Pinch to zoom in. Tap the waveform to move the nearest edge there."}
        </Text>

        <ZoomButton
          label="−"
          disabled={zoomLevel <= MIN_ZOOM}
          onPress={() => stepZoom(-1)}
          accessibilityLabel="Zoom out"
        />
        <View style={{ width: 42, alignItems: "center" }}>
          <Text className="text-nav text-white font-spaceBold">
            {zoomLabel}
          </Text>
        </View>
        <ZoomButton
          label="+"
          disabled={zoomLevel >= maxZoom - 0.01}
          onPress={() => stepZoom(1)}
          accessibilityLabel="Zoom in"
        />
      </View>
    </View>
  );
}

// One "M x y1 L x y2" per bar, mirrored around the middle. Bars shorter than a
// pixel are floored to one so silence reads as a line rather than a gap.
function buildPath(peaks: number[], width: number, height: number) {
  if (width <= 0 || peaks.length === 0) return "";
  const middle = height / 2;
  const step = width / peaks.length;
  return peaks
    .map((peak, index) => {
      const x = (index + 0.5) * step;
      const half = Math.max(0.5, peak * (middle - 4));
      return `M${x.toFixed(2)} ${(middle - half).toFixed(2)}L${x.toFixed(2)} ${(
        middle + half
      ).toFixed(2)}`;
    })
    .join("");
}

// The part of the measured buffer the view is over. This is what makes scrolling
// free: the audio either side of the window has already been measured, so sliding
// is an array slice rather than a round trip to the engine.
export function sliceBuffer(zoom: TrimZoom, from: number, to: number) {
  const span = zoom.bufferEnd - zoom.bufferStart;
  const count = zoom.peaks.length;
  if (span <= 0 || count === 0) return zoom.peaks;

  const perSecond = count / span;
  // Both ends clamped into the buffer, and the far end kept at least one bucket
  // past the near one. A window narrower than a bucket, or one that has scrolled
  // clear of what's been measured, would otherwise come back empty and blank the
  // view for as long as the finger is there.
  const first = Math.min(
    count - 1,
    Math.max(0, Math.floor((from - zoom.bufferStart) * perSecond))
  );
  const last = Math.min(
    count,
    Math.max(first + 1, Math.ceil((to - zoom.bufferStart) * perSecond))
  );
  return zoom.peaks.slice(first, last);
}

// The overview's buckets that fall inside a window. Only a stand-in until the
// engine sends the window measured properly -- at this magnification it's a
// handful of bars stretched wide, which is why it isn't what gets trimmed against.
function sliceForWindow(
  peaks: number[],
  duration: number,
  from: number,
  to: number
) {
  if (peaks.length === 0 || duration <= 0) return peaks;
  const first = Math.floor((from / duration) * peaks.length);
  const last = Math.ceil((to / duration) * peaks.length);
  return peaks.slice(Math.max(0, first), Math.max(first + 1, last));
}

const formatWindow = (seconds: number) =>
  seconds >= 1 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds * 1000)}ms`;

const msPerPixel = (seconds: number, width: number) =>
  width > 0 ? ((seconds / width) * 1000).toFixed(1) : "—";

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

type HandleProps = {
  x: number;
  responder: ReturnType<typeof PanResponder.create>;
  label: string;
  hint?: string;
};

function Handle({ x, responder, label, hint }: HandleProps) {
  return (
    <View
      {...responder.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={{ top: 8, bottom: 8, left: 10, right: 10 }}
      style={{
        position: "absolute",
        left: x,
        top: 0,
        width: HANDLE_WIDTH,
        height: HEIGHT,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: 4,
          height: HEIGHT,
          borderRadius: 2,
          backgroundColor: COLORS.white,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: HANDLE_WIDTH,
          height: 22,
          borderRadius: 4,
          backgroundColor: COLORS.white,
        }}
      />
    </View>
  );
}
