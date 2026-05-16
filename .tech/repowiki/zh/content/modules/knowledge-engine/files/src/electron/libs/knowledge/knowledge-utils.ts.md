# src/electron/libs/knowledge/knowledge-utils.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：256

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `readIgnorePatterns@56`
- `wildcardMatch@80`
- `matchesIgnorePattern@85`
- `shouldSkipDirectory@120`
- `stableHash@133`
- `estimateTokens@137`
- `compactWhitespace@141`
- `parseJsonObject@146`
- `stringifyJsonObject@161`
- `serializeTags@165`
- `parseTags@169`
- `walkWorkspaceFiles@175`
- `walk@185`
- `KNOWLEDGE_SOURCE_EXTENSIONS@4`
- `DEFAULT_SKIP_DIRS@21`
- `IGNORE_FILES@42`
- `ignorePath@60`
- `text@66`
- `line@68`
- `escaped@82`
- `normalizedPath@87`
- `pathParts@88`
- `baseName@89`
- `normalizedPattern@92`
- `directoryOnly@96`
- `compact@143`
- `parsed@153`
- `maxFiles@180`
- `maxFileBytes@181`
- `ignorePatterns@184`
- `absolutePath@203`
- `relativePath@205`
- `ext@235`
- `WalkWorkspaceFile@44`
- `WalkWorkspaceOptions@50`

## 依赖输入

- `crypto`
- `fs`
- `path`

## 对外暴露

- `KNOWLEDGE_SOURCE_EXTENSIONS`
- `WalkWorkspaceFile`
- `WalkWorkspaceOptions`
- `stableHash`
- `estimateTokens`
- `compactWhitespace`
- `parseJsonObject`
- `stringifyJsonObject`
- `serializeTags`
- `parseTags`
- `walkWorkspaceFiles`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

export function stringifyJsonObject(value: Record<string, unknown> | undefined): str
... (truncated)
```
