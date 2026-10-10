import { useState } from "react";
import { ActivityIndicator, Alert, Image, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { ArrowRight, Musicnote } from "../icons";
import { COLORS } from "../../constants/theme";
import {
  coverUrlFor,
  formatPrice,
  formatSpecOf,
  isPackUnlocked,
  localKeyFor,
  type RemoteLoop,
  type RemotePack,
} from "../../constants/loopStore";
import { useLoopStore } from "../../context/LoopStoreContext";
import { useLoopPlayback } from "../../context/LoopPlaybackContext";

// The pieces the Loop Store and a pack's own screen are both built from, so
// a cover, a price tag, a product card and a loop row look the same wherever
// they appear. A digital shop throughout: artwork first, the price on every
// product, and the button to get it on every row.

/* -------------------------------------------------------------------------- */
/* Covers                                                                      */
/* -------------------------------------------------------------------------- */

// A pack's cover is its artwork from the bucket. Without one -- an older
// manifest, or an image that fails to load -- it gets a placeholder in the
// app's own blues, so a missing cover reads as part of StemBits rather than as
// somebody else's artwork. The pair is picked from the pack's id, so a pack
// keeps the same placeholder every time the store loads and two side by side
// usually differ.
const COVER_GRADIENTS: [string, string][] = [
  [COLORS.brandFrom, COLORS.brandTo],
  [COLORS.brand, COLORS.glow],
  [COLORS.brandTo, COLORS.surfaceSheet],
  [COLORS.glow, COLORS.canvas],
];

export const coverColors = (id: string): [string, string] => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
};

export function PackCover({
  pack,
  size,
  radius,
}: {
  pack: RemotePack;
  size: number;
  radius: number;
}) {
  const uri = coverUrlFor(pack);
  // Remembered per URL rather than as a flag, so a refreshed manifest that
  // fixes a broken cover path gets a fresh attempt instead of the old failure.
  const [failedUri, setFailedUri] = useState<string>();

  if (uri && failedUri !== uri) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailedUri(uri)}
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          // The colour the generated cover would have, while the art loads, so
          // a slow connection shows tinted squares rather than holes.
          backgroundColor: coverColors(pack.id)[1],
        }}
      />
    );
  }

  return (
    <LinearGradient
      colors={coverColors(pack.id)}
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
export function SectionTitle({
  title,
  caption,
  onPress,
}: {
  title: string;
  /** One muted line under the title: what the shelf is, or how many. */
  caption?: string;
  onPress?: () => void;
}) {
  const content = (
    <View>
      <View className="flex-row items-center gap-1">
        <Text className="text-white font-satoshiBold" style={{ fontSize: 18 }}>
          {title}
        </Text>
        {onPress && <ArrowRight size={18} color={COLORS.textMuted} />}
      </View>
      {caption && (
        <Text className="text-overline text-ink-muted font-satoshiRegular">{caption}</Text>
      )}
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
/* Product card                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The price, or the download state, as a tag sitting on a cover -- where a
 * digital shop puts it, so it reads at a glance across a grid of artwork. Dark
 * glass behind it so it holds up on any cover, light or dark.
 */
export function PriceTag({ pack }: { pack: RemotePack }) {
  const status = usePackStatus(pack);
  return (
    <View
      className="px-2.5 py-1 rounded-full"
      style={{ backgroundColor: "rgba(0,0,0,0.62)", borderWidth: 1, borderColor: COLORS.borderGlass }}
    >
      <Text
        className="uppercase text-micro font-spaceBold"
        style={{ color: status.color === COLORS.textMuted ? COLORS.white : status.color }}
        numberOfLines={1}
      >
        {status.text}
      </Text>
    </View>
  );
}

/** "12 loops · WAV" -- the count, then the format when the pack states one. */
export const productMetaOf = (pack: RemotePack) => {
  const format = formatSpecOf(pack).split(" · ")[0];
  return format ? `${countOf(pack)} · ${format}` : countOf(pack);
};

/**
 * One product in a grid or on a shelf: artwork with the price on it, then
 * title, artist and what's in the box. The whole card opens the pack.
 */
export function ProductCard({
  pack,
  width,
  onPress,
}: {
  pack: RemotePack;
  width: number;
  onPress: () => void;
}) {
  const status = usePackStatus(pack);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${pack.title} by ${pack.artist}, ${productMetaOf(pack)}, ${status.text}`}
      style={{ width }}
      className="gap-2"
    >
      <View>
        <PackCover pack={pack} size={width} radius={22} />
        <View style={{ position: "absolute", left: 8, bottom: 8 }}>
          <PriceTag pack={pack} />
        </View>
      </View>
      <View>
        <Text className="text-white text-label font-satoshiBold" numberOfLines={1}>
          {pack.title}
        </Text>
        <Text className="text-ink-muted text-label font-satoshiRegular" numberOfLines={1}>
          {pack.artist}
        </Text>
        <Text className="mt-0.5 text-overline text-white/50 font-satoshiRegular" numberOfLines={1}>
          {productMetaOf(pack)}
        </Text>
      </View>
    </TouchableOpacity>
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
 * and search results), the loop's number in a pack's own track list, or
 * nothing at all, when the row starts flush with its title.
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
  leading?: "cover" | number;
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
      {withCover && <PackCover pack={pack} size={ROW_COVER} radius={6} />}
      {typeof leading === "number" && (
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
