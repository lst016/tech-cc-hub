import { createRequire } from "module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

import type {
  BuildContextOptions,
  CodeGraphConfig,
  GraphStats,
  IndexOptions,
  IndexResult,
  SearchOptions,
  SearchResult,
  Subgraph,
  SyncResult,
  TaskContext,
} from "@colbymchenry/codegraph";

type CodeGraphRuntime = typeof import("@colbymchenry/codegraph");
type CodeGraphConfigRuntime = typeof import("@colbymchenry/codegraph/dist/config.js");
type CodeGraphDbRuntime = typeof import("@colbymchenry/codegraph/dist/db/index.js");
type CodeGraphQueriesRuntime = typeof import("@colbymchenry/codegraph/dist/db/queries.js");
type CodeGraphUtilsRuntime = typeof import("@colbymchenry/codegraph/dist/utils.js");

export type ManagedCodeGraphPaths = {
  workspaceRoot: string;
  techRoot: string;
  codegraphRoot: string;
  configPath: string;
  databasePath: string;
  lockPath: string;
  cacheDir: string;
  upstreamCodegraphRoot: string;
};

export type ManagedCodeGraphStatus = {
  initialized: boolean;
  watching: boolean;
  indexing: boolean;
  backend?: string;
  paths: ManagedCodeGraphPaths;
  stats?: GraphStats;
};

export type ManagedCodeGraphOpenOptions = {
  config?: Partial<CodeGraphConfig>;
  index?: boolean;
  sync?: boolean;
  watch?: boolean;
  onProgress?: IndexOptions["onProgress"];
};

export type ManagedCodeGraphInstance = {
  close(): void;
  indexAll(options?: IndexOptions): Promise<IndexResult>;
  sync(options?: IndexOptions): Promise<SyncResult>;
  watch(): boolean;
  unwatch(): void;
  isWatching(): boolean;
  isIndexing(): boolean;
  getBackend(): string;
  getStats(): GraphStats;
  searchNodes(query: string, options?: SearchOptions): SearchResult[];
  buildContext(input: string, options?: BuildContextOptions): Promise<TaskContext | string>;
  getImpactRadius(nodeId: string, maxDepth?: number): Subgraph;
  updateConfig(updates: Partial<CodeGraphConfig>): void;
  uninitialize(): void;
  fileLock?: InstanceType<CodeGraphUtilsRuntime["FileLock"]>;
};

export type ManagedCodeGraphSkippedSyncResult = {
  skipped: true;
  reason: "not_initialized";
  filesAdded: 0;
  filesChanged: 0;
  filesRemoved: 0;
  durationMs: 0;
};

export type ManagedCodeGraphSyncResult = SyncResult | ManagedCodeGraphSkippedSyncResult;

const require = createRequire(import.meta.url);
const codegraphRuntime = require("@colbymchenry/codegraph") as CodeGraphRuntime;
const configRuntime = require("@colbymchenry/codegraph/dist/config.js") as CodeGraphConfigRuntime;
const dbRuntime = require("@colbymchenry/codegraph/dist/db/index.js") as CodeGraphDbRuntime;
const queriesRuntime = require("@colbymchenry/codegraph/dist/db/queries.js") as CodeGraphQueriesRuntime;
const utilsRuntime = require("@colbymchenry/codegraph/dist/utils.js") as CodeGraphUtilsRuntime;

const MANAGED_CODEGRAPH_DIR = "codegraph";
const MANAGED_GITIGNORE = [
  "# tech-cc-hub managed CodeGraph cache",
  "# Local graph DB/cache files should not be committed.",
  "*",
  "!.gitignore",
  "",
].join("\n");

const MANAGED_EXCLUDES = [
  "**/.tech/codegraph/**",
  "**/.tech/repowiki/**",
  "**/.codegraph/**",
  "**/.omx/**",
];

const instances = new Map<string, ManagedCodeGraphInstance>();

export function resolveManagedCodeGraphPaths(workspaceRoot: string): ManagedCodeGraphPaths {
  const root = resolve(workspaceRoot);
  const techRoot = join(root, ".tech");
  const codegraphRoot = join(techRoot, MANAGED_CODEGRAPH_DIR);
  return {
    workspaceRoot: root,
    techRoot,
    codegraphRoot,
    configPath: join(codegraphRoot, "config.json"),
    databasePath: join(codegraphRoot, "codegraph.db"),
    lockPath: join(codegraphRoot, "codegraph.lock"),
    cacheDir: join(codegraphRoot, "cache"),
    upstreamCodegraphRoot: join(root, ".codegraph"),
  };
}

export function isManagedCodeGraphInitialized(workspaceRoot: string): boolean {
  return existsSync(resolveManagedCodeGraphPaths(workspaceRoot).databasePath);
}

export async function openManagedCodeGraph(
  workspaceRoot: string,
  options: ManagedCodeGraphOpenOptions = {},
): Promise<ManagedCodeGraphInstance> {
  const paths = resolveManagedCodeGraphPaths(workspaceRoot);
  const cacheKey = paths.workspaceRoot;
  const cached = instances.get(cacheKey);

  if (cached) {
    if (options.sync) {
      await cached.sync({ onProgress: options.onProgress });
    }
    if (options.watch) {
      cached.watch();
    }
    return cached;
  }

  ensureManagedCodeGraphDirectory(paths);
  await codegraphRuntime.initGrammars();

  const isInitialized = existsSync(paths.databasePath);
  const config = loadOrCreateManagedConfig(paths, options.config);
  const db = isInitialized
    ? dbRuntime.DatabaseConnection.open(paths.databasePath)
    : dbRuntime.DatabaseConnection.initialize(paths.databasePath);
  const queries = new queriesRuntime.QueryBuilder(db.getDb());
  const graph = Reflect.construct(codegraphRuntime.CodeGraph, [
    db,
    queries,
    config,
    paths.workspaceRoot,
  ]) as ManagedCodeGraphInstance;

  graph.fileLock = new utilsRuntime.FileLock(paths.lockPath);
  hardenManagedInstance(graph, paths, config);
  instances.set(cacheKey, graph);

  try {
    if (!isInitialized && options.index) {
      await graph.indexAll({ onProgress: options.onProgress });
    } else if (options.sync) {
      await graph.sync({ onProgress: options.onProgress });
    }
    if (options.watch) {
      graph.watch();
    }
    return graph;
  } catch (error) {
    instances.delete(cacheKey);
    graph.close();
    throw error;
  }
}

export async function getManagedCodeGraphStatus(workspaceRoot: string): Promise<ManagedCodeGraphStatus> {
  const paths = resolveManagedCodeGraphPaths(workspaceRoot);
  const cached = instances.get(paths.workspaceRoot);
  if (cached) {
    return {
      initialized: true,
      watching: cached.isWatching(),
      indexing: cached.isIndexing(),
      backend: cached.getBackend(),
      paths,
      stats: cached.getStats(),
    };
  }

  if (!existsSync(paths.databasePath)) {
    return {
      initialized: false,
      watching: false,
      indexing: false,
      paths,
    };
  }

  const graph = await openManagedCodeGraph(paths.workspaceRoot);
  return {
    initialized: true,
    watching: graph.isWatching(),
    indexing: graph.isIndexing(),
    backend: graph.getBackend(),
    paths,
    stats: graph.getStats(),
  };
}

export async function syncManagedCodeGraph(workspaceRoot: string): Promise<ManagedCodeGraphSyncResult> {
  if (!isManagedCodeGraphInitialized(workspaceRoot)) {
    return {
      skipped: true,
      reason: "not_initialized",
      filesAdded: 0,
      filesChanged: 0,
      filesRemoved: 0,
      durationMs: 0,
    };
  }
  const graph = await openManagedCodeGraph(workspaceRoot);
  return graph.sync();
}

async function openManagedCodeGraphForRetrieval(workspaceRoot: string): Promise<ManagedCodeGraphInstance> {
  if (!isManagedCodeGraphInitialized(workspaceRoot)) {
    throw new Error("CodeGraph index is not initialized. Use codegraph_sync with mode=index only when the user explicitly wants a refresh, otherwise fall back to focused Read/Grep/Glob.");
  }
  return openManagedCodeGraph(workspaceRoot);
}

export async function indexManagedCodeGraph(workspaceRoot: string, options: IndexOptions = {}): Promise<IndexResult> {
  const graph = await openManagedCodeGraph(workspaceRoot);
  return graph.indexAll(options);
}

export async function searchManagedCodeGraph(
  workspaceRoot: string,
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  if (!isManagedCodeGraphInitialized(workspaceRoot)) {
    return [];
  }
  const graph = await openManagedCodeGraphForRetrieval(workspaceRoot);
  return graph.searchNodes(query, options);
}

export async function buildManagedCodeGraphContext(
  workspaceRoot: string,
  task: string,
  options?: BuildContextOptions,
): Promise<TaskContext | string> {
  const graph = await openManagedCodeGraphForRetrieval(workspaceRoot);
  return graph.buildContext(task, options);
}

export async function getManagedCodeGraphImpact(
  workspaceRoot: string,
  nodeId: string,
  maxDepth = 3,
): Promise<Subgraph> {
  const graph = await openManagedCodeGraphForRetrieval(workspaceRoot);
  return graph.getImpactRadius(nodeId, maxDepth);
}

export function closeManagedCodeGraph(workspaceRoot: string): void {
  const paths = resolveManagedCodeGraphPaths(workspaceRoot);
  const graph = instances.get(paths.workspaceRoot);
  if (!graph) return;
  instances.delete(paths.workspaceRoot);
  graph.close();
}

function ensureManagedCodeGraphDirectory(paths: ManagedCodeGraphPaths): void {
  mkdirSync(paths.codegraphRoot, { recursive: true });
  mkdirSync(paths.cacheDir, { recursive: true });
  writeFileSync(join(paths.codegraphRoot, ".gitignore"), MANAGED_GITIGNORE, "utf8");
}

function loadOrCreateManagedConfig(
  paths: ManagedCodeGraphPaths,
  overrides?: Partial<CodeGraphConfig>,
): CodeGraphConfig {
  if (existsSync(paths.configPath)) {
    const parsed = JSON.parse(readFileSync(paths.configPath, "utf8")) as unknown;
    if (!configRuntime.validateConfig(parsed)) {
      throw new Error(`Invalid managed CodeGraph config: ${paths.configPath}`);
    }
    const merged = normalizeManagedConfig(paths, { ...parsed, ...overrides });
    saveManagedConfig(paths, merged);
    return merged;
  }

  const config = normalizeManagedConfig(paths, {
    ...configRuntime.createDefaultConfig(paths.workspaceRoot),
    ...overrides,
  });
  saveManagedConfig(paths, config);
  return config;
}

function normalizeManagedConfig(paths: ManagedCodeGraphPaths, config: CodeGraphConfig): CodeGraphConfig {
  const exclude = Array.from(new Set([...(config.exclude ?? []), ...MANAGED_EXCLUDES]));
  return {
    ...config,
    rootDir: paths.workspaceRoot,
    exclude,
  };
}

function saveManagedConfig(paths: ManagedCodeGraphPaths, config: CodeGraphConfig): void {
  writeFileSync(paths.configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function hardenManagedInstance(
  graph: ManagedCodeGraphInstance,
  paths: ManagedCodeGraphPaths,
  config: CodeGraphConfig,
): void {
  graph.updateConfig = (updates: Partial<CodeGraphConfig>) => {
    Object.assign(config, updates);
    const normalized = normalizeManagedConfig(paths, config);
    Object.assign(config, normalized);
    saveManagedConfig(paths, normalized);
  };
  graph.uninitialize = () => {
    throw new Error("Managed CodeGraph storage is owned by tech-cc-hub; remove .tech/codegraph through the managed service.");
  };
}
