import { mkdir, readFile, writeFile } from "fs/promises";
import { extname, join } from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { app } from "electron";

import type { PromptAttachment } from "../types.js";
import { isInlineImageAttachmentData } from "../../shared/attachments.js";

const ATTACHMENT_ROOT_DIRNAME = "prompt-attachments";

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
};

export type StoredImageAttachmentReference = {
  storagePath: string;
  storageUri: string;
  size: number;
};

export async function persistImageAttachmentReference(attachment: PromptAttachment): Promise<StoredImageAttachmentReference | null> {
  if (attachment.kind !== "image") {
    return null;
  }

  if (attachment.storagePath && attachment.storageUri) {
    return {
      storagePath: attachment.storagePath,
      storageUri: attachment.storageUri,
      size: attachment.size ?? 0,
    };
  }

  const inlineData = attachment.runtimeData ?? attachment.data;
  if (!isInlineImageAttachmentData(inlineData)) {
    return null;
  }

  const buffer = decodeInlineImageData(inlineData);
  const rootDir = join(app.getPath("userData"), ATTACHMENT_ROOT_DIRNAME);
  await mkdir(rootDir, { recursive: true });
  const filePath = join(rootDir, `${attachment.id}${resolveAttachmentExtension(attachment)}`);
  await writeFile(filePath, buffer);

  return {
    storagePath: filePath,
    storageUri: pathToFileURL(filePath).toString(),
    size: buffer.byteLength,
  };
}

export async function rehydrateStoredImageAttachment(attachment: PromptAttachment): Promise<PromptAttachment | null> {
  if (attachment.kind !== "image") {
    return null;
  }

  if (attachment.runtimeData && isInlineImageAttachmentData(attachment.runtimeData)) {
    return attachment;
  }

  const storagePath = attachment.storagePath || resolveStoragePathFromUri(attachment.storageUri);
  if (!storagePath) {
    return null;
  }

  const fileBuffer = await readFile(storagePath);
  return {
    ...attachment,
    runtimeData: `data:${attachment.mimeType || "image/png"};base64,${fileBuffer.toString("base64")}`,
    storagePath,
    storageUri: attachment.storageUri ?? pathToFileURL(storagePath).toString(),
    size: attachment.size ?? fileBuffer.byteLength,
  };
}

function resolveAttachmentExtension(attachment: PromptAttachment): string {
  const fromMimeType = MIME_EXTENSION_MAP[attachment.mimeType.toLowerCase()];
  if (fromMimeType) {
    return fromMimeType;
  }

  const fromName = extname(attachment.name || "").trim();
  if (fromName) {
    return fromName;
  }

  return ".bin";
}

function decodeInlineImageData(data: string): Buffer {
  const trimmed = data.trim();
  const base64Data = trimmed.startsWith("data:")
    ? trimmed.split(",", 2)[1] ?? ""
    : trimmed;

  return Buffer.from(base64Data.replace(/\s+/g, ""), "base64");
}

function resolveStoragePathFromUri(storageUri?: string): string | undefined {
  if (!storageUri?.trim()) {
    return undefined;
  }

  try {
    return fileURLToPath(storageUri);
  } catch {
    return undefined;
  }
}
