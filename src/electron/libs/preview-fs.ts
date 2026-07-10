import { readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { dirname, extname, isAbsolute, join, relative } from "node:path";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";

const DEFAULT_DIRECTORY_ENTRY_LIMIT = 300;
const DEFAULT_FILE_SCAN_LIMIT = 2_000;
const MAX_FILE_SCAN_LIMIT = 10_000;
const FILE_SCAN_EVENT_LOOP_YIELD_INTERVAL = 50;
const FILE_SCAN_TIME_BUDGET_MS = 750;

export const MAX_PREVIEW_TEXT_BYTES = 512_000;
// Generated images commonly exceed 2 MB even at low quality. Keep previews
// bounded while allowing the app to render normal model output inline.
export const MAX_PREVIEW_IMAGE_BYTES = 8_000_000;

export const PREVIEW_IMAGE_MIME_TYPES: Record<string, string> = {
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export const PREVIEW_IGNORED_DIRECTORIES = new Set([
  ".cache",
  ".claude",
  ".codex",
  ".git",
  ".next",
  ".tech",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "dist-electron",
  "dist-react",
  "dist-test",
  "node_modules",
  "out",
]);

export type PreviewDirectoryEntry = {
  name: string;
  path: string;
  relativePath: string;
  type: "file" | "directory";
  size?: number;
};

export type PreviewFileEntry = {
  name: string;
  path: string;
  relativePath: string;
  type: "file";
  size?: number;
};

export type PreviewDirectoryResponse = {
  success: boolean;
  path?: string;
  entries?: PreviewDirectoryEntry[];
  error?: string;
};

export type PreviewFilesResponse = {
  success: boolean;
  entries?: PreviewFileEntry[];
  truncated?: boolean;
  error?: string;
};

export type PreviewReadResponse = {
  success: boolean;
  path?: string;
  content?: string;
  language?: string;
  error?: string;
};

export type PreviewWriteResponse = {
  success: boolean;
  path?: string;
  error?: string;
};

export type PreviewFileMetadata = {
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: number;
  isDirectory: boolean;
};

type PreviewPathRequest = {
  cwd?: unknown;
  path?: unknown;
};

type PreviewFilesRequest = {
  cwd?: unknown;
  limit?: unknown;
};

type PreviewGitignoreRule = {
  negated: boolean;
  directoryOnly: boolean;
  hasSlash: boolean;
  regex: RegExp;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseCwd(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePath(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isPathInsideRoot(rootPath: string, candidatePath: string): boolean {
  const rel = relative(rootPath, candidatePath);
  return Boolean(rel) && !rel.startsWith("..") && !isAbsolute(rel);
}

function isPathWithinOrEqualRoot(rootPath: string, candidatePath: string): boolean {
  return rootPath === candidatePath || isPathInsideRoot(rootPath, candidatePath);
}

function isVisiblePreviewEntry(name: string): boolean {
  return !name.startsWith(".") || name === ".env";
}

function isIgnoredPreviewDirectory(name: string): boolean {
  return PREVIEW_IGNORED_DIRECTORIES.has(name);
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function gitignoreGlobToRegexSource(pattern: string): string {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          source += "(?:.*/)?";
          index += 2;
        } else {
          source += ".*";
          index += 1;
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += escapeRegex(char);
    }
  }
  return source;
}

function parsePreviewGitignoreRule(line: string): PreviewGitignoreRule | null {
  let pattern = line.trim();
  if (!pattern || pattern.startsWith("#")) return null;

  let negated = false;
  if (pattern.startsWith("!")) {
    negated = true;
    pattern = pattern.slice(1).trim();
  } else if (pattern.startsWith("\\!") || pattern.startsWith("\\#")) {
    pattern = pattern.slice(1);
  }

  pattern = normalizePreviewRelativePath(pattern, pattern)
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
  const directoryOnly = pattern.endsWith("/");
  pattern = pattern.replace(/\/+$/, "");
  if (!pattern) return null;

  return {
    negated,
    directoryOnly,
    hasSlash: pattern.includes("/"),
    regex: new RegExp(`^${gitignoreGlobToRegexSource(pattern)}$`),
  };
}

async function loadPreviewGitignoreRules(rootPath: string): Promise<PreviewGitignoreRule[]> {
  try {
    const content = await readFile(join(rootPath, ".gitignore"), "utf8");
    return content
      .split(/\r?\n/)
      .map(parsePreviewGitignoreRule)
      .filter((rule): rule is PreviewGitignoreRule => Boolean(rule));
  } catch {
    return [];
  }
}

function previewGitignoreRuleMatches(
  rule: PreviewGitignoreRule,
  relativePath: string,
  isDirectory: boolean,
): boolean {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return false;

  if (!rule.hasSlash) {
    return segments.some((segment, index) => (
      rule.regex.test(segment) &&
      (!rule.directoryOnly || isDirectory || index < segments.length - 1)
    ));
  }

  if (rule.regex.test(relativePath)) {
    return !rule.directoryOnly || isDirectory;
  }

  for (let index = 1; index < segments.length; index += 1) {
    const ancestorPath = segments.slice(0, index).join("/");
    if (rule.regex.test(ancestorPath)) return true;
  }
  return false;
}

function isPreviewGitignored(
  rules: PreviewGitignoreRule[],
  relativePath: string,
  isDirectory: boolean,
): boolean {
  const normalizedPath = normalizePreviewRelativePath(relativePath, relativePath).replace(/^\/+/, "");
  if (!normalizedPath || rules.length === 0) return false;

  let ignored = false;
  for (const rule of rules) {
    if (previewGitignoreRuleMatches(rule, normalizedPath, isDirectory)) {
      ignored = !rule.negated;
    }
  }
  return ignored;
}

function normalizePreviewRelativePath(value: string, fallback: string): string {
  return (value || fallback).replace(/\\/g, "/");
}

function normalizeLimit(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(Math.floor(value), MAX_FILE_SCAN_LIMIT))
    : fallback;
}

function detectPreviewLanguage(filePath: string): string | undefined {
  const extension = extname(filePath).toLowerCase();
  const languages: Record<string, string> = {
    ".bash": "bash",
    ".css": "css",
    ".go": "go",
    ".html": "html",
    ".java": "java",
    ".js": "javascript",
    ".json": "json",
    ".jsx": "javascript",
    ".md": "markdown",
    ".markdown": "markdown",
    ".py": "python",
    ".rb": "ruby",
    ".rs": "rust",
    ".sh": "bash",
    ".sql": "sql",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
  };
  return languages[extension];
}

async function resolvePreviewRequestPath(
  request: PreviewPathRequest,
  options: {
    allowAbsoluteOutsideRoot?: boolean;
    requireInsideRoot?: boolean;
  } = {},
): Promise<{ rootPath: string; realPath: string; rawPath: string } | { error: string; path?: string }> {
  const rawCwd = parseCwd(request.cwd);
  const rawPath = parsePath(request.path);
  if (!rawCwd) return { error: "缺少工作目录。" };

  const rootPath = await realpath(rawCwd);
  const requestedPath = rawPath ? (isAbsolute(rawPath) ? rawPath : join(rootPath, rawPath)) : rootPath;
  const realPath = await realpath(requestedPath);

  const allowAbsoluteOutsideRoot = options.allowAbsoluteOutsideRoot && isAbsolute(rawPath);
  const requireInsideRoot = options.requireInsideRoot ?? !allowAbsoluteOutsideRoot;
  if (requireInsideRoot && !isPathWithinOrEqualRoot(rootPath, realPath)) {
    return { error: "只能访问当前工作目录内的文件。", path: realPath };
  }

  return { rootPath, realPath, rawPath };
}

export async function listPreviewDirectoryForRenderer(
  request: unknown,
  options: { maxEntries?: number } = {},
): Promise<PreviewDirectoryResponse> {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少目录请求参数。" };
    }

    const resolved = await resolvePreviewRequestPath(request as PreviewPathRequest);
    if ("error" in resolved) {
      return { success: false, path: resolved.path, error: resolved.error };
    }

    const directoryStat = await stat(resolved.realPath);
    if (!directoryStat.isDirectory()) {
      return { success: false, path: resolved.realPath, error: "只能浏览目录。" };
    }

    const gitignoreRules = await loadPreviewGitignoreRules(resolved.rootPath);
    const candidates = (await readdir(resolved.realPath, { withFileTypes: true }))
      .filter((entry) => isVisiblePreviewEntry(entry.name))
      .flatMap((entry) => {
        const type = entry.isDirectory() ? "directory" as const : entry.isFile() ? "file" as const : null;
        if (!type) return [];
        if (type === "directory" && isIgnoredPreviewDirectory(entry.name)) return [];
        const entryPath = join(resolved.realPath, entry.name);
        const relativePath = normalizePreviewRelativePath(relative(resolved.rootPath, entryPath), entry.name);
        if (isPreviewGitignored(gitignoreRules, relativePath, type === "directory")) return [];
        return [{
          name: entry.name,
          path: entryPath,
          relativePath,
          type,
        }];
      })
      .sort((left, right) => (
        left.type === right.type
          ? left.name.localeCompare(right.name)
          : left.type === "directory" ? -1 : 1
      ))
      .slice(0, options.maxEntries ?? DEFAULT_DIRECTORY_ENTRY_LIMIT);

    const entries = (await Promise.all(candidates.map(async (entry): Promise<PreviewDirectoryEntry | null> => {
      if (entry.type === "directory") return entry;
      try {
        const fileStat = await stat(entry.path);
        if (!fileStat.isFile()) return null;
        return { ...entry, size: fileStat.size };
      } catch {
        return null;
      }
    }))).filter((entry): entry is PreviewDirectoryEntry => Boolean(entry));

    return { success: true, path: resolved.realPath, entries };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "读取目录失败。") };
  }
}

export async function listPreviewFilesForRenderer(
  request: unknown,
  options: { timeBudgetMs?: number } = {},
): Promise<PreviewFilesResponse> {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少文件索引请求参数。" };
    }

    const payload = request as PreviewFilesRequest;
    const rawCwd = parseCwd(payload.cwd);
    if (!rawCwd) {
      return { success: false, error: "缺少工作目录。" };
    }

    const limit = normalizeLimit(payload.limit, DEFAULT_FILE_SCAN_LIMIT);
    const rootPath = await realpath(rawCwd);
    const rootStat = await stat(rootPath);
    if (!rootStat.isDirectory()) {
      return { success: false, error: "只能索引目录。" };
    }

    const entries: PreviewFileEntry[] = [];
    const pending = [rootPath];
    const startedAt = Date.now();
    const timeBudgetMs = options.timeBudgetMs ?? FILE_SCAN_TIME_BUDGET_MS;
    const gitignoreRules = await loadPreviewGitignoreRules(rootPath);
    let visitedDirectories = 0;
    let truncated = false;

    while (pending.length > 0) {
      if (entries.length >= limit) {
        truncated = true;
        break;
      }
      if (Date.now() - startedAt > timeBudgetMs) {
        truncated = true;
        break;
      }

      const currentPath = pending.pop()!;
      let children: Dirent<string>[];
      try {
        children = await readdir(currentPath, { withFileTypes: true });
      } catch {
        continue;
      }

      visitedDirectories += 1;
      if (visitedDirectories % FILE_SCAN_EVENT_LOOP_YIELD_INTERVAL === 0) {
        await yieldToEventLoop();
      }

      const sortedChildren = children
        .filter((entry) => isVisiblePreviewEntry(entry.name))
        .sort((left, right) => left.name.localeCompare(right.name));

      for (const child of sortedChildren) {
        const childPath = join(currentPath, child.name);
        const childRelativePath = normalizePreviewRelativePath(relative(rootPath, childPath), child.name);
        const childIsDirectory = child.isDirectory();
        if (isPreviewGitignored(gitignoreRules, childRelativePath, childIsDirectory)) continue;
        if (childIsDirectory) {
          if (!isIgnoredPreviewDirectory(child.name)) {
            pending.push(childPath);
          }
          continue;
        }
        if (!child.isFile()) continue;

        entries.push({
          name: child.name,
          path: childPath,
          relativePath: childRelativePath,
          type: "file",
        });
        if (entries.length >= limit) {
          truncated = true;
          break;
        }
      }
    }

    entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    return { success: true, entries, truncated: truncated || pending.length > 0 };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "索引文件失败。") };
  }
}

export async function readPreviewFileForRenderer(request: unknown): Promise<PreviewReadResponse> {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少预览请求参数。" };
    }

    const payload = request as PreviewPathRequest;
    if (!parseCwd(payload.cwd) || !parsePath(payload.path)) {
      return { success: false, error: "缺少工作目录或文件路径。" };
    }

    const resolved = await resolvePreviewRequestPath(payload, {
      allowAbsoluteOutsideRoot: true,
      requireInsideRoot: !isAbsolute(parsePath(payload.path)),
    });
    if ("error" in resolved) {
      return { success: false, path: resolved.path, error: resolved.error };
    }

    const fileStat = await stat(resolved.realPath);
    if (!fileStat.isFile()) {
      return { success: false, path: resolved.realPath, error: "只能预览普通文件。" };
    }

    const extension = extname(resolved.realPath).toLowerCase();
    const imageMime = PREVIEW_IMAGE_MIME_TYPES[extension];
    if (imageMime) {
      if (fileStat.size > MAX_PREVIEW_IMAGE_BYTES) {
        return { success: false, path: resolved.realPath, error: "图片过大，暂不在侧栏预览。" };
      }
      const base64 = (await readFile(resolved.realPath)).toString("base64");
      return {
        success: true,
        path: resolved.realPath,
        content: `data:${imageMime};base64,${base64}`,
      };
    }

    if (fileStat.size > MAX_PREVIEW_TEXT_BYTES) {
      return { success: false, path: resolved.realPath, error: "文件过大，暂不在侧栏预览。" };
    }

    return {
      success: true,
      path: resolved.realPath,
      content: await readFile(resolved.realPath, "utf8"),
      language: detectPreviewLanguage(resolved.realPath),
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "读取预览文件失败。") };
  }
}

export async function writePreviewFileForRenderer(request: unknown): Promise<PreviewWriteResponse> {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少写入请求参数。" };
    }

    const payload = request as PreviewPathRequest & { data?: unknown };
    if (!parseCwd(payload.cwd) || !parsePath(payload.path) || typeof payload.data !== "string") {
      return { success: false, error: "缺少工作目录、文件路径或写入内容。" };
    }

    const resolved = await resolvePreviewRequestPath(payload);
    if ("error" in resolved) {
      return { success: false, path: resolved.path, error: resolved.error };
    }

    const fileStat = await stat(resolved.realPath);
    if (!fileStat.isFile()) {
      return { success: false, path: resolved.realPath, error: "只能写入普通文件。" };
    }

    await writeFile(resolved.realPath, payload.data, "utf8");
    return { success: true, path: resolved.realPath };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "写入预览文件失败。") };
  }
}

export async function getPreviewFileMetadataForRenderer(request: unknown): Promise<PreviewFileMetadata | null> {
  try {
    if (!request || typeof request !== "object") {
      return null;
    }

    const payload = request as PreviewPathRequest;
    if (!parseCwd(payload.cwd) || !parsePath(payload.path)) {
      return null;
    }

    const resolved = await resolvePreviewRequestPath(payload);
    if ("error" in resolved) {
      return null;
    }

    const fileStat = await stat(resolved.realPath);
    return {
      name: resolved.realPath.split(/[\\/]/).pop() ?? resolved.realPath,
      path: resolved.realPath,
      size: fileStat.size,
      type: fileStat.isDirectory() ? "directory" : extname(resolved.realPath).slice(1),
      lastModified: fileStat.mtimeMs,
      isDirectory: fileStat.isDirectory(),
    };
  } catch {
    return null;
  }
}

export async function removePreviewEntryForRenderer(request: unknown): Promise<PreviewWriteResponse> {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少删除请求参数。" };
    }

    const payload = request as PreviewPathRequest;
    if (!parseCwd(payload.cwd) || !parsePath(payload.path)) {
      return { success: false, error: "缺少工作目录或路径。" };
    }

    const resolved = await resolvePreviewRequestPath(payload);
    if ("error" in resolved) {
      return { success: false, path: resolved.path, error: resolved.error };
    }
    if (resolved.rootPath === resolved.realPath) {
      return { success: false, path: resolved.realPath, error: "只能删除当前工作目录内的子文件。" };
    }

    await rm(resolved.realPath, { recursive: true, force: true });
    return { success: true, path: resolved.realPath };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "删除文件失败。") };
  }
}

export async function renamePreviewEntryForRenderer(request: unknown): Promise<PreviewWriteResponse & { newPath?: string }> {
  try {
    if (!request || typeof request !== "object") {
      return { success: false, error: "缺少重命名请求参数。" };
    }

    const payload = request as PreviewPathRequest & { newName?: unknown };
    const newName = typeof payload.newName === "string" ? payload.newName.trim() : "";
    if (!parseCwd(payload.cwd) || !parsePath(payload.path) || !newName || newName === "." || newName === ".." || /[\\/\0]/.test(newName)) {
      return { success: false, error: "缺少工作目录、路径或合法新名称。" };
    }

    const resolved = await resolvePreviewRequestPath(payload);
    if ("error" in resolved) {
      return { success: false, path: resolved.path, error: resolved.error };
    }
    if (resolved.rootPath === resolved.realPath) {
      return { success: false, path: resolved.realPath, error: "只能重命名当前工作目录内的子文件。" };
    }

    const newPath = join(dirname(resolved.realPath), newName);
    if (!isPathInsideRoot(resolved.rootPath, newPath)) {
      return { success: false, path: resolved.realPath, error: "只能重命名当前工作目录内的子文件。" };
    }

    await rename(resolved.realPath, newPath);
    return { success: true, path: resolved.realPath, newPath };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, "重命名文件失败。") };
  }
}
