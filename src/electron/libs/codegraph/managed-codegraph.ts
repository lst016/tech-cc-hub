import { createRequire } from "module";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve, sep } from "path";

import type {
  BuildContextOptions,
  FileLock,
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

export type ManagedCodeGraphPaths = {
  workspaceRoot: string;
  techRoot: string;
  codegraphRoot: string;
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

export type ManagedCodeGraphRuntimeInfo = {
  source: "package" | "packaged-unpacked";
  entry: string;
  platformPackage?: string;
  treeSitterPath?: string;
};

export type ManagedCodeGraphOpenOptions = {
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
  uninitialize(): void;
  fileLock?: FileLock;
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

export type ManagedCodeGraphEnsureSyncResult = {
  mode: "index" | "sync";
  result: IndexResult | ManagedCodeGraphSyncResult;
};

const require = createRequire(import.meta.url);
const codegraphRuntimeInfo = resolveCodeGraphRuntimeInfo();
const codegraphRuntime = require(codegraphRuntimeInfo.entry) as CodeGraphRuntime;

const MANAGED_CODEGRAPH_DIR = "codegraph";
const MANAGED_GITIGNORE = [
  "# tech-cc-hub managed CodeGraph cache",
  "# Local graph DB/cache files should not be committed.",
  "*",
  "!.gitignore",
  "",
].join("\n");

const instances = new Map<string, ManagedCodeGraphInstance>();

function resolveCodeGraphRuntimeInfo(): ManagedCodeGraphRuntimeInfo {
  const unpackedRuntime = resolvePackagedUnpackedCodeGraphRuntime();
  if (unpackedRuntime) {
    return unpackedRuntime;
  }

  return {
    source: "package",
    entry: require.resolve("@colbymchenry/codegraph"),
  };
}

function resolvePackagedUnpackedCodeGraphRuntime(): ManagedCodeGraphRuntimeInfo | null {
  const platformPackage = `@colbymchenry/codegraph-${process.platform}-${process.arch}`;

  try {
    const platformPackageJson = require.resolve(`${platformPackage}/package.json`);
    const unpackedPackageJson = platformPackageJson.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);

    if (unpackedPackageJson === platformPackageJson || !existsSync(unpackedPackageJson)) {
      return null;
    }

    const packageRoot = dirname(unpackedPackageJson);
    const entry = join(packageRoot, "lib", "dist", "index.js");
    const treeSitter = join(packageRoot, "lib", "node_modules", "web-tree-sitter", "tree-sitter.cjs");
    if (existsSync(entry) && existsSync(treeSitter)) {
      return {
        source: "packaged-unpacked",
        entry,
        platformPackage,
        treeSitterPath: treeSitter,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function getManagedCodeGraphRuntimeInfo(): ManagedCodeGraphRuntimeInfo {
  return { ...codegraphRuntimeInfo };
}

export function resolveManagedCodeGraphPaths(workspaceRoot: string): ManagedCodeGraphPaths {
  const root = resolve(workspaceRoot);
  const techRoot = join(root, ".tech");
  const codegraphRoot = join(techRoot, MANAGED_CODEGRAPH_DIR);
  return {
    workspaceRoot: root,
    techRoot,
    codegraphRoot,
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
  const db = isInitialized
    ? codegraphRuntime.DatabaseConnection.open(paths.databasePath)
    : codegraphRuntime.DatabaseConnection.initialize(paths.databasePath);
  const queries = new codegraphRuntime.QueryBuilder(db.getDb());
  const graph = Reflect.construct(codegraphRuntime.CodeGraph, [
    db,
    queries,
    paths.workspaceRoot,
  ]) as ManagedCodeGraphInstance;

  graph.fileLock = new codegraphRuntime.FileLock(paths.lockPath);
  hardenManagedInstance(graph);
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

export async function syncManagedCodeGraph(workspaceRoot: string, options: IndexOptions = {}): Promise<ManagedCodeGraphSyncResult> {
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
  return graph.sync(options);
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

export async function ensureManagedCodeGraphSynced(
  workspaceRoot: string,
  options: IndexOptions = {},
): Promise<ManagedCodeGraphEnsureSyncResult> {
  if (!isManagedCodeGraphInitialized(workspaceRoot)) {
    return {
      mode: "index",
      result: await indexManagedCodeGraph(workspaceRoot, options),
    };
  }

  return {
    mode: "sync",
    result: await syncManagedCodeGraph(workspaceRoot, options),
  };
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

function hardenManagedInstance(graph: ManagedCodeGraphInstance): void {
  graph.uninitialize = () => {
    throw new Error("Managed CodeGraph storage is owned by tech-cc-hub; remove .tech/codegraph through the managed service.");
  };
}
