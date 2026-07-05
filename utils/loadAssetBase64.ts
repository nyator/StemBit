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
