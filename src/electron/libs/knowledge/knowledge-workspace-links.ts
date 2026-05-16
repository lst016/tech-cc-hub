import Database from "better-sqlite3";
import { existsSync } from "fs";
import { resolve } from "path";

export type LinkedKnowledgeWorkspace = {
  key: string;
  cwd: string;
  name: string;
};

type Row = Record<string, unknown>;

function normalizeWorkspaceKey(value?: string | null): string {
  return value?.trim() ? resolve(value.trim()) : "";
}

function knowledgeUiDbPath(appDataPath: string): string {
  return resolve(appDataPath, "knowledge", "knowledge-ui.sqlite");
}

function openReadonlyKnowledgeUiDb(appDataPath: string): Database.Database | undefined {
  const dbPath = knowledgeUiDbPath(appDataPath);
  if (!existsSync(dbPath)) return undefined;
  try {
    return new Database(dbPath, { readonly: true, fileMustExist: true });
  } catch {
    return undefined;
  }
}

function hasWorkspaceLinksTable(db: Database.Database): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'knowledge_ui_workspace_links'")
    .get() as Row | undefined;
  return Boolean(row);
}

export function listLinkedKnowledgeWorkspaces(appDataPath: string, workspaceRoot: string, limit = 8): LinkedKnowledgeWorkspace[] {
  const workspaceKey = normalizeWorkspaceKey(workspaceRoot);
  if (!workspaceKey) return [];
  const db = openReadonlyKnowledgeUiDb(appDataPath);
  if (!db) return [];
  try {
    if (!hasWorkspaceLinksTable(db)) return [];
    const rows = db
      .prepare(
        `SELECT workspace.key, workspace.cwd, workspace.name
         FROM knowledge_ui_workspace_links AS link
         JOIN knowledge_ui_workspaces AS workspace ON workspace.key = link.linked_workspace_key
         WHERE link.workspace_key = ? AND workspace.hidden = 0
         ORDER BY link.updated_at DESC, workspace.updated_at DESC
         LIMIT ?`,
      )
      .all(workspaceKey, Math.max(1, Math.floor(limit))) as Row[];
    return rows
      .map((row) => ({
        key: normalizeWorkspaceKey(String(row.key ?? "")),
        cwd: normalizeWorkspaceKey(String(row.cwd ?? row.key ?? "")),
        name: String(row.name ?? "").trim(),
      }))
      .filter((workspace) => workspace.key && workspace.cwd && workspace.key !== workspaceKey);
  } finally {
    db.close();
  }
}

export function listKnowledgeWorkspaceRootsWithLinks(appDataPath: string, workspaceRoot: string, limit = 8): string[] {
  const root = normalizeWorkspaceKey(workspaceRoot);
  if (!root) return [];
  const linked = listLinkedKnowledgeWorkspaces(appDataPath, root, limit)
    .map((workspace) => workspace.cwd)
    .filter(Boolean);
  return Array.from(new Set([root, ...linked]));
}
