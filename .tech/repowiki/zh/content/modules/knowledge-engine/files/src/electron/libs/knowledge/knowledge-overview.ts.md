# src/electron/libs/knowledge/knowledge-overview.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：116

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `groupKnowledge@9`
- `groupMemory@19`
- `buildKnowledgeOverviewPromptAppend@29`
- `escapeXml@108`
- `grouped@11`
- `list@13`
- `grouped@21`
- `list@23`
- `settings@34`
- `paths@36`
- `repo@48`
- `memoryRepo@58`
- `lines@73`
- `groupedKnowledge@77`
- `groupedMemory@90`
- `tags@97`

## 依赖输入

- `electron`
- `fs`
- `./knowledge-model-settings.js`
- `./knowledge-paths.js`
- `./knowledge-repository.js`
- `../memory/memory-repository.js`
- `./knowledge-types.js`
- `../memory/memory-types.js`

## 对外暴露

- `buildKnowledgeOverviewPromptAppend`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { app } from "electron";
import { existsSync } from "fs";
import { resolveKnowledgeModelSettings } from "./knowledge-model-settings.js";
import { resolveKnowledgeWorkspacePaths } from "./knowledge-paths.js";
import { KnowledgeRepository } from "./knowledge-repository.js";
import { MemoryRepository } from "../memory/memory-repository.js";
import type { KnowledgeOverviewEntry } from "./knowledge-types.js";
import type { MemoryOverviewEntry, MemoryScope } from "../memory/memory-types.js";

function groupKnowledge(entries: KnowledgeOverviewEntry[]): Map<string, KnowledgeOverviewEntry[]> {
  const grouped = new Map<string, KnowledgeOverviewEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  return grouped;
}

function groupMemory(entries: MemoryOverviewEntry[]): Map<string, MemoryOverviewEntry[]> {
  const grouped = new Map<string, MemoryOverviewEntry[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  return grouped;
}

export function buildKnowledgeOverviewPromptAppend(projectCwd?: string): string | undefined {
  if (!projectCwd || !existsSync(projectCwd)) {
    return undefined;
  }

  const settings = resolveKnowledgeModelSettings();
  const paths = resolveKnowledgeWorkspacePaths(projectCwd, app.getPath("userData"));
  if (!settings.embedding) {
    return [
      `<knowledge_overview enabled="false" scope="${paths.workspaceScope}" reason="missing_embedding_model">`,
      "Knowledge Engine requires an embeddingModel in model settings. Do not claim knowledge search is enabled until embeddings are configured.",
      "</knowledge_overview>",
    ].join("\n");
  }

  const knowledgeEntries: KnowledgeOverviewEntry[] = [];
  const memoryEntries: MemoryOverviewEntry[] = [];
  if (existsSync(paths.knowledgeDbPath)) {
    const repo = new KnowledgeRepository(paths.knowledgeDbPath, {
      embeddingDimension: settings.embedding.dimension,
    });
    try {
      knowledgeEntries.push(...repo.buildOverview(paths.workspaceScope, 24));
    } finally {
      repo.close();
    }
  }
  if (existsSync(paths.memoryDbPath)) {
    const memoryRepo = new MemoryRepository(paths.memoryDbPath);
    try {
      memoryEntries.push(...memoryRepo.buildOverview(paths.workspaceScope as MemoryScope, 18));
    } finally {
      memoryRepo.close();
    }
  }

  if (knowledgeEntries.length === 0 && memoryEntries.length === 0) {
    return [
      `<knowledge_overview enabled="true" indexed="false" scope="${paths.workspaceScope}">`,
      "No indexed knowledge yet. Use mcp__tech-cc-hub-knowledge__knowledge_index after .tech docs exist or when wiki generation is requested.",
      "</knowledge_overview>",
    ].join("\n");
  }

  const lines = [
    `<knowledge_overview enabled="true" scope="${paths.workspaceScope}" knowledge_count="${knowledgeEntries.length}" memory_count="${memoryEntries.length}">`,
  ];

  const groupedKnowledge = groupKnowledge(knowledgeEntries);
  if (groupedKnowledge.size > 0) {
    lines.push("  <repowiki>");
    for (const [category, entries] of groupedKnowledge) {
      lines.push(`    <category name="${category}" count="${entries.length}">`);
      for (const entry of entries.slice(0, 24)) {
        lines.push(`      <entry title="${escapeXml(entry.title)}" path="${escapeXml(entry.sourcePath)}" />`);
      }
      lines.push("    </category>");
    }
    lines.push("  </repowiki>");
  }

  const groupedMemory = groupMemory(memoryEntries);
  if (groupedMemory.size > 0) {
    lines.push("  <memory>");
    for (const [category, entries] of groupedMemory) {
      lines.push(`    <category name="${category}" count="${entries.length}">`);
      for (const entry of entries.slice(0, 18)) {
        const tags = entry.tags.slice(0, 5).join(",");
        lines.push(`      <entry title="${escapeXml(entry.title)}" scope="${escapeXml(entry.scope)}" tags="${escapeXml(tags)}" />`);
      }
      lines.push("    </category>");
    }
    lines.push("  </memory>");
  }

  lines.push("</knowledge_overview>");
  return lines.join(
... (truncated)
```
