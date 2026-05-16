# src/electron/libs/task/workflow.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：146

## 文件职责

源码文件。依赖：fs、path

## 关键符号

- `createDefaultTaskWorkflowConfig@29 - `
- `loadTaskWorkflowConfig@50 - `
- `computeRetryDueAt@74 - `
- `findWorkflowPath@80 - `
- `extractFrontMatter@92 - `
- `parseSimpleFrontMatter@97 - `
- `applyFlatConfig@121 - `
- `DEFAULT_POLLING_INTERVAL_MS@22 - `
- `DEFAULT_MAX_CONCURRENT_AGENTS@24 - `
- `DEFAULT_MAX_AUTO_RETRIES@25 - `
- `DEFAULT_MAX_RETRY_BACKOFF_MS@26 - `
- `DEFAULT_STALL_TIMEOUT_MS@27 - `
- `DEFAULT_HOOK_TIMEOUT_MS@28 - `
- `basePath@31 - `
- `config@56 - `
- `workflowPath@57 - `

## 依赖输入

- `fs`
- `path`

## 对外暴露

- `TaskWorkflowConfig`
- `createDefaultTaskWorkflowConfig`
- `loadTaskWorkflowConfig`
- `computeRetryDueAt`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

export type TaskWorkflowConfig = {
  polling: {
    intervalMs: number;
  };
  workspace: {
    root: string;
  };
  agent: {
    maxConcurrentAgents: number;
    maxAutoRetries: number;
    maxRetryBackoffMs: number;
    stallTimeoutMs: number;
  };
  hooks: {
    timeoutMs: number;
  };
  promptTemplate?: string;
};

const DEFAULT_POLLING_INTERVAL_MS = 30000;
const DEFAULT_MAX_CONCURRENT_AGENTS = 1;
const DEFAULT_MAX_AUTO_RETRIES = 2;
const DEFAULT_MAX_RETRY_BACKOFF_MS = 5 * 60 * 1000;
const DEFAULT_STALL_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_HOOK_TIMEOUT_MS = 30 * 1000;

export function createDefaultTaskWorkflowConfig(userDataPath?: string): TaskWorkflowConfig {
  const basePath = userDataPath?.trim() || process.cwd();
  return {
    polling: {
      intervalMs: DEFAULT_POLLING_INTERVAL_MS,
    },
    workspace: {
      root: resolve(basePath, "task-workspaces"),
    },
    agent: {
      maxConcurrentAgents: DEFAULT_MAX_CONCURRENT_AGENTS,
      maxAutoRetries: DEFAULT_MAX_AUTO_RETRIES,
      maxRetryBackoffMs: DEFAULT_MAX_RETRY_BACKOFF_MS,
      stallTimeoutMs: DEFAULT_STALL_TIMEOUT_MS,
    },
    hooks: {
      timeoutMs: DEFAULT_HOOK_TIMEOUT_MS,
    },
  };
}

export function loadTaskWorkflowConfig(options: {
  userDataPath?: string;
  cwd?: string;
  workflowPath?: string;
} = {}): TaskWorkflowConfig {
  const config = createDefaultTaskWorkflowConfig(options.userDataPath);
  const workflowPath = findWorkflowPath(options);
  if (!workflowPath) return config;

  try {
    const content = readFileSync(workflowPath, "utf8");
    const frontMatter = extractFrontMatter(content);
    if (!frontMatter) return { ...config, promptTemplate: content.trim() || undefined };

    applyFlatConfig(config, parseSimpleFrontMatter(frontMatter));
    const prompt = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim();
    if (prompt) config.promptTemplate = prompt;
  } catch {
    return config;
  }

  return config;
}

export function computeRetryDueAt(attempt: number, config: TaskWorkflowConfig, now = Date.now()): number {
  const normalizedAttempt = Math.max(1, attempt);
  const delayMs = Math.min(10000 * 2 ** (normalizedAttempt - 1), config.agent.maxRetryBackoffMs);
  return now + delayMs;
}

function findWorkflowPath(options: { cwd?: string; workflowPath?: string }): string | null {
  const explicit = options.workflowPath?.trim() || process.env.TECH_CC_TASK_WORKFLOW?.trim();
  if (explicit && existsSync(explicit)) return explicit;

  const cwd = options.cwd?.trim() || process.cwd();
  for (const name of ["TASK_WORKFLOW.md", "WORKFLOW.md"]) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function extractFrontMatter(content: string): string | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  return match?.[1] ?? null;
}

function parseSimpleFrontMatter(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  let section: string | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;

    const sectionMatch = line.match(/^([a-zA-Z0-9_-]+):\s*$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const valueMatch = line.match(/^\s*([a-zA-Z0-9_-]+):\s*(.+?)\s*$/);
    if (!valueMatch) continue;

    const key = section ? `${section}.${valueMatch[1]}` : valueMatch[1];
    values[key] = valueMatch[2].replace(/^["']|["']$/g, "");
  }

  return values;
}

function applyFlatConfig(config: TaskWorkflowConfig, values: Record<string, string>): void {
  const intValue = (key: string, current: number) => {
    const value = Number(values[key]);
    return Number.isFinite(value) && value > 0 ? value : current;
  };

  config.polling.intervalMs = intValue("polling.interval_ms", config.polling.intervalMs);
  config.polling.intervalMs = intValue("polling.intervalMs", config.polling.intervalMs);
  config.agent.maxConcurrentAgents = intValue("agent.max_concurrent_agents", config.agent.maxConcurrentAgents);
  confi
... (truncated)
```
