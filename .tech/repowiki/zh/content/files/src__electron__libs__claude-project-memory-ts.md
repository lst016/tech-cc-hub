# src/electron/libs/claude-project-memory.ts

> 模块：`electron` · 语言：`typescript` · 行数：180

## 文件职责

Claude项目记忆目录管理，支持加载项目级别的memory.md等文档

## 关键符号

- `toClaudeProjectSlug@0 - 将工作目录路径转换为Claude项目slug格式，处理Windows驱动器路径`
- `loadClaudeProjectMemory@0 - 加载项目memory目录下的所有.md文件，有字数限制`
- `buildClaudeProjectMemoryPromptAppend@0 - 构建追加到系统提示的记忆内容字符串`
- `MEMORY_DIR_NAME@0 - 记忆目录名称常量'memory'`

## 依赖输入

- `fs`
- `os`
- `path`

## 对外暴露

- `ClaudeProjectMemoryOptions`
- `ClaudeProjectMemoryDocument`
- `ClaudeProjectMemoryBundle`
- `getUserClaudeRoot`
- `toClaudeProjectSlug`
- `getClaudeProjectMemoryDir`
- `loadClaudeProjectMemory`
- `buildClaudeProjectMemoryPromptAppend`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

const DEFAULT_MAX_MEMORY_CHARS = 20_000;
const DEFAULT_MAX_FILE_CHARS = 8_000;
const MEMORY_DIR_NAME = "memory";

export type ClaudeProjectMemoryOptions = {
  claudeRoot?: string;
  maxChars?: number;
  maxFileChars?: number;
};

export type ClaudeProjectMemoryDocument = {
  path: string;
  name: string;
  content: string;
};

export type ClaudeProjectMemoryBundle = {
  projectSlug: string;
  memoryDir: string;
  documents: ClaudeProjectMemoryDocument[];
  truncated: boolean;
};

export function getUserClaudeRoot(): string {
  return join(homedir(), ".claude");
}

export function toClaudeProjectSlug(cwd: string): string {
  const normalized = cwd.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  const windowsMatch = normalized.match(/^([A-Za-z]):\/?(.*)$/);

  if (windowsMatch) {
    const drive = windowsMatch[1].toUpperCase();
    const rest = windowsMatch[2]
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .join("-");
    return rest ? `${drive}--${rest}` : `${drive}--`;
  }

  return normalized
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("-") || "root";
}

export function getClaudeProjectMemoryDir(cwd: string, claudeRoot = getUserClaudeRoot()): string {
  return join(claudeRoot, "projects", toClaudeProjectSlug(cwd), MEMORY_DIR_NAME);
}

export function loadClaudeProjectMemory(
  cwd: string | undefined,
  options: ClaudeProjectMemoryOptions = {},
): ClaudeProjectMemoryBundle | undefined {
  const normalizedCwd = cwd?.trim();
  if (!normalizedCwd) {
    return undefined;
  }

  const claudeRoot = options.claudeRoot ?? getUserClaudeRoot();
  const projectSlug = toClaudeProjectSlug(normalizedCwd);
  const memoryDir = join(claudeRoot, "projects", projectSlug, MEMORY_DIR_NAME);
  if (!existsSync(memoryDir)) {
    return undefined;
  }

  const maxChars = Math.max(1, options.maxChars ?? DEFAULT_MAX_MEMORY_CHARS);
  const maxFileChars = Math.max(1, options.maxFileChars ?? DEFAULT_MAX_FILE_CHARS);
  let remainingChars = maxChars;
  let truncated = false;

  const files = readdirSync(memoryDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => join(memoryDir, entry.name))
    .filter((path) => {
      try {
        return statSync(path).isFile();
      } catch {
        return false;
      }
    })
    .sort((left, right) => {
      const leftBase = basename(left).toLowerCase();
      const rightBase = basename(right).toLowerCase();
      if (leftBase === "memory.md") {
        return -1;
      }
      if (rightBase === "memory.md") {
        return 1;
      }
      return leftBase.localeCompare(rightBase);
    });

  const documents: ClaudeProjectMemoryDocument[] = [];
  for (const filePath of files) {
    if (remainingChars <= 0) {
      truncated = true;
      break;
    }

    let content = "";
    try {
      content = readFileSync(filePath, "utf8").trim();
    } catch (error) {
      console.warn("[claude-project-memory] Failed to read memory file:", filePath, error);
      continue;
    }

    if (!content) {
      continue;
    }

    if (content.length > maxFileChars) {
      content = `${content.slice(0, maxFileChars).trimEnd()}\n\n[truncated: file exceeded ${maxFileChars} chars]`;
      truncated = true;
    }

    if (content.length > remainingChars) {
      content = `${content.slice(0, remainingChars).trimEnd()}\n\n[truncated: memory budget exceeded ${maxChars} chars]`;
      truncated = true;
    }

    documents.push({
      path: filePath,
      name: basename(filePath),
      content,
    });
    remainingChars -= content.length;
  }

  if (documents.length === 0) {
    return undefined;
  }

  return {
    projectSlug,
    memoryDir,
    documents,
    truncated,
  };
}

export function buildClaudeProjectMemoryPromptAppend(
  cwd: string | undefined,
  options: ClaudeProjectMemoryOptions = {},
): string | undefined {
  const bundle = loadClaudeProjectMemory(cwd, options);
  if (!bundle) {
    return undefined;
  }

  const sectio
... (truncated)
```
