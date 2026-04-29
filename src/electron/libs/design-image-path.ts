import { extname, isAbsolute, basename } from "path";
import { fileURLToPath } from "url";

const SUPPORTED_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const PLACEHOLDER_IMAGE_NAMES = new Set([
  "image.png",
  "image.jpg",
  "image.jpeg",
  "image.webp",
  "screenshot.png",
  "reference.png",
]);

export function resolveDesignImagePath(pathOrUri: string, label: string): string {
  const trimmed = pathOrUri.trim();
  if (!trimmed) {
    throw new Error(`${label} 不能为空。`);
  }

  const normalized = trimmed.startsWith("file:")
    ? fileURLToPath(trimmed)
    : trimmed;

  const extension = extname(normalized).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`${label} 格式暂不支持：${basename(normalized)}`);
  }

  if (!isAbsolute(normalized) && PLACEHOLDER_IMAGE_NAMES.has(basename(normalized).toLowerCase())) {
    throw new Error(
      `不要传入占位文件名 ${basename(normalized)}。请从用户附件摘要中复制完整的本地路径，并按 { "imagePath": "C:\\\\...\\\\prompt-attachments\\\\xxx.png" } 传给设计工具。`,
    );
  }

  return normalized;
}
