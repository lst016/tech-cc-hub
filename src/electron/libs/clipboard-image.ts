import type { NativeImage } from "electron";

export type ClipboardImagePayload = {
  base64: string;
  mimeType: "image/png";
  name: string;
  size: number;
};

type ClipboardNativeImage = Pick<NativeImage, "isEmpty" | "toPNG">;

export function readNativeClipboardImagePayload(
  image: ClipboardNativeImage,
  now = Date.now(),
): ClipboardImagePayload | null {
  if (image.isEmpty()) return null;

  const png = image.toPNG();
  if (png.byteLength === 0) return null;

  return {
    base64: png.toString("base64"),
    mimeType: "image/png",
    name: `clipboard-image-${now}.png`,
    size: png.byteLength,
  };
}
