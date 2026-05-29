import { scorePreviewQuickOpenEntry } from "../../../shared/preview-quick-open.js";

const FILE_MENTION_DIRECTORY_SCAN_LIMIT = 500;
const FILE_MENTION_FILE_SCAN_LIMIT = 4_000;
const FILE_MENTION_SCAN_DEPTH = 5;
const FILE_MENTION_IGNORED_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "dist-electron",
  "dist-react",
  "dist-test",
  "node_modules",
]);

export type FileMentionOption = {
  path: string;
  label: string;
  name: string;
  kind: "file" | "directory";
};

export type FileMentionContext = {
  start: number;
  end: number;
  query: string;
};

type PreviewDirectoryEntry = {
  name?: string;
  path?: string;
  filePath?: string;
  relativePath?: string;
  type?: string;
  kind?: string;
  isDirectory?: boolean;
};

type PreviewDirectoryResponse =
  | PreviewDirectoryEntry[]
  | {
      success?: boolean;
      entries?: PreviewDirectoryEntry[];
      error?: string;
    };

type PreviewFilesResponse = {
  success?: boolean;
  entries?: PreviewDirectoryEntry[];
  truncated?: boolean;
  error?: string;
};

export function normalizeMentionPath(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function scoreSegmentMatch(pathSegment: string, querySegment: string) {
  if (!pathSegment || !querySegment) return null;
  if (pathSegment === querySegment) return -8;
  if (pathSegment.startsWith(querySegment)) {
    return -5 + (pathSegment.length - querySegment.length) / 50;
  }
  return null;
}

function scoreStrictMentionPath(option: FileMentionOption, query: string) {
  const normalizedQuery = normalizeMentionPath(query).toLowerCase().trim();
  if (!normalizedQuery.includes("/")) return null;

  const querySegments = normalizedQuery.split("/").filter(Boolean);
  if (querySegments.length === 0) return null;

  const pathSegments = normalizeMentionPath(option.label).toLowerCase().split("/").filter(Boolean);
  if (pathSegments.length === 0) return null;

  for (let startIndex = 0; startIndex <= pathSegments.length - querySegments.length; startIndex += 1) {
    const firstSegmentScore = scoreSegmentMatch(pathSegments[startIndex] ?? "", querySegments[0] ?? "");
    if (firstSegmentScore === null) continue;

    let score = pathSegments.length / 20;
    score += firstSegmentScore + startIndex * 1.5;
    let matched = true;

    for (let queryIndex = 1; queryIndex < querySegments.length; queryIndex += 1) {
      const segmentScore = scoreSegmentMatch(
        pathSegments[startIndex + queryIndex] ?? "",
        querySegments[queryIndex] ?? "",
      );
      if (segmentScore === null) {
        matched = false;
        break;
      }
      score += segmentScore;
    }

    if (!matched) continue;

    if (option.kind === "file" && querySegments.length < pathSegments.length) {
      score += 0.4;
    }

    return score;
  }
  return null;
}

function getRelativeMentionPath(workspaceRoot: string, filePath: string) {
  const normalizedRoot = normalizeMentionPath(workspaceRoot).replace(/\/$/, "");
  const normalizedPath = normalizeMentionPath(filePath);
  if (normalizedPath === normalizedRoot) return normalizedPath.split("/").pop() || normalizedPath;
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  return normalizedPath;
}

export function getFileMentionContext(promptValue: string, cursorIndex: number): FileMentionContext | null {
  const safeCursor = Math.max(0, Math.min(cursorIndex, promptValue.length));
  const beforeCursor = promptValue.slice(0, safeCursor);
  const match = beforeCursor.match(/(^|[\s([{"'`，。；：！？])@([^\s@]*)$/u);
  if (!match) return null;
  const query = match[2] ?? "";
  return {
    start: safeCursor - query.length - 1,
    end: safeCursor,
    query,
  };
}

export async function collectFileMentionOptions(workspaceRoot: string): Promise<FileMentionOption[]> {
  const root = workspaceRoot.trim();
  if (!root || !window.electron) return [];

  const bridge = window.electron as typeof window.electron & {
    listPreviewDirectory?: (input: { cwd: string; path: string }) => Promise<PreviewDirectoryResponse>;
    listPreviewFiles?: (input: { cwd: string; limit?: number }) => Promise<PreviewFilesResponse>;
  };
  const seen = new Set<string>();
  const options: FileMentionOption[] = [];
  let scannedDirectories = 0;

  const addOption = (entry: PreviewDirectoryEntry, fallbackKind: "file" | "directory") => {
    const name = entry.name?.trim();
    const entryPath = entry.path || entry.filePath;
    if (!name || !entryPath) return;

    const isDirectory = entry.isDirectory === true || entry.type === "directory" || entry.kind === "directory" || fallbackKind === "directory";
    if (isDirectory && FILE_MENTION_IGNORED_DIRS.has(name)) return;

    const normalizedPath = normalizeMentionPath(entryPath);
    if (seen.has(normalizedPath)) return;
    seen.add(normalizedPath);

    options.push({
      path: normalizedPath,
      label: normalizeMentionPath(entry.relativePath || getRelativeMentionPath(root, normalizedPath)),
      name,
      kind: isDirectory ? "directory" : "file",
    });
  };

  if (bridge.listPreviewFiles) {
    const response = await bridge.listPreviewFiles({ cwd: root, limit: FILE_MENTION_FILE_SCAN_LIMIT });
    const entries = response?.success === false ? [] : response?.entries ?? [];
    for (const entry of entries) {
      addOption(entry, "file");
    }
  }

  const visit = async (directoryPath: string, depth: number): Promise<void> => {
    if (!bridge.listPreviewDirectory || depth > FILE_MENTION_SCAN_DEPTH || scannedDirectories >= FILE_MENTION_DIRECTORY_SCAN_LIMIT) return;
    const response = await bridge.listPreviewDirectory?.({ cwd: root, path: directoryPath });
    const entries = Array.isArray(response)
      ? response
      : response?.success === false
        ? []
        : response?.entries ?? [];

    for (const entry of entries) {
      const name = entry.name?.trim();
      if (!name) continue;

      const isDirectory = entry.isDirectory === true || entry.type === "directory" || entry.kind === "directory";
      if (isDirectory && FILE_MENTION_IGNORED_DIRS.has(name)) continue;

      const entryPath = entry.path || entry.filePath || `${directoryPath.replace(/\/$/, "")}/${name}`;
      if (isDirectory) {
        scannedDirectories += 1;
        addOption({ ...entry, path: entryPath, isDirectory: true }, "directory");
        await visit(normalizeMentionPath(entryPath), depth + 1);
      } else if (!bridge.listPreviewFiles) {
        addOption({ ...entry, path: entryPath }, "file");
      }
    }
  };

  await visit(root, 0);
  return options.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.label.localeCompare(b.label, "zh-CN");
  });
}

export function scoreFileMentionOption(option: FileMentionOption, query: string) {
  const normalizedQuery = normalizeMentionPath(query).toLowerCase().trim();
  const strictPathScore = scoreStrictMentionPath(option, query);
  if (strictPathScore !== null) return strictPathScore;
  if (normalizedQuery.includes("/")) return null;

  return scorePreviewQuickOpenEntry({
    name: option.name,
    path: option.path,
    relativePath: option.label,
  }, query);
}
