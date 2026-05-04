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
  config.agent.maxConcurrentAgents = intValue("agent.maxConcurrentAgents", config.agent.maxConcurrentAgents);
  config.agent.maxAutoRetries = intValue("agent.max_auto_retries", config.agent.maxAutoRetries);
  config.agent.maxAutoRetries = intValue("agent.maxAutoRetries", config.agent.maxAutoRetries);
  config.agent.maxRetryBackoffMs = intValue("agent.max_retry_backoff_ms", config.agent.maxRetryBackoffMs);
  config.agent.maxRetryBackoffMs = intValue("agent.maxRetryBackoffMs", config.agent.maxRetryBackoffMs);
  config.agent.stallTimeoutMs = intValue("agent.stall_timeout_ms", config.agent.stallTimeoutMs);
  config.agent.stallTimeoutMs = intValue("agent.stallTimeoutMs", config.agent.stallTimeoutMs);
  config.hooks.timeoutMs = intValue("hooks.timeout_ms", config.hooks.timeoutMs);
  config.hooks.timeoutMs = intValue("hooks.timeoutMs", config.hooks.timeoutMs);

  const workspaceRoot = values["workspace.root"]?.trim();
  if (workspaceRoot) {
    config.workspace.root = resolve(workspaceRoot);
  }
}
