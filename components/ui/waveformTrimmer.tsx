import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Text, View, type LayoutChangeEvent } from "react-native";
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
// HOLD TO ZOOM: keep a handle pressed and this same view expands to about a
// second around that edge, at the engine's full resolution; lift and it's the
// whole file again. Zoomed out, a few hundred pixels stand in for minutes of
// audio, so one pixel is tens of milliseconds and an edge can only land NEAR a
// beat. Held, a pixel is a couple of milliseconds -- finer than the nudge
// buttons -- and the same drag that opened the zoom keeps going at that scale.
//
// The view is drawn from a visible time range rather than always from the whole
// file, which is what lets one set of drawing code serve both.

export const HEIGHT = 66;
const HANDLE_WIDTH = 14;
/** Shortest region the handles will let you make. */
export const MIN_TRIM_SECONDS = 0.3;
/** Hold this long on a handle to zoom in. */
const LONG_PRESS_MS = 320;
/** Move more than this during the hold and it's a drag, not a hold. */
const LONG_PRESS_SLOP = 6;
// Drag a zoomed edge within this fraction of the view's side and the view starts
// scrolling with it, so the handle is never pushed off the screen it's being
// dragged on. Enough of a gap that the audio ahead is visible before the edge
// reaches it -- scrolling only once the handle is at the very edge would mean
// trimming against audio you haven't seen yet.
const ZOOM_SCROLL_MARGIN = 0.2;

/**
 * The measured audio behind a zoomed view.
 *
 * Deliberately wider than what's on screen. The view scrolls when a dragged edge
 * nears its side, and re-measuring on every frame of that would mean a round trip
 * to the engine per frame; a buffer a few times the window means scrolling is
 * just re-slicing numbers already in hand, and the engine is only asked again
 * when the view approaches the end of what's been measured.
 */
export type TrimZoom = {
  edge: "start" | "end";
  /** Bounds of the measured audio, seconds into the file. */
  bufferStart: number;
  bufferEnd: number;
  /** Peaks across the buffer. Empty while the engine is still measuring. */
  peaks: number[];
  /**
   * A wider buffer already asked for, if the view has scrolled far enough to need
   * one. Held apart from the bounds above so the peaks on screen keep being drawn
   * against the range they were measured over — swapping the bounds early would
   * shift the waveform sideways under the finger.
   */
  pending?: { start: number; end: number };
  /** Where the edge was when the zoom opened, for the "you started here" mark. */
  origin: number;
  /** How wide a slice of the buffer to show. */
  windowSeconds: number;
};

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
  /** A handle has been held down: the parent opens a window around that edge. */
  onEdgeLongPress?: (edge: "start" | "end") => void;
  /** Called when the finger lifts, so the parent drops the zoom. */
  onEdgeRelease?: () => void;
  /**
   * The view has scrolled to here and is running out of measured audio. The
   * parent decides whether that warrants asking the engine for more.
   */
  onNeedPeaks?: (viewStart: number, viewEnd: number) => void;
  /** Set while zoomed in; null draws the whole file. */
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
  onEdgeLongPress,
  onEdgeRelease,
  onNeedPeaks,
  zoom,
  playhead,
}: WaveformTrimmerProps) {
  const [width, setWidth] = useState(0);
  // The slice of the buffer on screen. It lives here rather than with the peaks
  // because it moves on every frame of a drag, while the peaks behind it only
  // need replacing when the view runs off the end of them.
  const [view, setView] = useState<{ start: number; end: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // The responders are built once, so everything they read lives in a ref.
  const widthRef = useRef(0);
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const boundsRef = useRef({ start, end });
  boundsRef.current = { start, end };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onEdgeLongPressRef = useRef(onEdgeLongPress);
  onEdgeLongPressRef.current = onEdgeLongPress;
  const onEdgeReleaseRef = useRef(onEdgeRelease);
  onEdgeReleaseRef.current = onEdgeRelease;
  const onNeedPeaksRef = useRef(onNeedPeaks);
  onNeedPeaksRef.current = onNeedPeaks;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Where the drag is measured from. Re-anchored when the zoom opens mid-gesture:
  // the pixels travelled before the hold fired mean something completely
  // different once a pixel is worth 2ms instead of 60, and folding them in would
  // yank the edge as the view expands.
  const dragFromRef = useRef({ start, end });
  const anchorDxRef = useRef(0);
  const lastDxRef = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const makeResponder = (edge: "start" | "end") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The trimmer sits in a ScrollView; without this a vertical flick that
      // starts on a handle is stolen mid-drag and the edge sticks where it was.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragFromRef.current = boundsRef.current;
        anchorDxRef.current = 0;
        lastDxRef.current = 0;
        cancelLongPress();
        longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null;
          // Re-anchor here, then let the parent expand the view around the edge.
          dragFromRef.current = boundsRef.current;
          anchorDxRef.current = lastDxRef.current;
          onEdgeLongPressRef.current?.(edge);
        }, LONG_PRESS_MS);
      },
      onPanResponderMove: (_event, gesture) => {
        lastDxRef.current = gesture.dx;
        // Past the slop this is a drag, so the hold doesn't also fire.
        if (
          longPressTimer.current &&
          (Math.abs(gesture.dx) > LONG_PRESS_SLOP ||
            Math.abs(gesture.dy) > LONG_PRESS_SLOP)
        ) {
          cancelLongPress();
        }
        const next = resolve(edge, gesture.dx - anchorDxRef.current);
        boundsRef.current = next;
        scrollToKeep(edge === "start" ? next.start : next.end);
        onChangeRef.current(next.start, next.end);
      },
      onPanResponderRelease: () => {
        cancelLongPress();
        onCompleteRef.current(boundsRef.current.start, boundsRef.current.end);
        setView(null);
        onEdgeReleaseRef.current?.();
      },
      onPanResponderTerminate: () => {
        cancelLongPress();
        onCompleteRef.current(boundsRef.current.start, boundsRef.current.end);
        setView(null);
        onEdgeReleaseRef.current?.();
      },
    });

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

    const next = { start: from, end: from + span };
    viewRef.current = next;
    setView(next);
    onNeedPeaksRef.current?.(next.start, next.end);
  };

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

  const startResponder = useMemo(() => makeResponder("start"), []);
  const endResponder = useMemo(() => makeResponder("end"), []);

  // Open the window on the edge when the parent grants a zoom, and drop it when
  // the zoom goes. Sized here because the parent owns how wide a zoom is.
  useEffect(() => {
    if (!zoom) {
      viewRef.current = null;
      setView(null);
      return;
    }
    if (viewRef.current) return; // already open; peaks arriving is not a re-open

    const span = Math.min(zoom.windowSeconds, Math.max(0.05, duration));
    const from = Math.min(
      Math.max(0, zoom.origin - span / 2),
      Math.max(0, duration - span)
    );
    viewRef.current = { start: from, end: from + span };
    setView(viewRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // What's on screen: the whole file, or the slice of the buffer the view is over.
  const zoomed = !!zoom && !!view;
  const viewStart = zoomed ? view!.start : 0;
  const viewEnd = zoomed ? view!.end : duration;
  const viewSpan = Math.max(0.0001, viewEnd - viewStart);
  // Sliced from the buffer, so scrolling costs nothing but an array slice. Until
  // the engine's measurements land, the overview's own peaks are stretched across
  // the window instead -- blocky, but it keeps the shape of the audio under the
  // finger rather than blanking the view.
  const viewPeaks = zoomed
    ? zoom!.peaks.length > 0
      ? sliceBuffer(zoom!, viewStart, viewEnd)
      : sliceForWindow(peaks, duration, viewStart, viewEnd)
    : peaks;

  const toX = (seconds: number) =>
    width > 0 ? ((seconds - viewStart) / viewSpan) * width : 0;

  const startX = toX(start);
  const endX = toX(end);
  const activeEdge = zoomed ? zoom!.edge : undefined;
  // Both edges are drawn wherever they fall on screen, but only the one under
  // the finger keeps its grip while zoomed.
  const showStartHandle = !zoomed || activeEdge === "start";
  const showEndHandle = !zoomed || activeEdge === "end";
  // Where this edge was when the zoom opened. At this magnification the waveform
  // gives no landmarks, so without it there's no reading how far it's been moved.
  const originX = zoomed ? toX(zoom!.origin) : 0;
  const originVisible = zoomed && originX >= 0 && originX <= width;

  const playX = playhead == null ? 0 : toX(playhead);
  const playVisible =
    playhead != null && width > 0 && playX >= 0 && playX <= width;

  return (
    <View onLayout={handleLayout} style={{ width: "100%" }} className={classname}>
      <View style={{ height: HEIGHT, justifyContent: "center"}}>
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
              strokeWidth={zoom ? 1.2 : 1.4}
            />
            {/* Dim what won't loop. Clamped, so an edge off the side of a zoomed
                window still dims the right side of what is on screen. */}
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
            {originVisible && (
              <Line
                x1={originX}
                y1={0}
                x2={originX}
                y2={HEIGHT}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth={1}
                strokeDasharray="2 4"
              />
            )}
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
                hint="Hold to zoom in for a finer trim"
                active={activeEdge === "start"}
              />
            )}
            {showEndHandle && (
              <Handle
                x={endX - HANDLE_WIDTH / 2}
                responder={endResponder}
                label="Loop end"
                hint="Hold to zoom in for a finer trim"
                active={activeEdge === "end"}
              />
            )}
          </>
        )}
      </View>

      <Text
        className="mt-2 text-[10px] font-satoshiRegular"
        style={{ color: zoomed ? COLORS.brand : COLORS.textMuted }}
      >
        {zoomed
          ? `${formatWindow(viewSpan)} view · ${(activeEdge === "start"
            ? start
            : end
          ).toFixed(3)}s · ${msPerPixel(viewSpan, width)}ms per pixel`
          : "Hold a handle to zoom in for a finer trim."}
      </Text>
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

type HandleProps = {
  x: number;
  responder: ReturnType<typeof PanResponder.create>;
  label: string;
  hint?: string;
  active?: boolean;
};

function Handle({ x, responder, label, hint, active }: HandleProps) {
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
          backgroundColor: active ? COLORS.brand : COLORS.white,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: HANDLE_WIDTH,
          height: 22,
          borderRadius: 4,
          backgroundColor: active ? COLORS.brand : COLORS.white,
        }}
      />
    </View>
  );
}
