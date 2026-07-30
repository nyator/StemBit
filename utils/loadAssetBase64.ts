import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

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
 * Base64 for either kind of audio a loop can come from: a bundled asset module
 * id, or a file URI for one the user imported. Imported files are already on
 * disk, so they skip the asset system entirely.
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
