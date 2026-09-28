import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ArrowRight, Musicnote } from "../icons";
import { COLORS, TRACK_PALETTE } from "../../constants/theme";
import {
  formatPrice,
  isPackUnlocked,
  localKeyFor,
  type RemoteLoop,
  type RemotePack,
} from "../../constants/loopStore";
import { useLoopStore } from "../../context/LoopStoreContext";
import { useLoopPlayback } from "../../context/LoopPlaybackContext";

// The pieces the Loop Store and a pack's own screen are both built from, so
// a cover, a price button and a loop row look the same wherever they appear.
// Apple Music for the layout, a shop for the buying: every row says what it
// costs and has the button to get it.

/* -------------------------------------------------------------------------- */
/* Covers                                                                      */
/* -------------------------------------------------------------------------- */

// The catalogue carries no artwork, so every pack gets a cover built from one
// of the track colours -- picked from its id, so a pack keeps the same colour
// every time the store loads and two packs side by side usually differ.
const coverColorFor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TRACK_PALETTE[Math.abs(hash) % TRACK_PALETTE.length];
};

/** The same colour pushed toward black, for the far end of the cover's gradient. */
const shade = (hex: string, amount: number) => {
  const channel = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(1)}${channel(3)}${channel(5)}`;
};

export const coverColors = (id: string): [string, string] => {
  const color = coverColorFor(id);
  return [color, shade(color, 0.55)];
};

export function PackCover({ id, size, radius }: { id: string; size: number; radius: number }) {
  return (
    <LinearGradient
      colors={coverColors(id)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Musicnote size={Math.round(size * 0.28)} color="rgba(255,255,255,0.85)" />
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

/** "12 loops" */
export const countOf = (pack: RemotePack) =>
  `${pack.loops.length} ${pack.loops.length === 1 ? "loop" : "loops"}`;

/** Why a paid pack won't download, on tap. */
export const explainLocked = (pack: RemotePack) =>
  Alert.alert(
    pack.title,
    `${formatPrice(pack)}. Buying inside the app isn't available yet — it needs App Store and Play Store purchasing, which is coming. Free packs download today.`
  );

/**
 * The one short fact about a pack's state: how much of it is on the phone once
 * a download has started, the price before that.
 */
export function usePackStatus(pack: RemotePack) {
  const { isDownloaded } = useLoopStore();
  const downloaded = pack.loops.filter(isDownloaded).length;
  if (downloaded === pack.loops.length) return { text: "Downloaded", color: COLORS.success };
  if (downloaded > 0) return { text: `${downloaded}/${pack.loops.length}`, color: COLORS.success };
  return {
    text: formatPrice(pack),
    color: isPackUnlocked(pack) ? COLORS.brandFrom : COLORS.textMuted,
  };
}

/**
 * An Apple Music section heading: bold title, and a chevron when the section
 * leads somewhere.
 */
export function SectionTitle({ title, onPress }: { title: string; onPress?: () => void }) {
  const content = (
    <View className="flex-row items-center gap-1">
      <Text className="text-white font-satoshiBold" style={{ fontSize: 22 }}>
        {title}
      </Text>
      {onPress && <ArrowRight size={18} color={COLORS.textMuted} />}
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  ) : (
    content
  );
}

/* -------------------------------------------------------------------------- */
/* Price button                                                                */
/* -------------------------------------------------------------------------- */

type GetState = "idle" | "locked" | "downloading" | "downloaded";

/**
 * The shop button, in every state a download can be in.
 *
 * GET for a free loop, the price for a paid one (tapping it explains why it
 * won't download yet), a spinner with the percentage while it comes down, and
 * LOAD once it's on the phone -- which puts it straight into the Loop player,
 * the way the App Store's OPEN launches the thing you just got.
 */
export function GetButton({
  state,
  price,
  progress,
  onGet,
  onOpen,
  label,
}: {
  state: GetState;
  price: string;
  progress?: number;
  onGet: () => void;
  onOpen: () => void;
  label: string;
}) {
  const downloading = state === "downloading";
  const text = state === "downloaded" ? "Load" : state === "locked" ? price : "Get";
  return (
    <TouchableOpacity
      onPress={state === "downloaded" ? onOpen : onGet}
      disabled={downloading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={
        downloading
          ? `Downloading ${label}`
          : state === "downloaded"
            ? `Load ${label} into the Loop player`
            : state === "locked"
              ? `${label}, ${price}`
              : `Get ${label}`
      }
      className="flex-row items-center justify-center gap-1.5 px-4 rounded-full"
      style={{ minWidth: 76, height: 30, backgroundColor: "rgba(255,255,255,0.12)" }}
    >
      {downloading ? (
        <>
          <ActivityIndicator size="small" color={COLORS.brandFrom} />
          {progress !== undefined && (
            <Text className="text-micro font-spaceBold text-ink-muted">
              {Math.round(progress * 100)}%
            </Text>
          )}
        </>
      ) : (
        <Text
          className="uppercase text-overline font-spaceBold"
          style={{ color: state === "locked" ? COLORS.white : COLORS.brandFrom }}
        >
          {text}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------------------------- */
/* Loop row                                                                    */
/* -------------------------------------------------------------------------- */

const ROW_COVER = 48;

/**
 * One loop with its price button.
 *
 * `leading` is the pack's cover in lists that mix packs (the store's Singles
 * and search results), or the loop's number in a pack's own track list, the
 * way Apple Music numbers an album's songs.
 */
export function LoopRow({
  loop,
  pack,
  leading,
  subtitle,
  last,
}: {
  loop: RemoteLoop;
  pack: RemotePack;
  leading: "cover" | number;
  subtitle: string;
  last: boolean;
}) {
  const router = useRouter();
  const { isDownloaded, progressFor, downloadLoop } = useLoopStore();
  const { setSelectedLoopKey } = useLoopPlayback();
  const unlocked = isPackUnlocked(pack);
  const progress = progressFor(loop);

  // The same confirm Bits asks before loading, then straight to the Loop tab --
  // closing the store screens behind it, so Back from the player doesn't walk
  // you back through the shop.
  const load = () =>
    Alert.alert(
      "Load Loop",
      `Load "${loop.title}" at ${loop.bpm} BPM?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load",
          onPress: () => {
            setSelectedLoopKey(localKeyFor(loop.key));
            router.dismissTo("/(tabs)/loop");
          },
        },
      ],
      { cancelable: true }
    );

  const state: GetState = isDownloaded(loop)
    ? "downloaded"
    : progress !== undefined
      ? "downloading"
      : unlocked
        ? "idle"
        : "locked";

  const start = async () => {
    if (!unlocked) {
      explainLocked(pack);
      return;
    }
    try {
      await downloadLoop(loop);
    } catch (error) {
      Alert.alert(
        "Download failed",
        error instanceof Error ? error.message : "Try again in a moment."
      );
    }
  };

  const withCover = leading === "cover";

  return (
    <View className="flex-row items-center gap-3">
      {withCover ? (
        <PackCover id={pack.id} size={ROW_COVER} radius={6} />
      ) : (
        <Text
          className="text-center text-label text-ink-muted font-satoshiMedium"
          style={{ width: 20 }}
        >
          {leading}
        </Text>
      )}
      {/* The divider starts after the cover or number, the way Apple Music
          insets it. */}
      <View
        className={`flex-1 flex-row items-center gap-3 py-3 ${last ? "" : "border-b border-white/10"}`}
        style={{ minHeight: withCover ? ROW_COVER + 24 : 60 }}
      >
        <View className="flex-1 gap-1">
          <Text className="text-white text-label font-satoshiMedium" numberOfLines={1}>
            {loop.title}
          </Text>
          <Text className="text-ink-muted text-overline font-satoshiRegular" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <GetButton
          state={state}
          price={formatPrice(pack)}
          progress={progress}
          onGet={start}
          onOpen={load}
          label={loop.title}
        />
      </View>
    </View>
  );
}
