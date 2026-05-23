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

  const sections = [
    "以下是当前工作区对应的 Claude 项目 memory，会作为项目级默认规则与经验参考生效。",
    `来源目录: ${bundle.memoryDir}`,
    "使用要求: 优先遵守这些规则；如果它们与用户当前明确要求冲突，以用户当前要求为准；不要把 memory 当成必须重新读取全项目的理由。",
    "",
  ];

  for (const document of bundle.documents) {
    sections.push(
      [
        `## ${document.name}`,
        document.content,
      ].join("\n"),
    );
  }

  if (bundle.truncated) {
    sections.push("[部分 memory 已按字符预算截断，必要时再按需读取原文件。]");
  }

  return sections.join("\n\n").trim();
}
