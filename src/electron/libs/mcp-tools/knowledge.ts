import { app } from "electron";
import { existsSync, writeFileSync } from "fs";
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { embedTexts } from "../knowledge/embedding-client.js";
import { indexKnowledgeWorkspace } from "../knowledge/knowledge-indexer.js";
import { assertEmbeddingConfigured, resolveKnowledgeModelSettings } from "../knowledge/knowledge-model-settings.js";
import { resolveKnowledgeWorkspacePaths, ensureKnowledgeWorkspaceDirectories } from "../knowledge/knowledge-paths.js";
import { KnowledgeRepository } from "../knowledge/knowledge-repository.js";
import type { KnowledgeSearchMode } from "../knowledge/knowledge-types.js";
import { MemoryRepository } from "../memory/memory-repository.js";
import { MEMORY_CATEGORIES, type MemoryCategory, type MemoryScope } from "../memory/memory-types.js";
import { toTextToolResult } from "./tool-result.js";

export const KNOWLEDGE_TOOL_NAMES = [
  "knowledge_search",
  "knowledge_read",
  "knowledge_explore",
  "knowledge_index",
  "memory_update",
] as const;

const KNOWLEDGE_MCP_SERVER_NAME = "tech-cc-hub-knowledge";
const KNOWLEDGE_MCP_SERVER_VERSION = "1.0.0";
const knowledgeMcpServers = new Map<string, McpSdkServerConfigWithInstance>();

const SEARCH_SCHEMA = {
  query: z.string().min(1).describe("Search query, title, path, or natural-language question."),
  mode: z.enum(["shallow", "deep", "hybrid"]).optional().describe("shallow=FTS, deep=vector, hybrid=vector first then FTS. Defaults to hybrid."),
  source: z.enum(["repowiki", "memory", "all"]).optional().describe("Search .tech RepoWiki, Memory, or both. Defaults to all."),
  category: z.string().optional().describe("Memory category filter, comma-separated."),
  limit: z.number().min(1).max(20).optional().describe("Defaults to 6."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const READ_SCHEMA = {
  id: z.string().optional().describe("Knowledge document id or memory id."),
  path: z.string().optional().describe("Workspace-relative .tech RepoWiki path."),
  title: z.string().optional().describe("Memory title or exact document title."),
  source: z.enum(["repowiki", "memory", "all"]).optional().describe("Defaults to all."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const EXPLORE_SCHEMA = {
  source: z.enum(["repowiki", "memory", "all"]).optional().describe("Defaults to all."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
  limit: z.number().min(1).max(80).optional().describe("Defaults to 40."),
};

const INDEX_SCHEMA = {
  mode: z.enum(["scan", "generate", "refresh"]).optional().describe("scan=index existing .tech docs; generate=call wiki model then index; refresh=generate when configured, then reindex. Defaults to refresh."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const MEMORY_UPDATE_SCHEMA = {
  action: z.enum(["add", "update", "delete"]),
  title: z.string().min(1).max(200),
  content: z.string().optional(),
  category: z.enum([...MEMORY_CATEGORIES] as [MemoryCategory, ...MemoryCategory[]]).optional(),
  tags: z.string().optional().describe("Comma-separated tags."),
  scope: z.enum(["global", "workspace"]).optional().describe("Defaults to workspace."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

function resolveWorkspaceRoot(input: string | undefined, defaultWorkspaceRoot: string | undefined): string {
  const workspaceRoot = input?.trim() || defaultWorkspaceRoot || process.cwd();
  if (!existsSync(workspaceRoot)) {
    throw new Error(`workspaceRoot does not exist: ${workspaceRoot}`);
  }
  return workspaceRoot;
}

function parseMemoryCategories(value: string | undefined): MemoryCategory[] | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const categories = value.split(",").map((item) => item.trim()).filter(Boolean);
  const valid = new Set<string>(MEMORY_CATEGORIES);
  const invalid = categories.filter((item) => !valid.has(item));
  if (invalid.length > 0) {
    throw new Error(`Unsupported memory categories: ${invalid.join(", ")}`);
  }
  return categories as MemoryCategory[];
}

function parseTags(value: string | undefined): string[] {
  return value?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [];
}

function resolveMemoryScope(scope: "global" | "workspace", workspaceScope: string): MemoryScope {
  return scope === "global" ? "global" : workspaceScope as MemoryScope;
}

function openKnowledgeRepository(workspaceRoot: string) {
  const settings = resolveKnowledgeModelSettings();
  const embedding = assertEmbeddingConfigured(settings);
  const paths = resolveKnowledgeWorkspacePaths(workspaceRoot, app.getPath("userData"));
  ensureKnowledgeWorkspaceDirectories(paths);
  const repo = new KnowledgeRepository(paths.knowledgeDbPath, {
    embeddingDimension: embedding.dimension,
  });
  if (!repo.isVectorStoreReady()) {
    repo.close();
    throw new Error("Knowledge Engine 未启用：sqlite-vec 扩展不可用。");
  }
  return { repo, paths, embedding };
}

function openMemoryRepository(workspaceRoot: string) {
  const paths = resolveKnowledgeWorkspacePaths(workspaceRoot, app.getPath("userData"));
  ensureKnowledgeWorkspaceDirectories(paths);
  return {
    repo: new MemoryRepository(paths.memoryDbPath),
    paths,
  };
}

function mirrorMemoryJson(repo: MemoryRepository, workspaceScope: string, memoryJsonPath: string): void {
  const entries = repo.listAll(workspaceScope as MemoryScope);
  writeFileSync(memoryJsonPath, `${JSON.stringify({ version: 1, updatedAt: Date.now(), entries }, null, 2)}\n`, "utf8");
}

export function getKnowledgeMcpServer(defaultWorkspaceRoot?: string): McpSdkServerConfigWithInstance {
  const cacheKey = defaultWorkspaceRoot || "__default__";
  const cached = knowledgeMcpServers.get(cacheKey);
  if (cached) {
    return cached;
  }

  const searchHandler = tool(
    "knowledge_search",
    "Search the built-in Knowledge Engine. Embedding model is mandatory; FTS5 is only a fallback inside hybrid search, not a standalone knowledge feature. Use this before reading full RepoWiki or memory entries.",
    SEARCH_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const source = input.source ?? "all";
        const mode = input.mode ?? "hybrid";
        const limit = input.limit ?? 6;
        const results: Record<string, unknown> = {
          success: true,
          query: input.query,
          source,
          repowiki: [],
          memory: [],
        };

        if (source === "repowiki" || source === "all") {
          const { repo, embedding, paths } = openKnowledgeRepository(workspaceRoot);
          try {
            const [queryEmbedding] = await embedTexts(embedding, [input.query]);
            results.repowiki = repo.search({
              workspaceScope: paths.workspaceScope,
              query: input.query,
              mode: mode as KnowledgeSearchMode,
              sourceKind: "repowiki",
              limit,
              queryEmbedding,
            });
          } finally {
            repo.close();
          }
        }

        if (source === "memory" || source === "all") {
          assertEmbeddingConfigured();
          const { repo, paths } = openMemoryRepository(workspaceRoot);
          try {
            results.memory = repo.search({
              query: input.query,
              workspaceScope: paths.workspaceScope as MemoryScope,
              categories: parseMemoryCategories(input.category),
              mode: mode === "deep" ? "deep" : "shallow",
              limit,
            });
          } finally {
            repo.close();
          }
        }

        return toTextToolResult(results);
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const readHandler = tool(
    "knowledge_read",
    "Read a full Knowledge Engine document or memory entry by id, path, or title after knowledge_search/knowledge_explore finds it.",
    READ_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const source = input.source ?? "all";
        if (source === "repowiki" || source === "all") {
          const { repo, paths } = openKnowledgeRepository(workspaceRoot);
          try {
            const doc = input.id
              ? repo.getDocument(input.id)
              : input.path
                ? repo.getDocumentByPath(paths.workspaceScope, input.path)
                : undefined;
            if (doc) {
              return toTextToolResult({
                success: true,
                source: "repowiki",
                document: doc,
                chunks: repo.readDocumentChunks(doc.id, 80),
              });
            }
          } finally {
            repo.close();
          }
        }

        if (source === "memory" || source === "all") {
          const { repo, paths } = openMemoryRepository(workspaceRoot);
          try {
            const memory = input.id
              ? repo.get(input.id)
              : input.title
                ? repo.getByTitle(input.title, paths.workspaceScope as MemoryScope) ?? repo.getByTitle(input.title, "global")
                : undefined;
            if (memory) {
              repo.recordAccess(memory.id);
              return toTextToolResult({ success: true, source: "memory", memory });
            }
          } finally {
            repo.close();
          }
        }

        return toTextToolResult({ success: false, error: "No matching knowledge or memory entry found." }, true);
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const exploreHandler = tool(
    "knowledge_explore",
    "Explore indexed .tech RepoWiki documents and Memory categories without fetching full content.",
    EXPLORE_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const source = input.source ?? "all";
        const limit = input.limit ?? 40;
        const output: Record<string, unknown> = { success: true, repowiki: [], memory: [] };

        if (source === "repowiki" || source === "all") {
          const { repo, paths } = openKnowledgeRepository(workspaceRoot);
          try {
            output.repowiki = repo.buildOverview(paths.workspaceScope, limit);
          } finally {
            repo.close();
          }
        }

        if (source === "memory" || source === "all") {
          const { repo, paths } = openMemoryRepository(workspaceRoot);
          try {
            output.memory = repo.buildOverview(paths.workspaceScope as MemoryScope, limit);
          } finally {
            repo.close();
          }
        }

        return toTextToolResult(output);
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const indexHandler = tool(
    "knowledge_index",
    "Generate or refresh the .tech Knowledge Engine index. It writes readable Markdown/JSON under .tech and keeps internal SQLite/vector indexes in app data.",
    INDEX_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const report = await indexKnowledgeWorkspace({
          workspaceRoot,
          appDataPath: app.getPath("userData"),
          mode: input.mode ?? "refresh",
        });
        return toTextToolResult(report, !report.success);
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const memoryUpdateHandler = tool(
    "memory_update",
    "Add, update, or soft-delete local Memory entries. Workspace scoped entries are mirrored to .tech/memory/memories.json and stored internally in app-data SQLite.",
    MEMORY_UPDATE_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const { repo, paths } = openMemoryRepository(workspaceRoot);
        try {
          const scope = resolveMemoryScope(input.scope ?? "workspace", paths.workspaceScope);
          if (input.action === "delete") {
            const existing = repo.getByTitle(input.title, scope);
            if (!existing) {
              return toTextToolResult({ success: false, error: `Memory not found: ${input.title}` }, true);
            }
            const deleted = repo.softDelete(existing.id);
            mirrorMemoryJson(repo, paths.workspaceScope, paths.memoryJsonPath);
            return toTextToolResult({ success: deleted, deletedId: existing.id });
          }

          if (!input.content?.trim()) {
            return toTextToolResult({ success: false, error: "content is required for add/update" }, true);
          }
          const category = input.category ?? "task_summary_experience";
          const memory = input.action === "add"
            ? repo.create({
                title: input.title,
                content: input.content,
                category,
                scope,
                tags: parseTags(input.tags),
                source: "agent",
              })
            : repo.upsertByTitle({
                title: input.title,
                content: input.content,
                category,
                scope,
                tags: parseTags(input.tags),
                source: "agent",
              });
          mirrorMemoryJson(repo, paths.workspaceScope, paths.memoryJsonPath);
          return toTextToolResult({ success: true, memory });
        } finally {
          repo.close();
        }
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const server = createSdkMcpServer({
    name: KNOWLEDGE_MCP_SERVER_NAME,
    version: KNOWLEDGE_MCP_SERVER_VERSION,
    tools: [searchHandler, readHandler, exploreHandler, indexHandler, memoryUpdateHandler],
  });
  knowledgeMcpServers.set(cacheKey, server);
  return server;
}
