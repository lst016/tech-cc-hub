import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { basename, join, resolve } from "path";

export type KnowledgeWorkspacePaths = {
  workspaceRoot: string;
  workspaceSlug: string;
  workspaceScope: string;
  workspaceHash: string;
  techRoot: string;
  repowikiRoot: string;
  repowikiContentDir: string;
  agentCardsDir: string;
  repowikiMetaDir: string;
  repowikiMetadataPath: string;
  memoryDir: string;
  memoryJsonPath: string;
  reportsDir: string;
  indexStatePath: string;
  skippedFilesPath: string;
  generationReportPath: string;
  appDataRoot: string;
  appDataWorkspaceRoot: string;
  knowledgeDbPath: string;
  memoryDbPath: string;
};

export function createWorkspaceScope(workspaceRoot: string): string {
  return `workspace:${basename(resolve(workspaceRoot)) || "workspace"}`;
}

export function createWorkspaceHash(workspaceRoot: string): string {
  return createHash("sha256").update(resolve(workspaceRoot)).digest("hex").slice(0, 16);
}

export function resolveKnowledgeWorkspacePaths(workspaceRoot: string, appDataPath: string): KnowledgeWorkspacePaths {
  const resolvedRoot = resolve(workspaceRoot);
  const workspaceSlug = basename(resolvedRoot) || "workspace";
  const workspaceHash = createWorkspaceHash(resolvedRoot);
  const techRoot = join(resolvedRoot, ".tech");
  const repowikiRoot = join(techRoot, "repowiki", "zh");
  const repowikiContentDir = join(repowikiRoot, "content");
  const agentCardsDir = join(repowikiRoot, "agent-cards");
  const repowikiMetaDir = join(repowikiRoot, "meta");
  const memoryDir = join(techRoot, "memory");
  const reportsDir = join(techRoot, "reports");
  const appDataRoot = join(appDataPath, "knowledge");
  const appDataWorkspaceRoot = join(appDataRoot, workspaceHash);

  return {
    workspaceRoot: resolvedRoot,
    workspaceSlug,
    workspaceScope: createWorkspaceScope(resolvedRoot),
    workspaceHash,
    techRoot,
    repowikiRoot,
    repowikiContentDir,
    agentCardsDir,
    repowikiMetaDir,
    repowikiMetadataPath: join(repowikiMetaDir, "repowiki-metadata.json"),
    memoryDir,
    memoryJsonPath: join(memoryDir, "memories.json"),
    reportsDir,
    indexStatePath: join(reportsDir, "index-state.json"),
    skippedFilesPath: join(reportsDir, "skipped-files.json"),
    generationReportPath: join(reportsDir, "generation-report.json"),
    appDataRoot,
    appDataWorkspaceRoot,
    knowledgeDbPath: join(appDataWorkspaceRoot, "knowledge.sqlite"),
    memoryDbPath: join(appDataWorkspaceRoot, "memory.sqlite"),
  };
}

export function ensureKnowledgeWorkspaceDirectories(paths: KnowledgeWorkspacePaths): void {
  for (const dir of [
    paths.repowikiContentDir,
    paths.agentCardsDir,
    paths.repowikiMetaDir,
    paths.memoryDir,
    paths.reportsDir,
    paths.appDataWorkspaceRoot,
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
