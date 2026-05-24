import type { PromptAttachment } from "../../types";

const MAX_TEXT_ATTACHMENT_LENGTH = 20_000;
const MAX_IMAGE_EDGE = 1600;
const IMAGE_JPEG_QUALITY = 0.88;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const TEXT_FILE_PATTERN = /\.(txt|md|markdown|json|ya?ml|xml|svg|csv|tsv|log|js|jsx|ts|tsx|py|rb|java|go|rs|sh|css|html|sql|toml|ini|env)$/i;
const SVG_MIME_TYPE = "image/svg+xml";

export function hasDraggedFiles(dataTransfer: DataTransfer | null): boolean {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes("Files"));
}

async function readFileAsDataUrl(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await readFileAsDataUrl(blob);
}

async function downscaleImageFile(file: File): Promise<{ dataUrl: string; mimeType: string; size: number }> {
  if (file.type === "image/gif") {
    const dataUrl = await readFileAsDataUrl(file);
    return { dataUrl, mimeType: file.type, size: file.size };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));

    if (scale >= 1) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, mimeType: file.type, size: file.size };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, mimeType: file.type, size: file.size };
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", IMAGE_JPEG_QUALITY);
    });

    if (!blob) {
      const dataUrl = await readFileAsDataUrl(file);
      return { dataUrl, mimeType: file.type, size: file.size };
    }

    return {
      dataUrl: await blobToDataUrl(blob),
      mimeType: "image/jpeg",
      size: blob.size,
    };
  } finally {
    bitmap?.close();
  }
}

function isTextFile(file: File): boolean {
  return file.type.startsWith("text/") || TEXT_FILE_PATTERN.test(file.name);
}

export async function fileToAttachment(file: File): Promise<PromptAttachment> {
  if (file.type === SVG_MIME_TYPE || /\.svg$/i.test(file.name)) {
    const text = await readFileAsText(file);
    const normalizedText = text.length > MAX_TEXT_ATTACHMENT_LENGTH
      ? `${text.slice(0, MAX_TEXT_ATTACHMENT_LENGTH)}\n\n[已截断：原文件约 ${text.length} 字符]`
      : text;
    return {
      id: crypto.randomUUID(),
      kind: "text",
      name: file.name || `矢量图-${Date.now()}.svg`,
      mimeType: file.type || SVG_MIME_TYPE,
      data: normalizedText,
      preview: normalizedText,
      size: file.size,
    };
  }

  if (file.type.startsWith("image/")) {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      throw new Error(`暂不支持 ${file.type} 图片格式，请优先使用 PNG、JPEG、GIF 或 WebP。`);
    }
    const normalizedImage = await downscaleImageFile(file);
    return {
      id: crypto.randomUUID(),
      kind: "image",
      name: file.name || `图片-${Date.now()}.png`,
      mimeType: normalizedImage.mimeType,
      data: normalizedImage.dataUrl,
      preview: normalizedImage.dataUrl,
      size: normalizedImage.size,
    };
  }

  if (isTextFile(file)) {
    const text = await readFileAsText(file);
    const normalizedText = text.length > MAX_TEXT_ATTACHMENT_LENGTH
      ? `${text.slice(0, MAX_TEXT_ATTACHMENT_LENGTH)}\n\n[已截断，原始长度 ${text.length} 字符]`
      : text;
    return {
      id: crypto.randomUUID(),
      kind: "text",
      name: file.name || `文本-${Date.now()}.txt`,
      mimeType: file.type || "text/plain",
      data: normalizedText,
      preview: normalizedText,
      size: file.size,
    };
  }

  throw new Error(`暂不支持附件类型：${file.name || file.type || "未知文件"}`);
}
