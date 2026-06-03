import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type {
  BrowserWorkbenchRecordingArtifact,
  BrowserWorkbenchRecordingArtifactKind,
  BrowserWorkbenchRecordingArtifactUpdateInput,
  BrowserWorkbenchRecordingArtifactUpdateResult,
  BrowserWorkbenchRecordingDocument,
  BrowserWorkbenchRecordingHistoryItem,
  BrowserWorkbenchRecordingPackage,
} from "./types.js";

export type BrowserWorkbenchRecordingWriteResult = {
  rootPath: string;
  files: string[];
};

function resolveArtifactPath(workspaceRoot: string, artifactPath: string): string {
  const root = resolve(workspaceRoot);
  const target = resolve(root, artifactPath);
  const relativePath = relative(root, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`Recording artifact path escapes workspace: ${artifactPath}`);
  }
  return target;
}

function pathInside(root: string, target: string): boolean {
  const relativePath = relative(root, target);
  return Boolean(relativePath) && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function resolveRecordingRootPath(workspaceRoot: string, rootPath: string): string {
  const root = resolve(workspaceRoot);
  const target = resolve(rootPath);
  if (pathInside(root, target)) return target;
  const relativeTarget = resolve(root, rootPath);
  if (pathInside(root, relativeTarget)) return relativeTarget;
  throw new Error(`Recording root escapes workspace: ${rootPath}`);
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readArtifact(root: string, artifact: { kind?: unknown; path?: unknown; language?: unknown }): BrowserWorkbenchRecordingArtifact | null {
  if (typeof artifact.kind !== "string" || typeof artifact.path !== "string") return null;
  const filePath = resolveArtifactPath(root, artifact.path);
  if (!existsSync(filePath)) return null;
  return {
    kind: artifact.kind as BrowserWorkbenchRecordingArtifactKind,
    path: artifact.path,
    content: readFileSync(filePath, "utf8"),
    language: typeof artifact.language === "string" ? artifact.language : undefined,
  };
}

export function writeBrowserWorkbenchRecordingPackage(
  recordingPackage: BrowserWorkbenchRecordingPackage,
  workspaceRoot: string,
): BrowserWorkbenchRecordingWriteResult {
  const root = resolve(workspaceRoot);
  const files: string[] = [];
  for (const artifact of recordingPackage.artifacts) {
    const filePath = resolveArtifactPath(root, artifact.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, artifact.content, "utf8");
    files.push(filePath);
  }

  return {
    rootPath: join(root, recordingPackage.rootPathHint),
    files,
  };
}

export function readBrowserWorkbenchRecordingPackage(
  workspaceRoot: string,
  rootPath: string,
): BrowserWorkbenchRecordingPackage {
  const root = resolve(workspaceRoot);
  const packageRoot = resolveRecordingRootPath(root, rootPath);
  const manifestPath = join(packageRoot, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Recording manifest not found: ${manifestPath}`);
  }
  const manifest = readJsonFile<{
    id?: unknown;
    generatedAt?: unknown;
    recordingPath?: unknown;
    generatedSpecPath?: unknown;
    generatedArtifacts?: Array<{ kind?: unknown; path?: unknown; language?: unknown }>;
  }>(manifestPath);
  const relativeRootPath = relative(root, packageRoot);
  const rootPathHint = relativeRootPath || ".";
  const recordingPath = typeof manifest.recordingPath === "string"
    ? manifest.recordingPath
    : join(rootPathHint, "recording.json");
  const recordingFilePath = resolveArtifactPath(root, recordingPath);
  if (!existsSync(recordingFilePath)) {
    throw new Error(`Recording document not found: ${recordingFilePath}`);
  }
  const recording = readJsonFile<BrowserWorkbenchRecordingDocument>(recordingFilePath);
  const generatedSpecPath = typeof manifest.generatedSpecPath === "string"
    ? manifest.generatedSpecPath
    : recordingPath;
  const artifactRecords = Array.isArray(manifest.generatedArtifacts)
    ? manifest.generatedArtifacts
    : [];
  const seenArtifactPaths = new Set<string>();
  const artifacts = [
    {
      kind: "recording",
      path: recordingPath,
      language: "json",
    },
    ...artifactRecords,
    {
      kind: "manifest",
      path: join(rootPathHint, "manifest.json"),
      language: "json",
    },
    {
      kind: "readme",
      path: join(rootPathHint, "README.md"),
      language: "markdown",
    },
  ]
    .filter((artifact) => {
      if (typeof artifact.path !== "string") return false;
      if (seenArtifactPaths.has(artifact.path)) return false;
      seenArtifactPaths.add(artifact.path);
      return true;
    })
    .map((artifact) => readArtifact(root, artifact))
    .filter((artifact): artifact is BrowserWorkbenchRecordingArtifact => Boolean(artifact));

  return {
    id: typeof manifest.id === "string" ? manifest.id : recording.id,
    createdAt: typeof manifest.generatedAt === "number" ? manifest.generatedAt : recording.completedAt,
    rootPathHint,
    recordingPath,
    generatedSpecPath,
    recording,
    environment: recording.environment,
    dataScenarios: recording.dataScenarios ?? [],
    suite: recording.suite,
    diagnostics: recording.diagnostics ?? [],
    artifacts,
  };
}

export function updateBrowserWorkbenchRecordingArtifact(
  input: BrowserWorkbenchRecordingArtifactUpdateInput,
): BrowserWorkbenchRecordingArtifactUpdateResult {
  const artifactIndex = input.recordingPackage.artifacts.findIndex((artifact) => artifact.path === input.artifactPath);
  if (artifactIndex < 0) {
    return {
      success: false,
      recordingPackage: input.recordingPackage,
      artifactPath: input.artifactPath,
      error: "Recording artifact not found.",
    };
  }

  try {
    const filePath = resolveArtifactPath(input.workspaceRoot, input.artifactPath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, input.content, "utf8");
    const nextArtifacts = input.recordingPackage.artifacts.map((artifact, index) => index === artifactIndex
      ? { ...artifact, content: input.content }
      : artifact);
    const nextPackage: BrowserWorkbenchRecordingPackage = {
      ...input.recordingPackage,
      artifacts: nextArtifacts,
    };
    return {
      success: true,
      recordingPackage: nextPackage,
      artifactPath: input.artifactPath,
      filePath,
    };
  } catch (error) {
    return {
      success: false,
      recordingPackage: input.recordingPackage,
      artifactPath: input.artifactPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function listBrowserWorkbenchRecordingHistory(workspaceRoot: string, limit = 30): BrowserWorkbenchRecordingHistoryItem[] {
  const root = resolve(workspaceRoot);
  const recordingsRoot = join(root, ".tech-cc-hub", "browser-recordings");
  if (!existsSync(recordingsRoot)) return [];
  return readdirSync(recordingsRoot)
    .map((entry): BrowserWorkbenchRecordingHistoryItem | null => {
      const rootPath = join(recordingsRoot, entry);
      try {
        if (!statSync(rootPath).isDirectory()) return null;
        const manifestPath = join(rootPath, "manifest.json");
        if (!existsSync(manifestPath)) {
          return { id: entry, rootPath };
        }
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          id?: unknown;
          sourceUrl?: unknown;
          actionCount?: unknown;
          generatedAt?: unknown;
          generatedSpecPath?: unknown;
          suite?: { name?: unknown; tags?: unknown };
        };
        return {
          id: typeof manifest.id === "string" ? manifest.id : entry,
          rootPath,
          sourceUrl: typeof manifest.sourceUrl === "string" ? manifest.sourceUrl : undefined,
          actionCount: typeof manifest.actionCount === "number" ? manifest.actionCount : undefined,
          generatedAt: typeof manifest.generatedAt === "number" ? manifest.generatedAt : undefined,
          generatedSpecPath: typeof manifest.generatedSpecPath === "string" ? manifest.generatedSpecPath : undefined,
          suiteName: typeof manifest.suite?.name === "string" ? manifest.suite.name : undefined,
          tags: Array.isArray(manifest.suite?.tags) ? manifest.suite.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is BrowserWorkbenchRecordingHistoryItem => Boolean(item))
    .sort((left, right) => (right.generatedAt ?? 0) - (left.generatedAt ?? 0))
    .slice(0, Math.max(1, limit));
}
