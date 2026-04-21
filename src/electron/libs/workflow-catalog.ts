import { existsSync, readFileSync, readdirSync } from "fs";
import { homedir } from "os";
import { basename, extname, join } from "path";

import { app } from "electron";

import type { StreamMessage, WorkflowCatalogEntry, SessionWorkflowCatalog } from "../types.js";
import { parseWorkflowMarkdown, type WorkflowScope } from "../../shared/workflow-markdown.js";
import { selectWorkflowCandidates } from "../../shared/workflow-selector.js";

const USER_WORKFLOW_ROOT = join(homedir(), ".claude", "workflows");

export function buildSessionWorkflowCatalog(options: {
  sessionId: string;
  cwd?: string;
  messages?: StreamMessage[];
}): SessionWorkflowCatalog {
  const roots = resolveWorkflowRoots(options.cwd);
  const catalogEntries: WorkflowCatalogEntry[] = [];
  const issues: string[] = [];

  for (const layer of ["system", "user", "project"] as const) {
    const root = roots[layer];
    if (!root || !existsSync(root)) continue;
    const result = discoverWorkflowLayer(layer, root);
    catalogEntries.push(...result.entries);
    issues.push(...result.issues);
  }

  const latestPrompt = extractLatestUserPrompt(options.messages);
  const inferredTags = inferWorkflowTags(latestPrompt);
  const selection = selectWorkflowCandidates(
    catalogEntries.map((entry) => entry.document),
    {
      prompt: latestPrompt,
      cwd: options.cwd,
      tags: inferredTags,
      strictPathFiltering: false,
    },
  );

  return {
    sessionId: options.sessionId,
    roots,
    entries: catalogEntries.sort((left, right) => {
      if (left.sourceLayer !== right.sourceLayer) {
        return workflowScopeOrder(left.sourceLayer) - workflowScopeOrder(right.sourceLayer);
      }
      return left.document.name.localeCompare(right.document.name);
    }),
    recommendedWorkflowId: selection.recommendedWorkflowId,
    autoSelectedWorkflowId: selection.autoSelectedWorkflowId,
    issues: issues.length > 0 ? issues : undefined,
  };
}

function resolveWorkflowRoots(cwd?: string): Partial<Record<Exclude<WorkflowScope, "session">, string>> {
  return {
    system: join(app.getPath("userData"), "system-workflows"),
    user: USER_WORKFLOW_ROOT,
    project: cwd?.trim() ? join(cwd.trim(), ".claude", "workflows") : undefined,
  };
}

function discoverWorkflowLayer(
  sourceLayer: Exclude<WorkflowScope, "session">,
  rootPath: string,
): { entries: WorkflowCatalogEntry[]; issues: string[] } {
  const entries: WorkflowCatalogEntry[] = [];
  const issues: string[] = [];

  for (const filePath of walkMarkdownFiles(rootPath)) {
    try {
      const markdown = readFileSync(filePath, "utf8");
      const parsed = parseWorkflowMarkdown(markdown);
      if (!parsed.ok || !parsed.document) {
        const message = parsed.errors.map((item) => item.message).join("; ") || "Invalid workflow markdown";
        issues.push(`${basename(filePath)}: ${message}`);
        continue;
      }

      entries.push({
        workflowId: parsed.document.workflowId,
        sourceLayer,
        sourcePath: filePath,
        markdown,
        document: parsed.document,
      });
    } catch (error) {
      issues.push(`${basename(filePath)}: ${String(error)}`);
    }
  }

  return { entries, issues };
}

function walkMarkdownFiles(rootPath: string): string[] {
  const files: string[] = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !existsSync(current)) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function extractLatestUserPrompt(messages?: StreamMessage[]): string | undefined {
  if (!messages?.length) return undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.type === "user_prompt" && typeof message.prompt === "string" && message.prompt.trim()) {
      return message.prompt.trim();
    }
  }
  return undefined;
}

function inferWorkflowTags(prompt?: string): string[] {
  const normalized = (prompt ?? "").trim().toLowerCase();
  if (!normalized) return [];

  const tags = new Set<string>();

  if (/\breact\b/.test(normalized)) {
    tags.add("react");
    tags.add("frontend");
  }
  if (/\bui\b|\bcss\b|样式|页面|组件|前端/.test(normalized)) {
    tags.add("frontend");
  }
  if (/\bapi\b|后端|数据库|sql|service|server/.test(normalized)) {
    tags.add("backend");
  }
  if (/bug|fix|修复|报错|异常/.test(normalized)) {
    tags.add("bugfix");
  }
  if (/test|测试|验证/.test(normalized)) {
    tags.add("test");
  }

  return Array.from(tags);
}

function workflowScopeOrder(scope: WorkflowScope): number {
  switch (scope) {
    case "system":
      return 0;
    case "user":
      return 1;
    case "project":
      return 2;
    case "session":
      return 3;
    default:
      return 99;
  }
}
