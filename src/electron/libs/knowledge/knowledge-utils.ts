import { createHash } from "crypto";
import { existsSync, readdirSync, statSync } from "fs";
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
  ".qoder",
  "node_modules",
  "dist",
  "dist-electron",
  "dist-react",
  "dist-test",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
]);

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
      if (DEFAULT_SKIP_DIRS.has(entry)) {
        skipped.push({ path: relativePath, reason: "ignored directory" });
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
        walk(absolutePath);
        continue;
      }

      if (!stats.isFile()) {
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
