import { app } from "electron";
import { existsSync } from "fs";
import { resolveKnowledgeModelSettings } from "./knowledge-model-settings.js";
import { resolveKnowledgeWorkspacePaths } from "./knowledge-paths.js";
import { KnowledgeRepository } from "./knowledge-repository.js";
import { listLinkedKnowledgeWorkspaces } from "./knowledge-workspace-links.js";
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
  const appDataPath = app.getPath("userData");
  const paths = resolveKnowledgeWorkspacePaths(projectCwd, appDataPath);
  if (!settings.embedding) {
    return [
      `<knowledge_overview enabled="false" scope="${paths.workspaceScope}" reason="missing_embedding_model">`,
      "Knowledge Engine requires an embeddingModel in model settings. Do not claim knowledge search is enabled until embeddings are configured.",
      "</knowledge_overview>",
    ].join("\n");
  }

  const knowledgeEntries: KnowledgeOverviewEntry[] = [];
  const memoryEntries: MemoryOverviewEntry[] = [];
  const linkedWorkspaces = listLinkedKnowledgeWorkspaces(appDataPath, projectCwd);
  const linkedWorkspaceEntries: Array<{ name: string; cwd: string; scope: string }> = [];
  if (existsSync(paths.knowledgeDbPath)) {
    const repo = new KnowledgeRepository(paths.knowledgeDbPath, {
      embeddingDimension: settings.embedding.dimension,
    });
    try {
      // Pull a wider candidate set because Agent Cards and Repo Wiki share the
      // same index, then render each section with its own compact limit below.
      knowledgeEntries.push(...repo.buildOverview(paths.workspaceScope, 80));
    } finally {
      repo.close();
    }
  }
  for (const linkedWorkspace of linkedWorkspaces) {
    const linkedPaths = resolveKnowledgeWorkspacePaths(linkedWorkspace.cwd, appDataPath);
    linkedWorkspaceEntries.push({
      name: linkedWorkspace.name,
      cwd: linkedWorkspace.cwd,
      scope: linkedPaths.workspaceScope,
    });
    if (existsSync(linkedPaths.knowledgeDbPath)) {
      const repo = new KnowledgeRepository(linkedPaths.knowledgeDbPath, {
        embeddingDimension: settings.embedding.dimension,
      });
      try {
        knowledgeEntries.push(...repo.buildOverview(linkedPaths.workspaceScope, 32));
      } finally {
        repo.close();
      }
    }
    if (existsSync(linkedPaths.memoryDbPath)) {
      const memoryRepo = new MemoryRepository(linkedPaths.memoryDbPath);
      try {
        memoryEntries.push(...memoryRepo.buildOverview(linkedPaths.workspaceScope as MemoryScope, 8));
      } finally {
        memoryRepo.close();
      }
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
    `<knowledge_overview enabled="true" scope="${paths.workspaceScope}" linked_count="${linkedWorkspaceEntries.length}" knowledge_count="${knowledgeEntries.length}" memory_count="${memoryEntries.length}">`,
    "  <usage>",
    "    Indexed knowledge is already available. For repo-specific background, architecture, prior decisions, or implementation guidance, call mcp__tech-cc-hub-knowledge__knowledge_search first, then mcp__tech-cc-hub-knowledge__knowledge_read for the selected document before using generic source reads.",
    "    Use agent_cards for where-to-start and change-plan questions; use repowiki for module details and code evidence.",
    "    Do not call mcp__tech-cc-hub-knowledge__knowledge_index just to answer a question. Only use it when the user explicitly asks to generate, refresh, reindex, or update the knowledge base.",
    "  </usage>",
  ];
  if (linkedWorkspaceEntries.length > 0) {
    lines.push("  <linked_workspaces>");
    for (const linked of linkedWorkspaceEntries) {
      lines.push(`    <workspace name="${escapeXml(linked.name)}" scope="${escapeXml(linked.scope)}" cwd="${escapeXml(linked.cwd)}" />`);
    }
    lines.push("  </linked_workspaces>");
  }

  const groupedKnowledge = groupKnowledge(knowledgeEntries);
  const agentCardEntries = groupedKnowledge.get("agent_card") ?? [];
  if (agentCardEntries.length > 0) {
    lines.push(`  <agent_cards count="${agentCardEntries.length}">`);
    for (const entry of agentCardEntries.slice(0, 18)) {
      lines.push(`    <card title="${escapeXml(entry.title)}" path="${escapeXml(entry.sourcePath)}" />`);
    }
    lines.push("  </agent_cards>");
  }

  const repowikiEntries = new Map(Array.from(groupedKnowledge.entries()).filter(([category]) => category !== "agent_card"));
  if (repowikiEntries.size > 0) {
    lines.push("  <repowiki>");
    for (const [category, entries] of repowikiEntries) {
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
