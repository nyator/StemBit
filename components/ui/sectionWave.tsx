import { useMemo, useRef } from "react";
import { PanResponder, Text, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { COLORS } from "../../constants/theme";
import type { CueSection } from "../../context/SessionsContext";

// The song's shape, with its sections marked on it.
//
// Marking by ear alone -- play, tap when the chorus arrives -- is only ever as
// accurate as your reaction, and a marker half a second late launches half a
// second late every time it's used after that. Seeing the waveform turns it
// into a placement rather than a reflex: the arrangement is visible in the
// audio, and a marker can be dragged onto the transient it belongs on.
//
// Drawn as one SVG Path rather than a View per bar, the same choice
// waveformTrimmer made: a few hundred Views cost a frame on every drag, one
// Path costs nothing.

const HEIGHT = 96;
// Wide enough to grab with a fingertip, on either side of the line.
const HANDLE_TOUCH_WIDTH = 32;

type SectionWaveProps = {
  /** One value per bucket, 0–1, from the engine. */
  peaks: number[];
  /** Length of the song in seconds, for converting x to time. */
  duration: number;
  sections: CueSection[];
  /** Seconds the transport has reached, or null when stopped. */
  playhead: number | null;
  /** Section being edited, drawn brighter and the one a drag moves. */
  selectedId: string | null;
  onSelect: (sectionId: string | null) => void;
  /** A marker was dragged. Seconds, already clamped to the song. */
  onMove: (sectionId: string, seconds: number) => void;
  /** The waveform was tapped where there is no marker. */
  onAddAt: (seconds: number) => void;
  width: number;
};

export default function SectionWave({
  peaks,
  duration,
  sections,
  playhead,
  selectedId,
  onSelect,
  onMove,
  onAddAt,
  width,
}: SectionWaveProps) {
  // Built once per set of peaks. Recomputing this on every drag frame is what
  // makes a waveform feel heavy.
  const path = useMemo(() => {
    if (peaks.length === 0) return "";
    const middle = HEIGHT / 2;
    const step = width / peaks.length;

    // Mirrored around the centre line, so it reads as audio rather than as a
    // bar chart.
    let top = `M 0 ${middle}`;
    let bottom = "";
    peaks.forEach((peak, index) => {
      const x = index * step;
      const half = Math.max(0.5, peak * (HEIGHT / 2 - 4));
      top += ` L ${x.toFixed(1)} ${(middle - half).toFixed(1)}`;
      bottom = ` L ${x.toFixed(1)} ${(middle + half).toFixed(1)}${bottom}`;
    });

    return `${top}${bottom} Z`;
  }, [peaks, width]);

  const secondsAt = (x: number) =>
    duration > 0 ? Math.max(0, Math.min(duration, (x / width) * duration)) : 0;
  const xOf = (seconds: number) =>
    duration > 0 ? (seconds / duration) * width : 0;

  // Which marker a touch landed on, if any. Nearest within a fingertip, so a
  // slightly-off grab moves the marker rather than creating a new one on top
  // of it.
  const markerAt = (x: number) => {
    let closest: CueSection | null = null;
    let best = HANDLE_TOUCH_WIDTH / 2;
    for (const section of sections) {
      const distance = Math.abs(xOf(section.startSeconds) - x);
      if (distance <= best) {
        best = distance;
        closest = section;
      }
    }
    return closest;
  };

  // Refs, because a PanResponder is built once and would otherwise capture the
  // first render's sections and callbacks forever.
  const stateRef = useRef({ sections, onMove, onAddAt, onSelect, duration, width });
  stateRef.current = { sections, onMove, onAddAt, onSelect, duration, width };
  const draggingRef = useRef<string | null>(null);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const x = event.nativeEvent.locationX;
          const hit = markerAt(x);
          if (hit) {
            draggingRef.current = hit.id;
            stateRef.current.onSelect(hit.id);
          } else {
            draggingRef.current = null;
            // A tap on empty waveform places a section there. Placing is the
            // common action on this screen; selecting is not.
            stateRef.current.onAddAt(secondsAt(x));
          }
        },
        onPanResponderMove: (event) => {
          const id = draggingRef.current;
          if (!id) return;
          stateRef.current.onMove(id, secondsAt(event.nativeEvent.locationX));
        },
        onPanResponderRelease: () => {
          draggingRef.current = null;
        },
        onPanResponderTerminate: () => {
          draggingRef.current = null;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (peaks.length === 0) {
    return (
      <View
        className="items-center justify-center border rounded-lg border-hairline"
        style={{ height: HEIGHT, width }}
      >
        <Text className="text-micro text-ink-muted font-satoshiRegular">
          Measuring the song…
        </Text>
      </View>
    );
  }

  return (
    <View {...responder.panHandlers} style={{ width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        <Rect x={0} y={0} width={width} height={HEIGHT} fill={COLORS.surface} rx={8} />
        <Path d={path} fill={COLORS.brandFrom} opacity={0.55} />

        {/* Played-so-far shading, so the playhead reads as progress rather than
            a line that happens to be somewhere. */}
        {playhead !== null && (
          <Rect
            x={0}
            y={0}
            width={Math.max(0, xOf(playhead))}
            height={HEIGHT}
            fill={COLORS.white}
            opacity={0.08}
          />
        )}

        {sections.map((section) => {
          const x = xOf(section.startSeconds);
          const isSelected = selectedId === section.id;
          return (
            <Line
              key={section.id}
              x1={x}
              y1={0}
              x2={x}
              y2={HEIGHT}
              stroke={isSelected ? COLORS.warning : COLORS.white}
              strokeWidth={isSelected ? 3 : 2}
              opacity={isSelected ? 1 : 0.75}
            />
          );
        })}

        {playhead !== null && (
          <Line
            x1={xOf(playhead)}
            y1={0}
            x2={xOf(playhead)}
            y2={HEIGHT}
            stroke={COLORS.brand}
            strokeWidth={2}
          />
        )}
      </Svg>
    </View>
  );
}
