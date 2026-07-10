// 生图资产层：负责把生图结果（base64 或远端 URL）安全落盘到 userData/generated-images/<sessionId>/。
// 详见 .omx/plans/2026-07-10-image-generation-integration.md §7。
import { mkdir, writeFile, stat, realpath, access } from "fs/promises";
import { constants as fsConstants } from "fs";
import { basename, dirname, extname, join, resolve, sep } from "path";
import { app } from "electron";
import { tmpdir } from "os";

const GENERATED_IMAGES_ROOT_DIRNAME = "generated-images";
const ATTACHMENT_ROOT_DIRNAME = "prompt-attachments";
const DESIGN_PARITY_DIRNAME = "design-parity";

const ALLOWED_REFERENCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export const MAX_REFERENCE_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MiB
export const MAX_REFERENCE_IMAGES = 4;
export const REMOTE_DOWNLOAD_TIMEOUT_MS = 60_000;

export type GeneratedImageArtifact = {
  id: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  model: string;
  revisedPrompt?: string;
};

export type ReferenceImageValidation =
  | { ok: true; realPath: string; mimeType: string; sizeBytes: number }
  | { ok: false; code: "INVALID_REFERENCE"; message: string; path: string };

export function getGeneratedImagesRoot(): string {
  return join(app.getPath("userData"), GENERATED_IMAGES_ROOT_DIRNAME);
}

export function getGeneratedImagesDirForSession(sessionId: string): string {
  return join(getGeneratedImagesRoot(), sessionId);
}

function randomId(): string {
  // 避免 Date.now/Math.random（部分受限运行时禁用），用 crypto 随机字节
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveExtensionFromMime(mimeType: string | undefined, fallbackName?: string): string {
  const normalized = mimeType?.trim().toLowerCase();
  if (normalized === "image/png") return ".png";
  if (normalized === "image/jpeg" || normalized === "image/jpg") return ".jpg";
  if (normalized === "image/webp") return ".webp";

  const fromName = extname(fallbackName ?? "").toLowerCase();
  if (fromName && ALLOWED_REFERENCE_EXTENSIONS.has(fromName)) {
    return fromName;
  }
  return ".png";
}

function resolveMimeFromExtension(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? "application/octet-stream";
}

export async function persistGeneratedImageBuffer(params: {
  sessionId: string;
  buffer: Buffer;
  mimeType?: string;
  suggestedName?: string;
  model: string;
  revisedPrompt?: string;
  width?: number;
  height?: number;
}): Promise<GeneratedImageArtifact> {
  const dir = getGeneratedImagesDirForSession(params.sessionId);
  await mkdir(dir, { recursive: true });

  const ext = resolveExtensionFromMime(params.mimeType, params.suggestedName);
  const filename = `${Date.now()}-${randomId()}${ext}`;
  const filePath = join(dir, filename);
  await writeFile(filePath, params.buffer);
  const fileStat = await stat(filePath);

  return {
    id: randomId(),
    path: filePath,
    mimeType: MIME_BY_EXTENSION[ext] ?? "image/png",
    sizeBytes: fileStat.size,
    width: params.width,
    height: params.height,
    model: params.model,
    revisedPrompt: params.revisedPrompt,
  };
}

function getAllowedReferenceRoots(sessionId: string | undefined, cwd?: string): string[] {
  const userData = app.getPath("userData");
  const roots = [
    join(userData, ATTACHMENT_ROOT_DIRNAME),
    join(userData, GENERATED_IMAGES_ROOT_DIRNAME),
    join(userData, DESIGN_PARITY_DIRNAME),
    tmpdir(),
  ];
  if (sessionId) {
    roots.push(join(userData, GENERATED_IMAGES_ROOT_DIRNAME, sessionId));
  }
  if (cwd) {
    roots.push(resolve(cwd));
  }
  // 去重并保留原序
  return Array.from(new Set(roots.map((root) => resolve(root))));
}

function isPathWithinRoots(target: string, roots: string[]): boolean {
  const normalizedTarget = resolve(target);
  for (const root of roots) {
    const normalizedRoot = resolve(root);
    if (normalizedTarget === normalizedRoot) return true;
    const prefix = normalizedRoot.endsWith(sep) ? normalizedRoot : `${normalizedRoot}${sep}`;
    if (normalizedTarget.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * 校验参考图路径。只允许位于允许根目录范围、扩展名合法、大小 ≤ 20MiB 的真实文件。
 * 详见 §7.2。拒绝不存在的文件、目录、软链接越界和非图片扩展名。
 */
export async function validateReferenceImagePath(params: {
  path: string;
  sessionId?: string;
  cwd?: string;
}): Promise<ReferenceImageValidation> {
  const trimmed = params.path?.trim();
  if (!trimmed) {
    return { ok: false, code: "INVALID_REFERENCE", message: "参考图路径为空。", path: params.path };
  }

  let realPath: string;
  try {
    realPath = await realpath(resolve(trimmed));
  } catch {
    return { ok: false, code: "INVALID_REFERENCE", message: `参考图文件不存在或无法解析：${trimmed}`, path: trimmed };
  }

  const ext = extname(realPath).toLowerCase();
  if (!ALLOWED_REFERENCE_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      code: "INVALID_REFERENCE",
      message: `参考图格式暂不支持：${basename(realPath)}（仅支持 PNG / JPEG / WebP）`,
      path: realPath,
    };
  }

  const roots = getAllowedReferenceRoots(params.sessionId, params.cwd);
  if (!isPathWithinRoots(realPath, roots)) {
    return {
      ok: false,
      code: "INVALID_REFERENCE",
      message: `参考图路径不在允许范围内：${realPath}。仅允许工作目录、prompt-attachments、generated-images、design-parity 下的文件。`,
      path: realPath,
    };
  }

  let fileStat;
  try {
    fileStat = await stat(realPath);
  } catch {
    return { ok: false, code: "INVALID_REFERENCE", message: `参考图文件无法读取：${realPath}`, path: realPath };
  }

  if (!fileStat.isFile()) {
    return { ok: false, code: "INVALID_REFERENCE", message: `参考图路径不是普通文件：${realPath}`, path: realPath };
  }

  if (fileStat.size > MAX_REFERENCE_IMAGE_BYTES) {
    return {
      ok: false,
      code: "INVALID_REFERENCE",
      message: `参考图过大：${(fileStat.size / 1024 / 1024).toFixed(1)} MiB（上限 20 MiB）。`,
      path: realPath,
    };
  }

  return {
    ok: true,
    realPath,
    mimeType: MIME_BY_EXTENSION[ext] ?? "application/octet-stream",
    sizeBytes: fileStat.size,
  };
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export { dirname, resolveMimeFromExtension };
