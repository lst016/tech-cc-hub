import { app } from "electron";
import { existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import {
  buildManagedCodeGraphContext,
  getManagedCodeGraphImpact,
  getManagedCodeGraphStatus,
  indexManagedCodeGraph,
  isManagedCodeGraphInitialized,
  searchManagedCodeGraph,
  syncManagedCodeGraph,
} from "../codegraph/managed-codegraph.js";
import type { NodeKind } from "@colbymchenry/codegraph";
import { resolveKnowledgeWorkspacePaths, ensureKnowledgeWorkspaceDirectories } from "../knowledge/knowledge-paths.js";
import { MemoryRepository } from "../memory/memory-repository.js";
import { MEMORY_CATEGORIES, type MemoryCategory, type MemoryScope } from "../memory/memory-types.js";
import { toTextToolResult } from "./tool-result.js";

export const KNOWLEDGE_TOOL_NAMES = [
  "codegraph_status",
  "codegraph_sync",
  "codegraph_search",
  "codegraph_context",
  "codegraph_impact",
  "memory_update",
] as const;

const KNOWLEDGE_MCP_SERVER_NAME = "tech-cc-hub-knowledge";
const KNOWLEDGE_MCP_SERVER_VERSION = "1.0.0";
const CODEGRAPH_RETRIEVAL_TIMEOUT_MS = 5_000;
const CODEGRAPH_SLOW_RETRIEVAL_MS = CODEGRAPH_RETRIEVAL_TIMEOUT_MS;
const CODEGRAPH_SLOW_COOLDOWN_MS = 10 * 60 * 1_000;
const MEMORY_JSON_MIRROR_LIMIT = 200;

type CodeGraphSlowCircuit = {
  label: string;
  durationMs: number;
  openedAt: number;
  expiresAt: number;
};

const slowCodeGraphRetrievals = new Map<string, CodeGraphSlowCircuit>();

const CODEGRAPH_STATUS_SCHEMA = {
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const CODEGRAPH_SYNC_SCHEMA = {
  mode: z.enum(["sync", "index"]).optional().describe("sync=incremental update, index=full index. Defaults to sync."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const CODEGRAPH_SEARCH_SCHEMA = {
  query: z.string().min(1).describe("Symbol or text to search in the managed code graph."),
  kinds: z.string().optional().describe("Optional comma-separated node kinds, for example function,class,route."),
  limit: z.number().min(1).max(50).optional().describe("Defaults to 10."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const CODEGRAPH_CONTEXT_SCHEMA = {
  task: z.string().min(1).optional().describe("Natural-language task or requirement to map to code context. Preferred field."),
  query: z.string().min(1).optional().describe("Backward-compatible alias for task."),
  maxNodes: z.number().min(1).max(80).optional().describe("Defaults to 20."),
  includeCode: z.boolean().optional().describe("Include source snippets. Defaults to false to keep context small."),
  workspaceRoot: z.string().optional().describe("Workspace root. Defaults to current session cwd."),
};

const CODEGRAPH_IMPACT_SCHEMA = {
  nodeId: z.string().min(1).describe("CodeGraph node id returned by codegraph_search or codegraph_context."),
  maxDepth: z.number().min(1).max(6).optional().describe("Defaults to 3."),
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
  const workspaceRoot = resolve(input?.trim() || defaultWorkspaceRoot || process.cwd());
  if (!existsSync(workspaceRoot)) {
    throw new Error(`workspaceRoot does not exist: ${workspaceRoot}`);
  }
  return workspaceRoot;
}

function parseTags(value: string | undefined): string[] {
  return value?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [];
}

function parseCodeGraphKinds(value: string | undefined): NodeKind[] | undefined {
  const kinds = parseTags(value);
  return kinds.length > 0 ? kinds as NodeKind[] : undefined;
}

function resolveCodeGraphContextTask(input: { task?: string; query?: string }): string {
  const task = input.task?.trim() || input.query?.trim() || "";
  if (!task) {
    throw new Error("task is required. You can also pass query as a backward-compatible alias.");
  }
  return task;
}

function resolveMemoryScope(scope: "global" | "workspace", workspaceScope: string): MemoryScope {
  return scope === "global" ? "global" : workspaceScope as MemoryScope;
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
  const mirroredEntries = repo.listAll(workspaceScope as MemoryScope, { limit: MEMORY_JSON_MIRROR_LIMIT + 1 });
  const truncated = mirroredEntries.length > MEMORY_JSON_MIRROR_LIMIT;
  const entries = truncated ? mirroredEntries.slice(0, MEMORY_JSON_MIRROR_LIMIT) : mirroredEntries;
  writeFileSync(memoryJsonPath, `${JSON.stringify({ version: 1, updatedAt: Date.now(), truncated, entries }, null, 2)}\n`, "utf8");
}

async function runCodeGraphRetrievalWithTimeout<T>(
  label: string,
  workspaceRoot: string,
  run: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const activeCircuit = slowCodeGraphRetrievals.get(workspaceRoot);
  if (activeCircuit && activeCircuit.expiresAt > now) {
    const waitSeconds = Math.ceil((activeCircuit.expiresAt - now) / 1000);
    throw new Error(
      `CodeGraph is temporarily bypassed for this workspace because ${activeCircuit.label} took ${activeCircuit.durationMs}ms on this machine. Fall back to focused Read/Grep/Glob for this turn; retry CodeGraph after about ${waitSeconds}s.`,
    );
  }
  if (activeCircuit) {
    slowCodeGraphRetrievals.delete(workspaceRoot);
  }

  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} exceeded ${CODEGRAPH_RETRIEVAL_TIMEOUT_MS}ms. Fall back to focused Read/Grep/Glob for this turn.`));
        }, CODEGRAPH_RETRIEVAL_TIMEOUT_MS);
      }),
    ]);
    recordSlowCodeGraphRetrieval(workspaceRoot, label, Date.now() - startedAt);
    return result;
  } catch (error) {
    recordSlowCodeGraphRetrieval(workspaceRoot, label, Date.now() - startedAt);
    throw error;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function recordSlowCodeGraphRetrieval(workspaceRoot: string, label: string, durationMs: number): void {
  if (durationMs < CODEGRAPH_SLOW_RETRIEVAL_MS) {
    return;
  }
  const openedAt = Date.now();
  slowCodeGraphRetrievals.set(workspaceRoot, {
    label,
    durationMs,
    openedAt,
    expiresAt: openedAt + CODEGRAPH_SLOW_COOLDOWN_MS,
  });
}

export function getKnowledgeMcpServer(defaultWorkspaceRoot?: string): McpSdkServerConfigWithInstance {
  const codegraphStatusHandler = tool(
    "codegraph_status",
    "Check the tech-cc-hub managed CodeGraph index. Storage is owned by tech-cc-hub under .tech/codegraph, never upstream .codegraph.",
    CODEGRAPH_STATUS_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        return toTextToolResult(await getManagedCodeGraphStatus(workspaceRoot));
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const codegraphSyncHandler = tool(
    "codegraph_sync",
    "Explicitly create or refresh the tech-cc-hub managed CodeGraph index under .tech/codegraph. Defaults to incremental sync when initialized and full index when missing.",
    CODEGRAPH_SYNC_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const initialized = isManagedCodeGraphInitialized(workspaceRoot);
        const mode = input.mode === "index" || !initialized ? "index" : "sync";
        const result = mode === "index"
          ? await indexManagedCodeGraph(workspaceRoot)
          : await syncManagedCodeGraph(workspaceRoot);
        return toTextToolResult({ success: true, mode, workspaceRoot, result });
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const codegraphSearchHandler = tool(
    "codegraph_search",
    "Search symbols in the existing tech-cc-hub managed CodeGraph index before broad Read/Grep exploration. Retrieval is fast-path only: it does not auto-index or sync. If results are empty, unavailable, slow, or temporarily bypassed, fall back to focused Read/Grep/Glob unless the user explicitly asks to refresh CodeGraph.",
    CODEGRAPH_SEARCH_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const results = await runCodeGraphRetrievalWithTimeout(
          "codegraph_search",
          workspaceRoot,
          () => searchManagedCodeGraph(workspaceRoot, input.query, {
            kinds: parseCodeGraphKinds(input.kinds),
            limit: input.limit ?? 10,
          }),
        );
        return toTextToolResult({ success: true, workspaceRoot, query: input.query, results });
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const codegraphContextHandler = tool(
    "codegraph_context",
    "Build compact graph context for a task or requirement from the existing managed CodeGraph index. Retrieval does not auto-index or sync; fall back to focused source reads if the index is unavailable, slow, or temporarily bypassed.",
    CODEGRAPH_CONTEXT_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const task = resolveCodeGraphContextTask(input);
        const context = await runCodeGraphRetrievalWithTimeout(
          "codegraph_context",
          workspaceRoot,
          () => buildManagedCodeGraphContext(workspaceRoot, task, {
            maxNodes: input.maxNodes ?? 20,
            includeCode: input.includeCode ?? false,
            format: "json",
          }),
        );
        return toTextToolResult({ success: true, workspaceRoot, task, context });
      } catch (error) {
        return toTextToolResult({ success: false, error: error instanceof Error ? error.message : String(error) }, true);
      }
    },
  );

  const codegraphImpactHandler = tool(
    "codegraph_impact",
    "Analyze the impact radius for a CodeGraph node id from the existing managed CodeGraph index. Retrieval does not auto-index or sync; fall back to focused source reads if the index is unavailable, slow, or temporarily bypassed.",
    CODEGRAPH_IMPACT_SCHEMA,
    async (input) => {
      try {
        const workspaceRoot = resolveWorkspaceRoot(input.workspaceRoot, defaultWorkspaceRoot);
        const impact = await runCodeGraphRetrievalWithTimeout(
          "codegraph_impact",
          workspaceRoot,
          () => getManagedCodeGraphImpact(workspaceRoot, input.nodeId, input.maxDepth ?? 3),
        );
        return toTextToolResult({ success: true, workspaceRoot, nodeId: input.nodeId, impact });
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

  return createSdkMcpServer({
    name: KNOWLEDGE_MCP_SERVER_NAME,
    version: KNOWLEDGE_MCP_SERVER_VERSION,
    tools: [
      codegraphStatusHandler,
      codegraphSyncHandler,
      codegraphSearchHandler,
      codegraphContextHandler,
      codegraphImpactHandler,
      memoryUpdateHandler,
    ],
  });
}
