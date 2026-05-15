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
  return lines.join("\n");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
