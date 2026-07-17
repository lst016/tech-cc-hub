import { existsSync, realpathSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, isAbsolute, relative, resolve } from "node:path";

export type ChannelReplyAttachment = {
  absolutePath: string;
  relativePath: string;
  sourceText: string;
  kind: "image" | "file";
  size: number;
};

export type ChannelReplyAttachmentLimits = {
  maxAttachments?: number;
  maxFileBytes?: number;
};

const DEFAULT_MAX_ATTACHMENTS = 5;
const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"]);
const MARKDOWN_LINK_RE = /\[[^\]\r\n]*\]\(([^)\r\n]+)\)/g;
const FILE_URL_RE = /file:\/\/\/[^\s)`\]}>]+/gi;
const WINDOWS_PATH_RE = /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+\.[a-zA-Z0-9]{1,12}/g;
const UNIX_PATH_RE = /\/(?:[^/\0\r\n]+\/)*[^/\0\r\n]+\.[a-zA-Z0-9]{1,12}/g;

function isContainedPath(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot));
}

function trimReference(value: string): string {
  return value.trim().replace(/^['"`(<\[]+|[>'"`),\].;:!?]+$/g, "");
}

function resolveReference(value: string, workspaceRoot: string): string | null {
  const trimmed = trimReference(value);
  if (!trimmed) return null;
  try {
    if (/^file:\/\//i.test(trimmed)) return fileURLToPath(trimmed);
  } catch {
    return null;
  }
  return isAbsolute(trimmed) ? trimmed : resolve(workspaceRoot, trimmed);
}

function collectSourceReferences(text: string): string[] {
  return [
    ...Array.from(text.matchAll(MARKDOWN_LINK_RE), (match) => match[1] ?? ""),
    ...Array.from(text.matchAll(FILE_URL_RE), (match) => match[0]),
    ...Array.from(text.matchAll(WINDOWS_PATH_RE), (match) => match[0]),
    ...Array.from(text.matchAll(UNIX_PATH_RE), (match) => match[0]),
  ].filter(Boolean);
}

export function collectSafeChannelReplyAttachments(
  text: string,
  workspaceRoot: string,
  limits: ChannelReplyAttachmentLimits = {},
): ChannelReplyAttachment[] {
  const maxAttachments = Math.max(0, limits.maxAttachments ?? DEFAULT_MAX_ATTACHMENTS);
  const maxFileBytes = Math.max(0, limits.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES);
  if (!text.trim() || maxAttachments === 0 || !existsSync(workspaceRoot)) return [];

  let realWorkspaceRoot: string;
  try {
    realWorkspaceRoot = realpathSync(workspaceRoot);
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const attachments: ChannelReplyAttachment[] = [];
  for (const sourceText of collectSourceReferences(text)) {
    if (attachments.length >= maxAttachments) break;
    const resolved = resolveReference(sourceText, realWorkspaceRoot);
    if (!resolved) continue;

    try {
      const absolutePath = realpathSync(resolved);
      if (!isContainedPath(realWorkspaceRoot, absolutePath)) continue;
      const key = process.platform === "win32" ? absolutePath.toLowerCase() : absolutePath;
      if (seen.has(key)) continue;
      const stat = statSync(absolutePath);
      if (!stat.isFile() || stat.size > maxFileBytes) continue;

      const relativePath = relative(realWorkspaceRoot, absolutePath);
      if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) continue;
      seen.add(key);
      attachments.push({
        absolutePath,
        relativePath,
        sourceText,
        kind: IMAGE_EXTENSIONS.has(extname(absolutePath).toLowerCase()) ? "image" : "file",
        size: stat.size,
      });
    } catch {
      // Ignore missing, unreadable, or concurrently replaced files.
    }
  }

  return attachments;
}

export function removeUploadedAttachmentReferences(
  text: string,
  uploaded: readonly ChannelReplyAttachment[],
): string {
  let result = text;
  for (const attachment of uploaded) {
    const escaped = attachment.sourceText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result
      .replace(new RegExp(`\\[([^\\]]*)\\]\\(${escaped}\\)`, "g"), "$1")
      .replace(new RegExp(escaped, "g"), "");
  }
  return result.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
