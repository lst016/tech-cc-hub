import { app } from "electron";
import { existsSync } from "fs";
import { resolveKnowledgeWorkspacePaths } from "./knowledge-paths.js";
import { MemoryRepository } from "../memory/memory-repository.js";
import type { MemoryOverviewEntry, MemoryScope } from "../memory/memory-types.js";

function groupByCategory<T extends { category: string }>(entries: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const entry of entries) {
    const list = grouped.get(entry.category) ?? [];
    list.push(entry);
    grouped.set(entry.category, list);
  }
  return grouped;
}

function codeGraphUsageLines(indent = ""): string[] {
  return [
    `${indent}For each new user turn that needs source-code evidence, treat CodeGraph as the primary code map: call mcp__tech-cc-hub-knowledge__codegraph_search or mcp__tech-cc-hub-knowledge__codegraph_context before broad Read/Grep/Glob/Task exploration.`,
    `${indent}Only fall back to Read/Grep/Glob/Task after CodeGraph finds no useful result, or after CodeGraph/browser evidence identifies exact files that need focused reading or editing.`,
    `${indent}Do not re-read source code that codegraph_context already returned unless you need to verify a small changed range.`,
    `${indent}CodeGraph tools auto-initialize .tech/codegraph when missing and run incremental sync before retrieval; they do not require an LLM or embedding model.`,
  ];
}

export function buildKnowledgeOverviewPromptAppend(projectCwd?: string): string | undefined {
  if (!projectCwd || !existsSync(projectCwd)) {
    return undefined;
  }

  const appDataPath = app.getPath("userData");
  const paths = resolveKnowledgeWorkspacePaths(projectCwd, appDataPath);
  const memoryEntries: MemoryOverviewEntry[] = [];
  if (existsSync(paths.memoryDbPath)) {
    const memoryRepo = new MemoryRepository(paths.memoryDbPath);
    try {
      memoryEntries.push(...memoryRepo.buildOverview(paths.workspaceScope as MemoryScope, 18));
    } finally {
      memoryRepo.close();
    }
  }

  if (memoryEntries.length === 0) {
    return [
      `<knowledge_overview enabled="true" scope="${paths.workspaceScope}" codegraph="auto" memory_count="0">`,
      "  <usage>",
      ...codeGraphUsageLines("    "),
      "    RepoWiki and legacy vector knowledge indexing are disabled; use CodeGraph for code retrieval and memory_update for durable notes.",
      "  </usage>",
      "</knowledge_overview>",
    ].join("\n");
  }

  const lines = [
    `<knowledge_overview enabled="true" scope="${paths.workspaceScope}" codegraph="auto" memory_count="${memoryEntries.length}">`,
    "  <usage>",
    ...codeGraphUsageLines("    "),
    "    RepoWiki and legacy vector knowledge indexing are disabled; use memory entries only as durable notes, not as source-code evidence.",
    "  </usage>",
  ];

  const groupedMemory = groupByCategory(memoryEntries);
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
  return lines.join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
