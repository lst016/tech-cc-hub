import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { basename, join, resolve } from "path";

export type KnowledgeWorkspacePaths = {
  workspaceRoot: string;
  workspaceSlug: string;
  workspaceScope: string;
  workspaceHash: string;
  techRoot: string;
  memoryDir: string;
  memoryJsonPath: string;
  appDataRoot: string;
  appDataWorkspaceRoot: string;
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
  const memoryDir = join(techRoot, "memory");
  const appDataRoot = join(appDataPath, "knowledge");
  const appDataWorkspaceRoot = join(appDataRoot, workspaceHash);

  return {
    workspaceRoot: resolvedRoot,
    workspaceSlug,
    workspaceScope: createWorkspaceScope(resolvedRoot),
    workspaceHash,
    techRoot,
    memoryDir,
    memoryJsonPath: join(memoryDir, "memories.json"),
    appDataRoot,
    appDataWorkspaceRoot,
    memoryDbPath: join(appDataWorkspaceRoot, "memory.sqlite"),
  };
}

export function ensureKnowledgeWorkspaceDirectories(paths: KnowledgeWorkspacePaths): void {
  for (const dir of [
    paths.memoryDir,
    paths.appDataWorkspaceRoot,
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
