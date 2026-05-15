import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";
import { basename, dirname, extname, join, relative, resolve } from "path";
import { indexKnowledgeWorkspace } from "./knowledge-indexer.js";
import { buildKnowledgeOverviewPromptAppend } from "./knowledge-overview.js";
import { resolveKnowledgeWorkspacePaths } from "./knowledge-paths.js";
import type { KnowledgeIndexReport } from "./knowledge-types.js";

export type KnowledgeUiWorkspace = {
  key: string;
  cwd: string;
  name: string;
  source: "session" | "manual";
  hidden: boolean;
  updatedAt: number;
};

export type KnowledgeUiGeneration = {
  status: "idle" | "generating" | "paused" | "completed";
  completed: number;
  total: number;
  processing: number;
  failed: number;
  commitId?: string;
  commitShortHash?: string;
  branch?: string | null;
  updatedAt: number;
};

export type KnowledgeUiDocument = {
  id: string;
  workspaceKey: string;
  section: string;
  title: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
};

type Row = Record<string, unknown>;

type GeneratedMarkdownDocument = {
  id: string;
  section: string;
  title: string;
  content: string;
  sortOrder: number;
};

const DEFAULT_DOCUMENTS: Array<{ id: string; section: string; title: string; sortOrder: number }> = [
  { id: "project-introduction", section: "项目概述", title: "项目介绍", sortOrder: 10 },
  { id: "target-users", section: "项目概述", title: "目标用户", sortOrder: 20 },
  { id: "core-features", section: "项目概述", title: "核心功能", sortOrder: 30 },
  { id: "tech-stack", section: "项目概述", title: "技术栈", sortOrder: 40 },
  { id: "quick-start", section: "项目概述", title: "快速开始", sortOrder: 50 },
  { id: "architecture-overview", section: "架构设计", title: "整体架构概览", sortOrder: 110 },
  { id: "frontend-architecture", section: "架构设计", title: "前端架构设计", sortOrder: 120 },
  { id: "state-management", section: "架构设计", title: "状态管理架构", sortOrder: 130 },
  { id: "routing-navigation", section: "架构设计", title: "路由与导航设计", sortOrder: 140 },
  { id: "frontend-performance", section: "架构设计", title: "前端性能优化", sortOrder: 150 },
  { id: "ipc", section: "后端架构设计", title: "IPC 通信机制", sortOrder: 210 },
  { id: "backend-modules", section: "后端架构设计", title: "业务模块组织", sortOrder: 220 },
  { id: "config-management", section: "后端架构设计", title: "配置管理模块", sortOrder: 230 },
  { id: "session-management", section: "后端架构设计", title: "会话管理模块", sortOrder: 240 },
  { id: "mcp-tools", section: "后端架构设计", title: "MCP 工具系统", sortOrder: 250 },
  { id: "knowledge-module", section: "后端架构设计", title: "知识库模块", sortOrder: 260 },
];

export class KnowledgeUiStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  private initialize(): void {
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_ui_workspaces (
        key TEXT PRIMARY KEY,
        cwd TEXT NOT NULL,
        name TEXT NOT NULL,
        source TEXT NOT NULL,
        hidden INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_ui_generation (
        workspace_key TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        completed INTEGER NOT NULL,
        total INTEGER NOT NULL,
        processing INTEGER NOT NULL,
        failed INTEGER NOT NULL,
        commit_id TEXT,
        commit_short_hash TEXT,
        branch TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_ui_documents (
        id TEXT NOT NULL,
        workspace_key TEXT NOT NULL,
        section TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (workspace_key, id)
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_ui_workspaces_hidden ON knowledge_ui_workspaces(hidden, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_knowledge_ui_documents_workspace ON knowledge_ui_documents(workspace_key, sort_order);
    `);
  }

  list(): { workspaces: KnowledgeUiWorkspace[]; generations: Record<string, KnowledgeUiGeneration> } {
    const workspaces = (this.db
      .prepare("SELECT * FROM knowledge_ui_workspaces WHERE hidden = 0 ORDER BY updated_at DESC")
      .all() as Row[]).map(rowToWorkspace);
    const generationRows = this.db.prepare("SELECT * FROM knowledge_ui_generation").all() as Row[];
    const generations = Object.fromEntries(generationRows.map((row) => [String(row.workspace_key), rowToGeneration(row)]));
    return { workspaces, generations };
  }

  syncSessionWorkspaces(inputs: Array<{ cwd: string; name?: string }>, systemWorkspace?: string): { workspaces: KnowledgeUiWorkspace[]; generations: Record<string, KnowledgeUiGeneration> } {
    const now = Date.now();
    const systemKey = normalizeKey(systemWorkspace);
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO knowledge_ui_workspaces (key, cwd, name, source, hidden, created_at, updated_at)
       VALUES (?, ?, ?, 'session', 0, ?, ?)`,
    );
    const updateSeen = this.db.prepare(
      `UPDATE knowledge_ui_workspaces
       SET name = COALESCE(NULLIF(?, ''), name), updated_at = ?
       WHERE key = ? AND hidden = 0`,
    );
    const tx = this.db.transaction(() => {
      for (const input of inputs) {
        const key = normalizeKey(input.cwd);
        if (!key || key === systemKey) continue;
        const name = input.name?.trim() || workspaceName(input.cwd);
        insert.run(key, key, name, now, now);
        updateSeen.run(name, now, key);
      }
    });
    tx();
    return this.list();
  }

  addWorkspace(cwd: string, source: "manual" | "session" = "manual"): KnowledgeUiWorkspace {
    const key = normalizeKey(cwd);
    if (!key) throw new Error("工作区路径不能为空。");
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO knowledge_ui_workspaces (key, cwd, name, source, hidden, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(key) DO UPDATE SET hidden = 0, source = excluded.source, name = excluded.name, updated_at = excluded.updated_at`,
      )
      .run(key, key, workspaceName(key), source, now, now);
    return this.getWorkspace(key)!;
  }

  removeWorkspace(key: string): void {
    const workspaceKey = normalizeKey(key);
    if (!workspaceKey) return;
    this.db.prepare("UPDATE knowledge_ui_workspaces SET hidden = 1, updated_at = ? WHERE key = ?").run(Date.now(), workspaceKey);
  }

  updateGeneration(workspaceKey: string, state: KnowledgeUiGeneration): KnowledgeUiGeneration {
    const key = normalizeKey(workspaceKey);
    if (!key) throw new Error("workspaceKey 不能为空。");
    const next = normalizeGeneration(state);
    this.db
      .prepare(
        `INSERT INTO knowledge_ui_generation
          (workspace_key, status, completed, total, processing, failed, commit_id, commit_short_hash, branch, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(workspace_key) DO UPDATE SET
          status = excluded.status,
          completed = excluded.completed,
          total = excluded.total,
          processing = excluded.processing,
          failed = excluded.failed,
          commit_id = excluded.commit_id,
          commit_short_hash = excluded.commit_short_hash,
          branch = excluded.branch,
          updated_at = excluded.updated_at`,
      )
      .run(
        key,
        next.status,
        next.completed,
        next.total,
        next.processing,
        next.failed,
        next.commitId ?? null,
        next.commitShortHash ?? null,
        next.branch ?? null,
        next.updatedAt,
      );
    return next;
  }

  completeGeneration(workspaceKey: string, state: KnowledgeUiGeneration): { generation: KnowledgeUiGeneration; documents: KnowledgeUiDocument[] } {
    const generation = this.updateGeneration(workspaceKey, {
      ...state,
      status: "completed",
      completed: state.total || 183,
      processing: 0,
      updatedAt: Date.now(),
    });
    return { generation, documents: this.listDocuments(workspaceKey) };
  }

  replaceDocuments(workspaceKey: string, documents: GeneratedMarkdownDocument[]): KnowledgeUiDocument[] {
    const key = normalizeKey(workspaceKey);
    const now = Date.now();
    const remove = this.db.prepare("DELETE FROM knowledge_ui_documents WHERE workspace_key = ?");
    const insert = this.db.prepare(
      `INSERT INTO knowledge_ui_documents (id, workspace_key, section, title, content, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const tx = this.db.transaction(() => {
      remove.run(key);
      for (const doc of documents) {
        insert.run(doc.id, key, doc.section, doc.title, doc.content, doc.sortOrder, now, now);
      }
    });
    tx();
    return this.listDocuments(key);
  }

  listDocuments(workspaceKey: string): KnowledgeUiDocument[] {
    const key = normalizeKey(workspaceKey);
    if (!key) return [];
    return (this.db
      .prepare("SELECT * FROM knowledge_ui_documents WHERE workspace_key = ? ORDER BY sort_order ASC")
      .all(key) as Row[]).map(rowToDocument);
  }

  readDocument(workspaceKey: string, documentId: string): KnowledgeUiDocument | undefined {
    const row = this.db
      .prepare("SELECT * FROM knowledge_ui_documents WHERE workspace_key = ? AND id = ?")
      .get(normalizeKey(workspaceKey), documentId) as Row | undefined;
    return row ? rowToDocument(row) : undefined;
  }

  private getWorkspace(key: string): KnowledgeUiWorkspace | undefined {
    const row = this.db.prepare("SELECT * FROM knowledge_ui_workspaces WHERE key = ?").get(normalizeKey(key)) as Row | undefined;
    return row ? rowToWorkspace(row) : undefined;
  }
}

export function createKnowledgeUiStore(appDataPath: string): KnowledgeUiStore {
  return new KnowledgeUiStore(resolve(appDataPath, "knowledge", "knowledge-ui.sqlite"));
}

export async function handleKnowledgeUiInvoke(appDataPath: string, channel: string, ...args: unknown[]): Promise<unknown> {
  const store = createKnowledgeUiStore(appDataPath);
  try {
    switch (channel) {
      case "knowledge:list":
        return store.list();
      case "knowledge:sync-workspaces":
        return store.syncSessionWorkspaces(readWorkspaceInputs(args[0]), readSystemWorkspace(args[0]));
      case "knowledge:add-workspace": {
        const payload = readObject(args[0]);
        return store.addWorkspace(String(payload.cwd ?? ""), payload.source === "session" ? "session" : "manual");
      }
      case "knowledge:remove-workspace": {
        const payload = readObject(args[0]);
        store.removeWorkspace(String(payload.workspaceKey ?? payload.key ?? ""));
        return { success: true };
      }
      case "knowledge:update-generation": {
        const payload = readObject(args[0]);
        return store.updateGeneration(String(payload.workspaceKey ?? ""), readGeneration(payload.state));
      }
      case "knowledge:complete-generation": {
        const payload = readObject(args[0]);
        return store.completeGeneration(String(payload.workspaceKey ?? ""), readGeneration(payload.state));
      }
      case "knowledge:run-generation": {
        const payload = readObject(args[0]);
        return await runKnowledgeGeneration(appDataPath, store, payload);
      }
      case "knowledge:list-documents": {
        const payload = readObject(args[0]);
        return { documents: store.listDocuments(String(payload.workspaceKey ?? "")) };
      }
      case "knowledge:read-document": {
        const payload = readObject(args[0]);
        return { document: store.readDocument(String(payload.workspaceKey ?? ""), String(payload.documentId ?? "")) ?? null };
      }
      case "knowledge:overview": {
        const payload = readObject(args[0]);
        const workspaceRoot = String(payload.workspaceKey ?? payload.cwd ?? "");
        const overview = buildKnowledgeOverviewPromptAppend(workspaceRoot);
        return { overview: overview ?? null };
      }
      default:
        throw new Error(`Unsupported knowledge channel: ${channel}`);
    }
  } finally {
    store.close();
  }
}

function normalizeKey(cwd?: string | null): string {
  return cwd ? resolve(cwd.trim()) : "";
}

function workspaceName(cwd?: string): string {
  if (!cwd) return "工作区";
  const parts = normalizeKey(cwd).split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || cwd;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readWorkspaceInputs(value: unknown): Array<{ cwd: string; name?: string }> {
  const payload = readObject(value);
  const workspaces = Array.isArray(payload.workspaces) ? payload.workspaces : [];
  return workspaces
    .map((item) => readObject(item))
    .map((item) => ({
      cwd: typeof item.cwd === "string" ? item.cwd : "",
      name: typeof item.name === "string" ? item.name : undefined,
    }))
    .filter((item) => item.cwd.trim());
}

function readSystemWorkspace(value: unknown): string | undefined {
  const payload = readObject(value);
  return typeof payload.systemWorkspace === "string" ? payload.systemWorkspace : undefined;
}

async function runKnowledgeGeneration(
  appDataPath: string,
  store: KnowledgeUiStore,
  payload: Record<string, unknown>,
): Promise<{
  success: boolean;
  generation: KnowledgeUiGeneration;
  documents: KnowledgeUiDocument[];
  report?: KnowledgeIndexReport;
  error?: string;
}> {
  const workspaceKey = normalizeKey(String(payload.workspaceKey ?? payload.cwd ?? ""));
  if (!workspaceKey) {
    throw new Error("workspaceKey 不能为空。");
  }

  store.addWorkspace(workspaceKey, payload.source === "session" ? "session" : "manual");
  const startedState = store.updateGeneration(workspaceKey, {
    ...readGeneration(payload.state),
    status: "generating",
    completed: Number(readObject(payload.state).completed ?? 0),
    processing: 1,
    failed: 0,
    updatedAt: Date.now(),
  });

  let report: KnowledgeIndexReport | undefined;
  try {
    report = await indexKnowledgeWorkspace({
      workspaceRoot: workspaceKey,
      appDataPath,
      mode: "refresh",
    });
  } catch (error) {
    const failedGeneration = store.updateGeneration(workspaceKey, {
      ...startedState,
      status: "paused",
      processing: 0,
      failed: 1,
      updatedAt: Date.now(),
    });
    return {
      success: false,
      generation: failedGeneration,
      documents: store.listDocuments(workspaceKey),
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const generatedDocs = collectGeneratedMarkdownDocuments(workspaceKey, appDataPath);
  const documents = generatedDocs.length > 0
    ? store.replaceDocuments(workspaceKey, generatedDocs)
    : store.listDocuments(workspaceKey);
  const success = Boolean(report.success && generatedDocs.length > 0);
  const generation = store.updateGeneration(workspaceKey, {
    ...startedState,
    status: success ? "completed" : "paused",
    completed: success ? startedState.total || 183 : Math.min(startedState.completed, Math.max(0, startedState.total - 1)),
    total: startedState.total || 183,
    processing: 0,
    failed: success ? 0 : 1,
    updatedAt: Date.now(),
  });

  return {
    success,
    generation,
    documents,
    report,
    error: success ? undefined : (report.error || report.message || "Repo Wiki 没有生成可读取的 Markdown 文档。"),
  };
}

function collectGeneratedMarkdownDocuments(workspaceRoot: string, appDataPath: string): GeneratedMarkdownDocument[] {
  const paths = resolveKnowledgeWorkspacePaths(workspaceRoot, appDataPath);
  const root = paths.repowikiContentDir;
  if (!existsSync(root)) return [];

  const docs: GeneratedMarkdownDocument[] = [];
  function walk(currentDir: string): void {
    for (const entry of readdirSync(currentDir)) {
      const absolutePath = join(currentDir, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!stats.isFile() || extname(entry).toLowerCase() !== ".md") continue;
      const content = readFileSync(absolutePath, "utf8");
      const relativePath = relative(root, absolutePath);
      const title = extractMarkdownTitle(content, basename(entry));
      const known = DEFAULT_DOCUMENTS.find((doc) => doc.title === title);
      docs.push({
        id: known?.id ?? slugifyDocumentId(relativePath),
        section: known?.section ?? inferSectionFromPath(relativePath),
        title,
        content,
        sortOrder: known?.sortOrder ?? 10_000 + docs.length,
      });
    }
  }
  walk(root);
  return docs.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "zh-Hans-CN"));
}

function extractMarkdownTitle(content: string, fallbackFileName: string): string {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallbackFileName.replace(/\.md$/i, "");
}

function inferSectionFromPath(relativePath: string): string {
  const firstSegment = relativePath.split(/[\\/]/).at(0) ?? "";
  if (/arch|架构/i.test(firstSegment)) return "架构设计";
  if (/backend|server|后端|ipc/i.test(firstSegment)) return "后端架构设计";
  return "生成文档";
}

function slugifyDocumentId(value: string): string {
  const normalized = value
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `doc-${Date.now()}`;
}

function readGeneration(value: unknown): KnowledgeUiGeneration {
  const state = readObject(value);
  return normalizeGeneration({
    status: state.status === "completed" || state.status === "paused" || state.status === "generating" ? state.status : "idle",
    completed: Number(state.completed ?? 0),
    total: Number(state.total ?? 183),
    processing: Number(state.processing ?? 0),
    failed: Number(state.failed ?? 0),
    commitId: typeof state.commitId === "string" ? state.commitId : undefined,
    commitShortHash: typeof state.commitShortHash === "string" ? state.commitShortHash : undefined,
    branch: typeof state.branch === "string" ? state.branch : null,
    updatedAt: Number(state.updatedAt ?? Date.now()),
  });
}

function normalizeGeneration(state: KnowledgeUiGeneration): KnowledgeUiGeneration {
  const total = Number.isFinite(state.total) && state.total > 0 ? Math.floor(state.total) : 183;
  const completed = Math.max(0, Math.min(total, Math.floor(Number(state.completed) || 0)));
  return {
    status: state.status,
    completed,
    total,
    processing: Math.max(0, Math.floor(Number(state.processing) || 0)),
    failed: Math.max(0, Math.floor(Number(state.failed) || 0)),
    commitId: state.commitId,
    commitShortHash: state.commitShortHash,
    branch: state.branch ?? null,
    updatedAt: Number.isFinite(state.updatedAt) ? state.updatedAt : Date.now(),
  };
}

function rowToWorkspace(row: Row): KnowledgeUiWorkspace {
  return {
    key: String(row.key),
    cwd: String(row.cwd),
    name: String(row.name),
    source: row.source === "session" ? "session" : "manual",
    hidden: Number(row.hidden) === 1,
    updatedAt: Number(row.updated_at),
  };
}

function rowToGeneration(row: Row): KnowledgeUiGeneration {
  return normalizeGeneration({
    status: row.status === "completed" || row.status === "paused" || row.status === "generating" ? row.status : "idle",
    completed: Number(row.completed),
    total: Number(row.total),
    processing: Number(row.processing),
    failed: Number(row.failed),
    commitId: row.commit_id ? String(row.commit_id) : undefined,
    commitShortHash: row.commit_short_hash ? String(row.commit_short_hash) : undefined,
    branch: row.branch ? String(row.branch) : null,
    updatedAt: Number(row.updated_at),
  });
}

function rowToDocument(row: Row): KnowledgeUiDocument {
  return {
    id: String(row.id),
    workspaceKey: String(row.workspace_key),
    section: String(row.section),
    title: String(row.title),
    content: String(row.content),
    sortOrder: Number(row.sort_order),
    updatedAt: Number(row.updated_at),
  };
}
