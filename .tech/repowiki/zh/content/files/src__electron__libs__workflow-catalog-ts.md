# src/electron/libs/workflow-catalog.ts

> 模块：`electron` · 语言：`typescript` · 行数：172

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildSessionWorkflowCatalog@12`
- `resolveWorkflowRoots@56`
- `discoverWorkflowLayer@64`
- `walkMarkdownFiles@96`
- `extractLatestUserPrompt@120`
- `inferWorkflowTags@131`
- `workflowScopeOrder@157`
- `USER_WORKFLOW_ROOT@10`
- `roots@18`
- `root@23`
- `result@25`
- `latestPrompt@29`
- `inferredTags@31`
- `selection@32`
- `markdown@74`
- `parsed@75`
- `message@77`
- `pending@99`
- `current@102`
- `fullPath@106`
- `message@124`
- `normalized@133`
- `tags@135`

## 依赖输入

- `fs`
- `os`
- `path`
- `electron`
- `../types.js`
- `../../shared/workflow-markdown.js`
- `../../shared/workflow-selector.js`

## 对外暴露

- `buildSessionWorkflowCatalog`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  return undefin
... (truncated)
```
