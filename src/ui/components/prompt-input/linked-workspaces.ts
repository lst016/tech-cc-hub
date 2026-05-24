import {
  buildLinkedWorkspacePromptAppend,
  mergePromptWithLinkedWorkspaceContext,
  normalizeLinkedWorkspaceContext,
  normalizeWorkspacePath,
  type LinkedWorkspaceContext,
} from "../../../shared/linked-workspaces";

export {
  buildLinkedWorkspacePromptAppend,
  mergePromptWithLinkedWorkspaceContext,
  normalizeLinkedWorkspaceContext,
  normalizeWorkspacePath,
};
export type { LinkedWorkspaceContext };

export const LINKED_WORKSPACE_STORAGE_KEY = "tech-cc-hub:linked-workspaces:v1";

export function normalizeLinkedWorkspacesByGroup(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const normalized: Record<string, string[]> = {};

  for (const [groupKey, values] of Object.entries(input as Record<string, unknown>)) {
    const normalizedGroupKey = normalizeWorkspacePath(groupKey);
    if (!normalizedGroupKey || !Array.isArray(values)) continue;
    const deduped = Array.from(
      new Set(
        values
          .filter((item): item is string => typeof item === "string")
          .map((item) => normalizeWorkspacePath(item))
          .filter((item) => item && item !== normalizedGroupKey),
      ),
    );
    if (deduped.length > 0) {
      normalized[normalizedGroupKey] = deduped;
    }
  }

  return normalized;
}

export function readLinkedWorkspacesFromStorage(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(LINKED_WORKSPACE_STORAGE_KEY);
    if (!raw) return {};
    return normalizeLinkedWorkspacesByGroup(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

export function createLinkedWorkspaceContext(primaryCwd: string, linkedCwds: string[]): LinkedWorkspaceContext | null {
  return normalizeLinkedWorkspaceContext({ primaryCwd, linkedCwds });
}

export function getLinkedWorkspaceContextForCwd(cwd: string): LinkedWorkspaceContext | null {
  const normalizedCwd = normalizeWorkspacePath(cwd);
  if (!normalizedCwd) return null;
  const byGroup = readLinkedWorkspacesFromStorage();
  return createLinkedWorkspaceContext(normalizedCwd, byGroup[normalizedCwd] ?? []);
}

export function getLinkedWorkspacePathsForCwd(cwd: string): string[] {
  return getLinkedWorkspaceContextForCwd(cwd)?.linkedCwds ?? [];
}
