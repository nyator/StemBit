import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

export async function loadAssetBase64(module: number): Promise<string> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error("Asset has no local URI after download");
  }
  return FileSystem.readAsStringAsync(asset.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/**
 * Where a loop's audio actually is on disk, for either kind of source.
 *
 * A bundled loop is a module id, which is not a file until the asset system has
 * unpacked it -- on Android it starts life inside the apk. downloadAsync is what
 * puts it somewhere with a path, and is a no-op once it has.
 *
 * The name comes back too: it carries the real extension, which is the only
 * honest way to name the copy this gets used to make.
 */
export async function resolveAudioUri(
  source: number | string
): Promise<{ uri: string; fileName: string }> {
  if (typeof source === "string") {
    const name = source.split("/").pop() || "loop.wav";
    return { uri: source, fileName: name };
  }

  const asset = Asset.fromModule(source);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error("Asset has no local URI after download");
  }
  const extension = asset.type || "wav";
  return {
    uri: asset.localUri,
    fileName: `${asset.name || "loop"}.${extension}`,
  };
}

/**
 *  Base64 for either kind of audio a loop can come from: a bundled asset module
 * id, or a file URI for one the user imported. Imported files are already on
 * disk, so they skip the asset system entirely.d
 */
export async function loadAudioBase64(
  source: number | string
): Promise<string> {
  if (typeof source === "string") {
    return FileSystem.readAsStringAsync(source, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  return loadAssetBase64(source);
}
