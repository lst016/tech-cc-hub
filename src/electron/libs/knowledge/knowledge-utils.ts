import { createHash } from "crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { extname, join, relative } from "path";

export const KNOWLEDGE_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
]);

const DEFAULT_SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  "__pycache__",
  "venv",
  "env",
  ".tox",
  ".mypy_cache",
  ".pytest_cache",
  ".ruff_cache",
  "target",
  "vendor",
  "third_party",
]);

const IGNORE_FILES = [".techignore", ".repowikiignore", ".gitignore"];

export type WalkWorkspaceFile = {
  absolutePath: string;
  relativePath: string;
  size: number;
};

export type WalkWorkspaceOptions = {
  maxFiles?: number;
  maxFileBytes?: number;
  includeTech?: boolean;
};

function readIgnorePatterns(root: string): string[] {
  const patterns: string[] = [];
  for (const fileName of IGNORE_FILES) {
    const ignorePath = join(root, fileName);
    if (!existsSync(ignorePath)) {
      continue;
    }

    try {
      const text = readFileSync(ignorePath, "utf8");
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#") || line.startsWith("!")) {
          continue;
        }
        patterns.push(line);
      }
    } catch {
      // Ignore unreadable ignore files; scanning should still be best-effort.
    }
  }
  return patterns;
}

function wildcardMatch(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(value);
}

function matchesIgnorePattern(relativePath: string, patterns: string[], isDirectory = false): boolean {
  const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const pathParts = normalizedPath.split("/").filter(Boolean);
  const baseName = pathParts.at(-1) ?? normalizedPath;

  for (const pattern of patterns) {
    let normalizedPattern = pattern.replace(/\\/g, "/").trim();
    if (!normalizedPattern) {
      continue;
    }

    const directoryOnly = normalizedPattern.endsWith("/");
    normalizedPattern = normalizedPattern.replace(/^\/+|\/+$/g, "");
    if (!normalizedPattern || (directoryOnly && !isDirectory)) {
      continue;
    }

    if (!normalizedPattern.includes("/")) {
      if (pathParts.some((part) => wildcardMatch(part, normalizedPattern)) || wildcardMatch(baseName, normalizedPattern)) {
        return true;
      }
      continue;
    }

    if (normalizedPath === normalizedPattern || normalizedPath.startsWith(`${normalizedPattern}/`)) {
      return true;
    }
    if (wildcardMatch(normalizedPath, normalizedPattern)) {
      return true;
    }
  }

  return false;
}

function shouldSkipDirectory(entry: string, relativePath: string, ignorePatterns: string[]): boolean {
  if (entry.startsWith(".")) {
    return true;
  }
  if (DEFAULT_SKIP_DIRS.has(entry) || entry.endsWith(".egg-info")) {
    return true;
  }
  if (entry.startsWith("dist-") || entry.startsWith("dist_")) {
    return true;
  }
  return matchesIgnorePattern(relativePath, ignorePatterns, true);
}

export function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function compactWhitespace(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

export function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function stringifyJsonObject(value: Record<string, unknown> | undefined): string {
  return JSON.stringify(value ?? {});
}

export function serializeTags(tags: string[] | undefined): string {
  return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))).join(",");
}

export function parseTags(value: unknown): string[] {
  return typeof value === "string"
    ? value.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
}

export function walkWorkspaceFiles(root: string, options: WalkWorkspaceOptions = {}): {
  files: WalkWorkspaceFile[];
  skipped: Array<{ path: string; reason: string }>;
} {
  const maxFiles = options.maxFiles ?? 400;
  const maxFileBytes = options.maxFileBytes ?? 256_000;
  const files: WalkWorkspaceFile[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  const ignorePatterns = readIgnorePatterns(root);

  function walk(dir: string): void {
    if (files.length >= maxFiles) {
      return;
    }

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (error) {
      skipped.push({ path: relative(root, dir) || ".", reason: error instanceof Error ? error.message : "read failed" });
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) {
        return;
      }

      const absolutePath = join(dir, entry);
      const relativePath = relative(root, absolutePath);
      if (!options.includeTech && relativePath === ".tech") {
        skipped.push({ path: relativePath, reason: "internal .tech output" });
        continue;
      }

      let stats;
      try {
        stats = statSync(absolutePath);
      } catch (error) {
        skipped.push({ path: relativePath, reason: error instanceof Error ? error.message : "stat failed" });
        continue;
      }

      if (stats.isDirectory()) {
        if (shouldSkipDirectory(entry, relativePath, ignorePatterns)) {
          skipped.push({ path: relativePath, reason: "ignored directory" });
          continue;
        }
        walk(absolutePath);
        continue;
      }

      if (!stats.isFile()) {
        continue;
      }
      if (matchesIgnorePattern(relativePath, ignorePatterns)) {
        skipped.push({ path: relativePath, reason: "ignored by project config" });
        continue;
      }

      const ext = extname(entry).toLowerCase();
      if (!KNOWLEDGE_SOURCE_EXTENSIONS.has(ext)) {
        skipped.push({ path: relativePath, reason: "unsupported extension" });
        continue;
      }
      if (stats.size > maxFileBytes) {
        skipped.push({ path: relativePath, reason: `file too large (${stats.size} bytes)` });
        continue;
      }
      if (!existsSync(absolutePath)) {
        continue;
      }

      files.push({ absolutePath, relativePath, size: stats.size });
    }
  }

  walk(root);
  return { files, skipped };
}
