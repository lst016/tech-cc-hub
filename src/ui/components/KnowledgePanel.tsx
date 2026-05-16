import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  Link2,
  Network,
  PauseCircle,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import type { ApiConfigProfile, SettingsPageId } from "../types";
import MDContent from "../render/markdown";
import { PREVIEW_OPEN_FILE_EVENT, type PreviewOpenFileDetail } from "../events";

type KnowledgePanelProps = {
  onBack?: () => void;
  onOpenSettings?: (pageId?: SettingsPageId) => void;
};

type GenerationStatus = "idle" | "generating" | "paused" | "completed";

type GenerationState = {
  status: GenerationStatus;
  completed: number;
  total: number;
  processing: number;
  failed: number;
  phase?: string;
  commitId?: string;
  commitShortHash?: string;
  branch?: string | null;
  updatedAt?: number;
};

type KnowledgeWorkspace = {
  key: string;
  cwd?: string;
  name: string;
  sessionCount: number;
  source: "session" | "manual";
  updatedAt: number;
};

type KnowledgeWorkspaceRelations = Record<string, string[]>;

type KnowledgeDocument = {
  id: string;
  workspaceKey: string;
  section: string;
  title: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
};

type KnowledgeOpenTab = {
  id: string;
  kind: "workspace" | "document" | "source";
  workspaceKey: string;
  documentId?: string;
  sourcePath?: string;
  startLine?: number;
  endLine?: number;
  title: string;
};

type SourcePreviewState = {
  tabId: string;
  workspaceKey: string;
  filePath: string;
  relativePath: string;
  title: string;
  startLine?: number;
  endLine?: number;
  content?: string;
  language?: string;
  loading: boolean;
  error?: string;
};

type WikiTreeNode = {
  key: string;
  title: string;
  sortOrder: number;
  children: WikiTreeNode[];
  documents: KnowledgeDocument[];
};

type KnowledgeListResponse = {
  workspaces?: Array<{
    key?: string;
    cwd?: string;
    name?: string;
    source?: "session" | "manual";
    updatedAt?: number;
  }>;
  generations?: Record<string, GenerationState>;
  relations?: KnowledgeWorkspaceRelations;
};

type KnowledgeWorkspaceRecord = NonNullable<KnowledgeListResponse["workspaces"]>[number];

type KnowledgeDocumentsResponse = {
  documents?: KnowledgeDocument[];
};

type KnowledgeWorkspaceLinksResponse = {
  relations?: KnowledgeWorkspaceRelations;
};

type KnowledgeRunGenerationResponse = {
  success?: boolean;
  generation?: GenerationState;
  documents?: unknown[];
  report?: {
    success?: boolean;
    message?: string;
    error?: string;
    indexedDocuments?: number;
    indexedChunks?: number;
    generatedFiles?: string[];
  };
  error?: string;
};

type KnowledgeGitState = {
  loading: boolean;
  hasGit: boolean;
  branch: string | null;
  commitId: string;
  commitShortHash: string;
  changedCount: number;
  error?: string;
};

const KNOWLEDGE_WORKSPACES_STORAGE_KEY = "tech-cc-hub:knowledge-panel-workspaces";
const KNOWLEDGE_HIDDEN_WORKSPACES_STORAGE_KEY = "tech-cc-hub:knowledge-panel-hidden-workspaces";
const KNOWLEDGE_AUTO_UPDATE_STORAGE_KEY = "tech-cc-hub:knowledge-panel-auto-update";
const GIT_REFRESH_INTERVAL_MS = 30_000;
const GIT_SNAPSHOT_TIMEOUT_MS = 4_000;

function getRoutedProfiles(profiles: ApiConfigProfile[]): ApiConfigProfile[] {
  const enabled = profiles.filter((profile) => profile.enabled);
  return enabled.length > 0 ? enabled : profiles.slice(0, 1);
}

function getWorkspaceName(cwd?: string): string {
  if (!cwd) return "当前工作区";
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || cwd;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase("zh-Hans-CN");
}

function workspaceMatchesSearch(workspace: KnowledgeWorkspace, query: string): boolean {
  if (!query) return true;
  return normalizeSearchText(`${workspace.name}\n${workspace.cwd ?? ""}`).includes(query);
}

function documentMatchesSearch(document: KnowledgeDocument, query: string): boolean {
  if (!query) return true;
  return normalizeSearchText(`${document.title}\n${document.section}\n${document.content}`).includes(query);
}

function normalizeWorkspaceKey(cwd?: string | null): string {
  return cwd?.trim() ?? "";
}

function normalizeKnowledgeWorkspace(input: KnowledgeWorkspaceRecord): KnowledgeWorkspace | undefined {
  const key = normalizeWorkspaceKey(input.key ?? input.cwd);
  if (!key) return undefined;
  return {
    key,
    cwd: input.cwd ?? key,
    name: input.name?.trim() || getWorkspaceName(input.cwd ?? key),
    sessionCount: 0,
    source: input.source === "session" ? "session" : "manual",
    updatedAt: Number.isFinite(input.updatedAt) ? Number(input.updatedAt) : 0,
  };
}

function normalizeKnowledgeDocument(input: unknown): KnowledgeDocument | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const raw = input as Partial<KnowledgeDocument>;
  const id = typeof raw.id === "string" ? raw.id : "";
  const workspaceKey = typeof raw.workspaceKey === "string" ? raw.workspaceKey : "";
  const section = typeof raw.section === "string" ? raw.section : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  const content = typeof raw.content === "string" ? raw.content : "";
  if (!id || !workspaceKey || !title) return undefined;
  return {
    id,
    workspaceKey,
    section,
    title,
    content,
    sortOrder: Number.isFinite(raw.sortOrder) ? Number(raw.sortOrder) : 0,
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : 0,
  };
}

async function invokeKnowledge<T>(channel: string, payload?: unknown): Promise<T> {
  const electronApi = window.electron as typeof window.electron & {
    invoke?: <Result>(channel: string, ...args: unknown[]) => Promise<Result>;
  };
  if (typeof electronApi.invoke !== "function") {
    throw new Error("当前运行环境不支持知识库 IPC。");
  }
  return payload === undefined
    ? electronApi.invoke<T>(channel)
    : electronApi.invoke<T>(channel, payload);
}

function readStoredWorkspacePaths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_WORKSPACES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => normalizeWorkspaceKey(String(item))).filter(Boolean)));
  } catch {
    return [];
  }
}

function readStoredWorkspaceKeySet(storageKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((item) => normalizeWorkspaceKey(String(item))).filter(Boolean));
  } catch {
    return new Set();
  }
}

function readStoredBooleanRecord(storageKey: string): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [normalizeWorkspaceKey(key), Boolean(value)] as const)
        .filter(([key]) => Boolean(key)),
    );
  } catch {
    return {};
  }
}

function isGenerationStatus(value: unknown): value is GenerationStatus {
  return value === "idle" || value === "generating" || value === "paused" || value === "completed";
}

function normalizeGenerationState(value: unknown): GenerationState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<GenerationState>;
  if (!isGenerationStatus(raw.status)) return undefined;
  const total = Number.isFinite(raw.total) && raw.total && raw.total > 0 ? Math.floor(raw.total) : 0;
  const failed = Number.isFinite(raw.failed) && raw.failed && raw.failed > 0 ? Math.floor(raw.failed) : 0;
  const updatedAt = Number.isFinite(raw.updatedAt) && raw.updatedAt && raw.updatedAt > 0 ? raw.updatedAt : Date.now();
  const rawCompleted = Number.isFinite(raw.completed) && raw.completed && raw.completed > 0 ? Math.floor(raw.completed) : 0;
  const completed = total > 0 ? Math.min(total, Math.max(0, rawCompleted)) : Math.max(0, rawCompleted);
  let status = raw.status;
  if (status !== "idle" && failed === 0 && total > 0 && completed >= total) {
    status = "completed";
  }

  return {
    status,
    completed,
    total,
    processing: status === "generating" ? Math.max(1, Math.floor(Number(raw.processing) || 1)) : 0,
    failed,
    phase: typeof raw.phase === "string" ? raw.phase : undefined,
    commitId: typeof raw.commitId === "string" ? raw.commitId : undefined,
    commitShortHash: typeof raw.commitShortHash === "string" ? raw.commitShortHash : undefined,
    branch: typeof raw.branch === "string" ? raw.branch : null,
    updatedAt,
  };
}

function createIdleGeneration(): GenerationState {
  return {
    status: "idle",
    completed: 0,
    total: 0,
    processing: 0,
    failed: 0,
    updatedAt: Date.now(),
  };
}

function workspaceTabId(workspaceKey: string): string {
  return `workspace:${workspaceKey}`;
}

function documentTabId(workspaceKey: string, documentId: string): string {
  return `document:${workspaceKey}:${documentId}`;
}

function sourceTabId(workspaceKey: string, filePath: string): string {
  return `source:${workspaceKey}:${filePath}`;
}

function fileNameFromPath(filePath: string): string {
  const parts = filePath.split(/[\\/]+/).filter(Boolean);
  return parts.at(-1) || filePath;
}

function normalizePathForCompare(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function relativePathFromWorkspace(workspaceRoot: string, filePath: string): string {
  const root = normalizePathForCompare(workspaceRoot);
  const target = normalizePathForCompare(filePath);
  return target === root
    ? fileNameFromPath(filePath)
    : target.startsWith(`${root}/`)
      ? target.slice(root.length + 1)
      : filePath;
}

function findWorkspaceForSource(workspaces: KnowledgeWorkspace[], filePath: string, fallback?: KnowledgeWorkspace): KnowledgeWorkspace | undefined {
  const normalizedFilePath = normalizePathForCompare(filePath);
  return workspaces.find((workspace) => {
    const root = normalizePathForCompare(workspace.cwd ?? workspace.key);
    return Boolean(root && (normalizedFilePath === root || normalizedFilePath.startsWith(`${root}/`)));
  }) ?? fallback;
}

function resolveHeadFromSnapshot(snapshot: import("../types").UiGitWorkbenchSnapshot): KnowledgeGitState {
  const currentBranch = snapshot.status.currentBranch;
  const headCommit = snapshot.history.find((commit) => (
    commit.refs.some((ref) => ref.startsWith("HEAD") || (currentBranch ? ref === currentBranch || ref.endsWith(`/${currentBranch}`) : false))
  )) ?? snapshot.history[0];

  return {
    loading: false,
    hasGit: true,
    branch: currentBranch,
    commitId: headCommit?.hash ?? "",
    commitShortHash: headCommit?.shortHash ?? (headCommit?.hash ? headCommit.hash.slice(0, 7) : ""),
    changedCount: snapshot.status.changedCount,
  };
}

function applyGitBinding(state: GenerationState, git?: KnowledgeGitState): GenerationState {
  return {
    ...state,
    commitId: git?.commitId || state.commitId,
    commitShortHash: git?.commitShortHash || state.commitShortHash,
    branch: git?.branch ?? state.branch,
    updatedAt: Date.now(),
  };
}

function isPlaceholderWikiDocument(document: KnowledgeDocument): boolean {
  return /后续接入真实|当前没有真实 Repo Wiki 正文|预览壳|真实生成内容写入后|生成后会出现 Repo Wiki 目录/.test(document.content);
}

function normalizeWikiDocumentMarkdown(content: string): string {
  return content
    .replace(/<cite>\s*/gi, "\n")
    .replace(/\s*<\/cite>/gi, "\n");
}

function sectionParts(section: string): string[] {
  const parts = section
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : ["生成文档"];
}

function buildDocumentTree(documents: KnowledgeDocument[]): WikiTreeNode[] {
  const root: WikiTreeNode = {
    key: "__root__",
    title: "",
    sortOrder: 0,
    children: [],
    documents: [],
  };
  const byKey = new Map<string, WikiTreeNode>();

  for (const document of documents) {
    const parts = sectionParts(document.section || "生成文档");
    let current = root;
    let key = "";
    for (const part of parts) {
      key = key ? `${key}/${part}` : part;
      let node = byKey.get(key);
      if (!node) {
        node = {
          key,
          title: part,
          sortOrder: document.sortOrder,
          children: [],
          documents: [],
        };
        byKey.set(key, node);
        current.children.push(node);
      }
      node.sortOrder = Math.min(node.sortOrder, document.sortOrder);
      current = node;
    }
    current.documents.push(document);
  }

  const sortNode = (node: WikiTreeNode) => {
    node.children.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "zh-Hans-CN"));
    node.documents.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "zh-Hans-CN"));
    node.children.forEach(sortNode);
  };
  sortNode(root);
  return root.children;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

function gitStateEquals(left: KnowledgeGitState | undefined, right: KnowledgeGitState): boolean {
  if (!left) return false;
  return (
    left.loading === right.loading &&
    left.hasGit === right.hasGit &&
    left.branch === right.branch &&
    left.commitId === right.commitId &&
    left.commitShortHash === right.commitShortHash &&
    left.changedCount === right.changedCount &&
    left.error === right.error
  );
}

function generationStateEquals(left: GenerationState | undefined, right: GenerationState): boolean {
  if (!left) return false;
  return (
    left.status === right.status &&
    left.completed === right.completed &&
    left.total === right.total &&
    left.processing === right.processing &&
    left.failed === right.failed &&
    left.phase === right.phase &&
    left.commitId === right.commitId &&
    left.commitShortHash === right.commitShortHash &&
    left.branch === right.branch &&
    left.updatedAt === right.updatedAt
  );
}

function generationRecordEquals(left: Record<string, GenerationState>, right: Record<string, GenerationState>): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return rightKeys.every((key) => generationStateEquals(left[key], right[key]));
}

function normalizeWorkspaceRelations(value: unknown): KnowledgeWorkspaceRelations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: KnowledgeWorkspaceRelations = {};
  for (const [sourceKey, targets] of Object.entries(value)) {
    const key = normalizeWorkspaceKey(sourceKey);
    if (!key || !Array.isArray(targets)) continue;
    const linked = Array.from(new Set(targets.map((item) => normalizeWorkspaceKey(String(item))).filter((item) => item && item !== key)));
    if (linked.length > 0) next[key] = linked;
  }
  return next;
}

function relationRecordEquals(left: KnowledgeWorkspaceRelations, right: KnowledgeWorkspaceRelations): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return rightKeys.every((key, index) => {
    if (leftKeys[index] !== key) return false;
    const leftTargets = [...(left[key] ?? [])].sort();
    const rightTargets = [...(right[key] ?? [])].sort();
    return leftTargets.length === rightTargets.length && rightTargets.every((target, targetIndex) => leftTargets[targetIndex] === target);
  });
}

function workspaceListEquals(left: KnowledgeWorkspace[], right: KnowledgeWorkspace[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((workspace, index) => {
    const next = right[index];
    return (
      workspace.key === next.key &&
      workspace.cwd === next.cwd &&
      workspace.name === next.name &&
      workspace.source === next.source &&
      workspace.updatedAt === next.updatedAt
    );
  });
}

function Toggle({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  return (
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-200"} ${disabled ? "opacity-45" : ""}`}>
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
  );
}

function ProgressBlock({ state }: { state: GenerationState }) {
  const hasKnownTotal = state.total > 1 || state.status === "completed";
  const isIndeterminate = state.status === "generating" && !hasKnownTotal;
  const safeTotal = Math.max(1, state.total);
  const percent = hasKnownTotal
    ? Math.min(100, Math.round((state.completed / safeTotal) * 1000) / 10)
    : 0;
  const isFailed = state.status === "paused" && state.failed > 0;
  const statusLabel = state.status === "paused"
    ? isFailed ? "生成失败" : "已暂停"
    : state.status === "completed"
      ? "已完成"
      : "正在生成中";
  const progressPrefix = state.status === "paused"
    ? isFailed ? "生成失败" : "已暂停"
    : state.status === "completed"
      ? "生成完成"
      : "正在生成中";
  const progressText = state.status === "generating" && state.phase
    ? state.phase
    : progressPrefix;

  return (
    <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <PauseCircle className={`h-4 w-4 ${state.status === "completed" ? "text-emerald-600" : "text-amber-500"}`} />
        <div className="text-sm font-semibold text-slate-800">{statusLabel}</div>
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-700">
        {isIndeterminate
          ? `${progressText}，正在等待目录规划结果，处理中: ${state.processing}，失败: ${state.failed}`
          : hasKnownTotal
          ? `${progressText}，已完成 ${state.completed}/${state.total} (${percent}%)，处理中: ${state.processing}，失败: ${state.failed}`
          : `${progressText}，正在全量扫描和生成，处理中: ${state.processing}，失败: ${state.failed}`}
      </div>
      <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        {isIndeterminate
          ? <div className="knowledge-progress-indeterminate absolute inset-y-0 rounded-full bg-slate-500" />
          : <div className="h-full rounded-full bg-slate-500 transition-all duration-300" style={{ width: `${percent}%` }} />}
      </div>
      <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
        <div>
          <div className="font-semibold text-slate-700">Commit ID</div>
          <div className="mt-1 font-mono text-slate-500">{state.commitShortHash || state.commitId?.slice(0, 7) || "-"}</div>
          {state.branch && <div className="mt-1 text-xs text-slate-400">{state.branch}</div>}
        </div>
      </div>
    </div>
  );
}

function SectionTree({
  active,
  documents,
  selectedDocumentId,
  onSelectDocument,
  forceExpanded = false,
}: {
  active: boolean;
  documents: KnowledgeDocument[];
  selectedDocumentId: string;
  onSelectDocument: (document: KnowledgeDocument) => void;
  forceExpanded?: boolean;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

  if (!active || documents.length === 0) {
    return null;
  }

  const tree = buildDocumentTree(documents);
  const toggleSection = (sectionTitle: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionTitle)) {
        next.delete(sectionTitle);
      } else {
        next.add(sectionTitle);
      }
      return next;
    });
  };

  const renderNodes = (nodes: WikiTreeNode[], depth = 0): ReactNode => (
    nodes.map((node) => {
      const collapsed = !forceExpanded && !expandedSections.has(node.key);
      return (
        <div key={node.key} data-knowledge-section={node.key}>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "展开" : "折叠"}${node.title}`}
            onClick={() => toggleSection(node.key)}
            className="flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="min-w-0 truncate">{node.title}</span>
          </button>
          {!collapsed && (
            <div className="mt-1 space-y-1">
              {node.documents.map((document) => (
                <button
                  type="button"
                  key={document.id}
                  aria-label={`打开文档 ${document.title}`}
                  onClick={() => onSelectDocument(document)}
                  className={`block w-full truncate rounded-lg py-1 pr-2 text-left text-sm transition ${
                    selectedDocumentId === document.id
                      ? "bg-slate-100 font-semibold text-slate-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  style={{ paddingLeft: `${34 + depth * 14}px` }}
                >
                  {document.title}
                </button>
              ))}
              {renderNodes(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    })
  );

  return (
    <div className="mt-3 space-y-2">
      {renderNodes(tree)}
    </div>
  );
}

function WikiDocumentView({
  document,
  generation,
  onOpenSourceFile,
}: {
  document: KnowledgeDocument;
  generation: GenerationState;
  onOpenSourceFile: (detail: PreviewOpenFileDetail) => void;
}) {
  const placeholder = isPlaceholderWikiDocument(document);
  return (
    <article className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white px-7 py-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{document.section}</div>
          <h3 className="mt-1 text-xl font-semibold text-slate-950">{document.title}</h3>
        </div>
        <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${placeholder ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          {placeholder ? "需重新生成" : "已生成"}
        </div>
      </div>
      <div className="mt-5 min-w-0">
        <MDContent
          text={normalizeWikiDocumentMarkdown(document.content)}
          sourceRoot={document.workspaceKey}
          onOpenSourceFile={onOpenSourceFile}
        />
      </div>
      <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
        {generation.branch ? `${generation.branch} · ` : ""}
        {generation.commitShortHash || generation.commitId?.slice(0, 7) || "未绑定 Commit"}
      </div>
    </article>
  );
}

function SourceFileView({ preview }: { preview?: SourcePreviewState }) {
  const targetLineRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => (preview?.content ?? "").replace(/\r\n/g, "\n").split("\n"), [preview?.content]);
  const endLine = preview?.endLine && preview.startLine
    ? Math.max(preview.startLine, preview.endLine)
    : preview?.startLine;

  useEffect(() => {
    if (!preview?.startLine || !preview.content) return;
    window.requestAnimationFrame(() => {
      targetLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [preview?.content, preview?.startLine, preview?.endLine]);

  if (!preview) {
    return (
      <article className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white px-7 py-10 text-center shadow-sm">
        <FileText className="mx-auto h-8 w-8 text-slate-300" />
        <div className="mt-4 text-base font-semibold text-slate-700">正在打开源码文件</div>
      </article>
    );
  }

  return (
    <article className="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Source</div>
          <h3 className="mt-1 truncate text-lg font-semibold text-slate-950">{preview.title}</h3>
          <div className="mt-1 truncate font-mono text-xs text-slate-400" title={preview.filePath}>
            {preview.relativePath}
            {preview.startLine ? `#L${preview.startLine}${endLine && endLine !== preview.startLine ? `-L${endLine}` : ""}` : ""}
          </div>
        </div>
        {preview.language && (
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            {preview.language}
          </span>
        )}
      </div>
      {preview.loading ? (
        <div className="flex min-h-72 items-center justify-center text-sm font-medium text-slate-400">正在读取文件...</div>
      ) : preview.error ? (
        <div className="px-5 py-6 text-sm leading-6 text-red-600">{preview.error}</div>
      ) : (
        <div className="max-h-[68vh] overflow-auto bg-slate-950 py-4 text-[13px] leading-5 text-slate-100">
          {lines.map((line, index) => {
            const lineNumber = index + 1;
            const active = Boolean(preview.startLine && lineNumber >= preview.startLine && lineNumber <= (endLine ?? preview.startLine));
            return (
              <div
                key={lineNumber}
                ref={preview.startLine === lineNumber ? targetLineRef : undefined}
                data-source-line={lineNumber}
                data-source-active={active ? "true" : "false"}
                className={`grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-4 font-mono ${active ? "bg-amber-300/20 text-amber-50" : "text-slate-100"}`}
              >
                <span className={`select-none text-right ${active ? "text-amber-200" : "text-slate-500"}`}>{lineNumber}</span>
                <code className="min-w-0 whitespace-pre-wrap break-words">{line || " "}</code>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function WikiPreviewPlaceholder({ title }: { title?: string }) {
  return (
    <div className="w-full max-w-3xl rounded-xl border border-dashed border-slate-200 bg-white px-7 py-10 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
      <div className="mt-4 text-base font-semibold text-slate-700">{title ? `正在加载「${title}」` : "正在加载 Repo Wiki 文档"}</div>
      <div className="mt-2 text-sm text-slate-400">文档索引会从本地知识库 DB 读取，完成后会在这里预览。</div>
    </div>
  );
}

export function KnowledgePanel({ onBack, onOpenSettings }: KnowledgePanelProps) {
  const apiConfigSettings = useAppStore((s) => s.apiConfigSettings);
  const sessions = useAppStore((s) => s.sessions);
  const gitRefreshCacheRef = useRef<Record<string, string>>({});
  const observedGitCommitRef = useRef<Record<string, string>>({});
  const completedDocumentSeedRef = useRef<Set<string>>(new Set());
  const backendGenerationInFlightRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"repo" | "memory">("repo");
  const [selectedWorkspaceKey, setSelectedWorkspaceKey] = useState<string>("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [expandedWorkspaceKeys, setExpandedWorkspaceKeys] = useState<Set<string>>(() => new Set());
  const [openWikiTabs, setOpenWikiTabs] = useState<KnowledgeOpenTab[]>([]);
  const [activeWikiTabId, setActiveWikiTabId] = useState<string>("");
  const [sourcePreviewByTabId, setSourcePreviewByTabId] = useState<Record<string, SourcePreviewState>>({});
  const [systemWorkspace, setSystemWorkspace] = useState<string>("");
  const [manualWorkspacePaths, setManualWorkspacePaths] = useState<string[]>(() => readStoredWorkspacePaths());
  const [hiddenWorkspaceKeys, setHiddenWorkspaceKeys] = useState<Set<string>>(() => readStoredWorkspaceKeySet(KNOWLEDGE_HIDDEN_WORKSPACES_STORAGE_KEY));
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [knowledgeStateReady, setKnowledgeStateReady] = useState(false);
  const [storedWorkspaces, setStoredWorkspaces] = useState<KnowledgeWorkspace[]>([]);
  const [documentsByWorkspace, setDocumentsByWorkspace] = useState<Record<string, KnowledgeDocument[]>>({});
  const [generationByWorkspace, setGenerationByWorkspace] = useState<Record<string, GenerationState>>({});
  const [relationsByWorkspace, setRelationsByWorkspace] = useState<KnowledgeWorkspaceRelations>({});
  const [linkEditorWorkspaceKey, setLinkEditorWorkspaceKey] = useState<string>("");
  const [gitByWorkspace, setGitByWorkspace] = useState<Record<string, KnowledgeGitState>>({});
  const [autoUpdateByWorkspace, setAutoUpdateByWorkspace] = useState<Record<string, boolean>>(() => readStoredBooleanRecord(KNOWLEDGE_AUTO_UPDATE_STORAGE_KEY));

  const workspaces = useMemo<KnowledgeWorkspace[]>(() => {
    const sessionCounts = new Map<string, { count: number; updatedAt: number }>();
    for (const session of Object.values(sessions)) {
      const key = normalizeWorkspaceKey(session.cwd);
      if (!key) continue;
      const existing = sessionCounts.get(key);
      const updatedAt = session.updatedAt ?? 0;
      sessionCounts.set(key, {
        count: (existing?.count ?? 0) + 1,
        updatedAt: Math.max(existing?.updatedAt ?? 0, updatedAt),
      });
    }

    if (knowledgeStateReady || storedWorkspaces.length > 0) {
      const systemWorkspaceKey = normalizeWorkspaceKey(systemWorkspace);
      return storedWorkspaces
        .filter((workspace) => workspace.key && workspace.key !== systemWorkspaceKey && !hiddenWorkspaceKeys.has(workspace.key))
        .map((workspace) => {
          const sessionInfo = sessionCounts.get(workspace.key);
          return {
            ...workspace,
            sessionCount: sessionInfo?.count ?? 0,
            updatedAt: Math.max(workspace.updatedAt, sessionInfo?.updatedAt ?? 0),
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const groups = new Map<string, KnowledgeWorkspace>();
    const systemWorkspaceKey = normalizeWorkspaceKey(systemWorkspace);
    for (const session of Object.values(sessions)) {
      const key = normalizeWorkspaceKey(session.cwd);
      if (!key || key === systemWorkspaceKey || hiddenWorkspaceKeys.has(key)) continue;
      const existing = groups.get(key);
      const updatedAt = session.updatedAt ?? 0;
      if (existing) {
        existing.sessionCount += 1;
        existing.updatedAt = Math.max(existing.updatedAt, updatedAt);
        continue;
      }
      groups.set(key, {
        key,
        cwd: session.cwd,
        name: getWorkspaceName(session.cwd),
        sessionCount: 1,
        source: "session",
        updatedAt,
      });
    }

    for (const workspacePath of manualWorkspacePaths) {
      const key = normalizeWorkspaceKey(workspacePath);
      if (!key || key === systemWorkspaceKey || hiddenWorkspaceKeys.has(key) || groups.has(key)) continue;
      groups.set(key, {
        key,
        cwd: workspacePath,
        name: getWorkspaceName(workspacePath),
        sessionCount: 0,
        source: "manual",
        updatedAt: 0,
      });
    }

    return Array.from(groups.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [hiddenWorkspaceKeys, knowledgeStateReady, manualWorkspacePaths, sessions, storedWorkspaces, systemWorkspace]);
  const normalizedRepoSearchQuery = useMemo(() => normalizeSearchText(repoSearchQuery), [repoSearchQuery]);
  const hasRepoSearch = normalizedRepoSearchQuery.length > 0;
  const filteredDocumentsByWorkspace = useMemo<Record<string, KnowledgeDocument[]>>(() => {
    if (!hasRepoSearch) return documentsByWorkspace;
    const next: Record<string, KnowledgeDocument[]> = {};
    for (const [workspaceKey, documents] of Object.entries(documentsByWorkspace)) {
      const matchedDocuments = documents.filter((document) => documentMatchesSearch(document, normalizedRepoSearchQuery));
      if (matchedDocuments.length > 0) {
        next[workspaceKey] = matchedDocuments;
      }
    }
    return next;
  }, [documentsByWorkspace, hasRepoSearch, normalizedRepoSearchQuery]);
  const visibleWorkspaces = useMemo(() => {
    if (!hasRepoSearch) return workspaces;
    return workspaces.filter((workspace) => (
      workspaceMatchesSearch(workspace, normalizedRepoSearchQuery) ||
      (filteredDocumentsByWorkspace[workspace.key]?.length ?? 0) > 0
    ));
  }, [filteredDocumentsByWorkspace, hasRepoSearch, normalizedRepoSearchQuery, workspaces]);
  const repoSearchResultCount = useMemo(() => (
    visibleWorkspaces.reduce((count, workspace) => count + 1 + (filteredDocumentsByWorkspace[workspace.key]?.length ?? 0), 0)
  ), [filteredDocumentsByWorkspace, visibleWorkspaces]);
  const gitWorkspaceSignature = useMemo(() => (
    workspaces
      .map((workspace) => `${workspace.key}\t${workspace.cwd ?? ""}`)
      .sort()
      .join("\n")
  ), [workspaces]);
  const selectedWorkspace = workspaces.find((workspace) => workspace.key === selectedWorkspaceKey) ?? workspaces[0];
  const workspaceName = selectedWorkspace?.name ?? "选择工作区";
  const generation = selectedWorkspace
    ? generationByWorkspace[selectedWorkspace.key] ?? createIdleGeneration()
    : createIdleGeneration();
  const selectedDocuments = selectedWorkspace ? documentsByWorkspace[selectedWorkspace.key] ?? [] : [];
  const selectedDocument = selectedDocumentId
    ? selectedDocuments.find((document) => document.id === selectedDocumentId)
    : undefined;
  const activeWikiTab = openWikiTabs.find((tab) => tab.id === activeWikiTabId);
  const activeDocument = activeWikiTab?.kind === "document"
    ? selectedDocuments.find((document) => document.id === activeWikiTab.documentId) ?? selectedDocument
    : undefined;
  const activeSourcePreview = activeWikiTab?.kind === "source" ? sourcePreviewByTabId[activeWikiTab.id] : undefined;
  const showingDocumentPreview = Boolean(activeWikiTab?.kind === "document" || selectedDocumentId);
  const showingSourcePreview = activeWikiTab?.kind === "source";
  const previewDocument = activeDocument ?? selectedDocument;
  const selectedPreviewTitle = activeWikiTab?.title ?? selectedDocument?.title;
  const selectedGitState = selectedWorkspace ? gitByWorkspace[selectedWorkspace.key] : undefined;
  const gitReady = Boolean(selectedGitState?.hasGit && selectedGitState.commitId);
  const canStartGeneration = Boolean(selectedWorkspace);
  const autoUpdateEnabled = selectedWorkspace
    ? autoUpdateByWorkspace[selectedWorkspace.key] ?? gitReady
    : false;
  const selectedNeedsUpdate = Boolean(
    selectedGitState?.hasGit &&
    selectedGitState.commitId &&
    generation.commitId &&
    generation.commitId !== selectedGitState.commitId,
  );
  const modelState = useMemo(() => {
    const profiles = getRoutedProfiles(apiConfigSettings.profiles);
    const embeddingProfile = profiles.find((profile) => profile.embeddingModel?.trim());
    const wikiProfile = profiles.find((profile) => profile.wikiModel?.trim());
    return {
      embeddingModel: embeddingProfile?.embeddingModel?.trim() || "",
      embeddingProfileName: embeddingProfile?.name,
      wikiModel: wikiProfile?.wikiModel?.trim() || "",
      wikiProfileName: wikiProfile?.name,
    };
  }, [apiConfigSettings.profiles]);

  const embeddingReady = Boolean(modelState.embeddingModel);
  const hasStarted = generation.status !== "idle";
  const hasGeneratingWorkspace = useMemo(() => (
    Object.values(generationByWorkspace).some((state) => state.status === "generating")
  ), [generationByWorkspace]);

  const applyKnowledgeList = (result: KnowledgeListResponse) => {
    const nextWorkspaces = (result.workspaces ?? [])
      .map(normalizeKnowledgeWorkspace)
      .filter((workspace): workspace is KnowledgeWorkspace => Boolean(workspace));
    const nextGenerations: Record<string, GenerationState> = {};
    for (const [key, value] of Object.entries(result.generations ?? {})) {
      const workspaceKey = normalizeWorkspaceKey(key);
      const generationState = normalizeGenerationState(value);
      if (workspaceKey && generationState) {
        nextGenerations[workspaceKey] = generationState;
      }
    }
    const nextRelations = normalizeWorkspaceRelations(result.relations);
    setStoredWorkspaces((current) => workspaceListEquals(current, nextWorkspaces) ? current : nextWorkspaces);
    setGenerationByWorkspace((current) => generationRecordEquals(current, nextGenerations) ? current : nextGenerations);
    setRelationsByWorkspace((current) => relationRecordEquals(current, nextRelations) ? current : nextRelations);
  };

  const activateWikiTab = (tab: KnowledgeOpenTab) => {
    setActiveWikiTabId(tab.id);
    setSelectedWorkspaceKey(tab.workspaceKey);
    setSelectedDocumentId(tab.kind === "document" ? tab.documentId ?? "" : "");
  };

  const openWorkspaceTab = (workspace: KnowledgeWorkspace) => {
    const tab: KnowledgeOpenTab = {
      id: workspaceTabId(workspace.key),
      kind: "workspace",
      workspaceKey: workspace.key,
      title: workspace.name,
    };
    setOpenWikiTabs((current) => {
      const existingIndex = current.findIndex((item) => item.id === tab.id);
      if (existingIndex < 0) return [...current, tab];
      return current.map((item, index) => index === existingIndex ? { ...item, ...tab } : item);
    });
    activateWikiTab(tab);
  };

  const openDocumentTab = (workspace: KnowledgeWorkspace, document: KnowledgeDocument) => {
    const tab: KnowledgeOpenTab = {
      id: documentTabId(workspace.key, document.id),
      kind: "document",
      workspaceKey: workspace.key,
      documentId: document.id,
      title: document.title,
    };
    setOpenWikiTabs((current) => {
      const existingIndex = current.findIndex((item) => item.id === tab.id);
      if (existingIndex < 0) return [...current, tab];
      return current.map((item, index) => index === existingIndex ? { ...item, ...tab } : item);
    });
    activateWikiTab(tab);
  };

  const openSourceTab = useCallback((detail: PreviewOpenFileDetail) => {
    const fallbackWorkspace = activeWikiTab?.workspaceKey
      ? workspaces.find((workspace) => workspace.key === activeWikiTab.workspaceKey)
      : selectedWorkspace;
    const targetWorkspace = findWorkspaceForSource(workspaces, detail.filePath, fallbackWorkspace ?? selectedWorkspace);
    const workspaceRoot = targetWorkspace?.cwd ?? targetWorkspace?.key ?? "";
    if (!targetWorkspace || !workspaceRoot) {
      setWorkspaceError("没有找到源码文件所属的知识库工作区。");
      return;
    }

    const tabId = sourceTabId(targetWorkspace.key, detail.filePath);
    const title = fileNameFromPath(detail.filePath);
    const tab: KnowledgeOpenTab = {
      id: tabId,
      kind: "source",
      workspaceKey: targetWorkspace.key,
      sourcePath: detail.filePath,
      startLine: detail.startLine,
      endLine: detail.endLine,
      title,
    };
    const relativePath = relativePathFromWorkspace(workspaceRoot, detail.filePath);

    setOpenWikiTabs((current) => {
      const existingIndex = current.findIndex((item) => item.id === tab.id);
      if (existingIndex < 0) return [...current, tab];
      return current.map((item, index) => index === existingIndex ? { ...item, ...tab } : item);
    });
    activateWikiTab(tab);
    setSourcePreviewByTabId((current) => ({
      ...current,
      [tabId]: {
        ...(current[tabId] ?? {}),
        tabId,
        workspaceKey: targetWorkspace.key,
        filePath: detail.filePath,
        relativePath,
        title,
        startLine: detail.startLine,
        endLine: detail.endLine,
        loading: true,
        error: undefined,
      },
    }));

    const electron = (window as unknown as {
      electron?: {
        readPreviewFile?: (input: { cwd: string; path: string }) => Promise<{
          success?: boolean;
          content?: string;
          path?: string;
          language?: string;
          error?: string;
        }>;
      };
    }).electron;

    const readPromise = electron?.readPreviewFile?.({ cwd: workspaceRoot, path: detail.filePath });
    if (!readPromise) {
      setSourcePreviewByTabId((current) => ({
        ...current,
        [tabId]: {
          ...(current[tabId] ?? {
            tabId,
            workspaceKey: targetWorkspace.key,
            filePath: detail.filePath,
            relativePath,
            title,
          }),
          loading: false,
          error: "当前运行时没有文件预览 IPC，无法打开源码文件。",
        },
      }));
      return;
    }

    void readPromise
      .then((result) => {
        setSourcePreviewByTabId((current) => ({
          ...current,
          [tabId]: {
            ...(current[tabId] ?? {
              tabId,
              workspaceKey: targetWorkspace.key,
              filePath: detail.filePath,
              relativePath,
              title,
            }),
            filePath: result.path || detail.filePath,
            relativePath: relativePathFromWorkspace(workspaceRoot, result.path || detail.filePath),
            content: result.success ? result.content ?? "" : undefined,
            language: result.language,
            startLine: detail.startLine,
            endLine: detail.endLine,
            loading: false,
            error: result.success ? undefined : result.error || "源码文件读取失败。",
          },
        }));
      })
      .catch((error) => {
        setSourcePreviewByTabId((current) => ({
          ...current,
          [tabId]: {
            ...(current[tabId] ?? {
              tabId,
              workspaceKey: targetWorkspace.key,
              filePath: detail.filePath,
              relativePath,
              title,
            }),
            startLine: detail.startLine,
            endLine: detail.endLine,
            loading: false,
            error: error instanceof Error ? error.message : "源码文件读取失败。",
          },
        }));
      });
  }, [activeWikiTab?.workspaceKey, selectedWorkspace, workspaces]);

  useEffect(() => {
    const handlePreviewOpenFile = (event: Event) => {
      const detail = (event as CustomEvent<PreviewOpenFileDetail>).detail;
      if (!detail?.filePath) return;
      openSourceTab(detail);
    };

    window.addEventListener(PREVIEW_OPEN_FILE_EVENT, handlePreviewOpenFile);
    return () => window.removeEventListener(PREVIEW_OPEN_FILE_EVENT, handlePreviewOpenFile);
  }, [openSourceTab]);

  const loadWorkspaceDocuments = async (workspaceKey: string): Promise<KnowledgeDocument[]> => {
    const result = await invokeKnowledge<KnowledgeDocumentsResponse>("knowledge:list-documents", { workspaceKey });
    const documents = (result.documents ?? [])
      .map(normalizeKnowledgeDocument)
      .filter((document): document is KnowledgeDocument => Boolean(document));
    setDocumentsByWorkspace((current) => ({ ...current, [workspaceKey]: documents }));
    return documents;
  };

  const closeWikiTab = (tabId: string) => {
    const index = openWikiTabs.findIndex((tab) => tab.id === tabId);
    const nextTabs = openWikiTabs.filter((tab) => tab.id !== tabId);
    setSourcePreviewByTabId((current) => {
      if (!current[tabId]) return current;
      const next = { ...current };
      delete next[tabId];
      return next;
    });
    setOpenWikiTabs(nextTabs);
    if (activeWikiTabId !== tabId) return;
    const fallbackTab = nextTabs[Math.max(0, index - 1)] ?? nextTabs[0];
    if (fallbackTab) {
      activateWikiTab(fallbackTab);
    } else {
      setActiveWikiTabId("");
      setSelectedDocumentId("");
    }
  };

  const handleWorkspaceClick = (workspace: KnowledgeWorkspace) => {
    openWorkspaceTab(workspace);
    const state = generationByWorkspace[workspace.key];
    if (state && state.status !== "idle") {
      void loadWorkspaceDocuments(workspace.key)
        .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "读取 Repo Wiki 文档失败。"));
    }
    setExpandedWorkspaceKeys((current) => {
      const next = new Set(current);
      if (next.has(workspace.key)) {
        next.delete(workspace.key);
      } else {
        next.add(workspace.key);
      }
      return next;
    });
  };

  useEffect(() => {
    let disposed = false;
    window.electron.getSystemWorkspace()
      .then((workspace) => {
        if (!disposed) setSystemWorkspace(normalizeWorkspaceKey(workspace));
      })
      .catch(() => {
        if (!disposed) setSystemWorkspace("");
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    invokeKnowledge<KnowledgeListResponse>("knowledge:list")
      .then((result) => {
        if (disposed) return;
        applyKnowledgeList(result);
        setKnowledgeStateReady(true);
      })
      .catch((error) => {
        if (disposed) return;
        setWorkspaceError(error instanceof Error ? error.message : "读取知识库状态失败。");
        setKnowledgeStateReady(true);
      });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!knowledgeStateReady) return;
    const systemWorkspaceKey = normalizeWorkspaceKey(systemWorkspace);
    const sessionWorkspaceInputs = Object.values(sessions)
      .map((session) => {
        const cwd = normalizeWorkspaceKey(session.cwd);
        return cwd ? { cwd, name: getWorkspaceName(cwd) } : null;
      })
      .filter((item): item is { cwd: string; name: string } => Boolean(item));
    const migratedWorkspaceInputs = manualWorkspacePaths
      .map((cwd) => normalizeWorkspaceKey(cwd))
      .filter(Boolean)
      .map((cwd) => ({ cwd, name: getWorkspaceName(cwd) }));
    const uniqueInputs = Array.from(
      new Map([...sessionWorkspaceInputs, ...migratedWorkspaceInputs]
        .filter((item) => item.cwd !== systemWorkspaceKey)
        .map((item) => [item.cwd, item])).values(),
    );
    if (uniqueInputs.length === 0) return;

    let disposed = false;
    invokeKnowledge<KnowledgeListResponse>("knowledge:sync-workspaces", {
      workspaces: uniqueInputs,
      systemWorkspace,
    })
      .then((result) => {
        if (!disposed) applyKnowledgeList(result);
      })
      .catch((error) => {
        if (!disposed) setWorkspaceError(error instanceof Error ? error.message : "同步工作区失败。");
      });
    return () => {
      disposed = true;
    };
  }, [knowledgeStateReady, manualWorkspacePaths, sessions, systemWorkspace]);

  useEffect(() => {
    if (!knowledgeStateReady || !hasGeneratingWorkspace) return;

    let disposed = false;
    const refreshGenerationState = () => {
      void invokeKnowledge<KnowledgeListResponse>("knowledge:list")
        .then((result) => {
          if (disposed) return;
          applyKnowledgeList(result);
          const generatingWorkspaceKeys = Object.entries(result.generations ?? {})
            .filter(([, value]) => normalizeGenerationState(value)?.status === "generating")
            .map(([key]) => normalizeWorkspaceKey(key))
            .filter(Boolean);
          for (const workspaceKey of generatingWorkspaceKeys) {
            void loadWorkspaceDocuments(workspaceKey)
              .then((documents) => {
                if (documents.length > 0) completedDocumentSeedRef.current.delete(workspaceKey);
              })
              .catch((error) => {
                if (!disposed) setWorkspaceError(error instanceof Error ? error.message : "刷新 Repo Wiki 文档失败。");
              });
          }
        })
        .catch((error) => {
          if (!disposed) setWorkspaceError(error instanceof Error ? error.message : "刷新知识库状态失败。");
        });
    };

    refreshGenerationState();
    const timer = window.setInterval(refreshGenerationState, 2_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [hasGeneratingWorkspace, knowledgeStateReady]);

  useEffect(() => {
    try {
      window.localStorage.setItem(KNOWLEDGE_WORKSPACES_STORAGE_KEY, JSON.stringify(manualWorkspacePaths));
    } catch {
      // Ignore storage failures; the current UI state still remains usable.
    }
  }, [manualWorkspacePaths]);

  useEffect(() => {
    const systemWorkspaceKey = normalizeWorkspaceKey(systemWorkspace);
    const sessionWorkspacePaths = Object.values(sessions)
      .map((session) => normalizeWorkspaceKey(session.cwd))
      .filter((key) => key && key !== systemWorkspaceKey && !hiddenWorkspaceKeys.has(key));
    if (sessionWorkspacePaths.length === 0) return;
    setManualWorkspacePaths((current) => {
      const currentKeys = new Set(current.map((item) => normalizeWorkspaceKey(item)));
      const nextPaths = sessionWorkspacePaths.filter((key) => !currentKeys.has(key));
      return nextPaths.length > 0 ? [...current, ...nextPaths] : current;
    });
  }, [hiddenWorkspaceKeys, sessions, systemWorkspace]);

  useEffect(() => {
    try {
      window.localStorage.setItem(KNOWLEDGE_HIDDEN_WORKSPACES_STORAGE_KEY, JSON.stringify(Array.from(hiddenWorkspaceKeys)));
    } catch {
      // Ignore storage failures; the current UI state still remains usable.
    }
  }, [hiddenWorkspaceKeys]);

  useEffect(() => {
    try {
      window.localStorage.setItem(KNOWLEDGE_AUTO_UPDATE_STORAGE_KEY, JSON.stringify(autoUpdateByWorkspace));
    } catch {
      // Ignore storage failures; the current UI state still remains usable.
    }
  }, [autoUpdateByWorkspace]);

  useEffect(() => {
    if (!selectedWorkspace) {
      setSelectedDocumentId("");
      return;
    }
    if (generation.status === "idle") return;
    const workspaceKey = selectedWorkspace.key;
    if (generation.status === "completed" && (documentsByWorkspace[workspaceKey]?.length ?? 0) > 0 && completedDocumentSeedRef.current.has(workspaceKey)) return;

    let disposed = false;
    loadWorkspaceDocuments(workspaceKey)
      .then((documents) => {
        if (disposed) return;
        if (generation.status === "completed" && documents.length > 0) {
          completedDocumentSeedRef.current.add(workspaceKey);
        }
        setSelectedDocumentId((current) => documents.some((document) => document.id === current) ? current : "");
      })
      .catch((error) => {
        if (!disposed) setWorkspaceError(error instanceof Error ? error.message : "读取 Repo Wiki 文档失败。");
      });
    return () => {
      disposed = true;
    };
  }, [generation.status, selectedWorkspace?.key]);

  useEffect(() => {
    if (!selectedWorkspace) {
      if (selectedDocumentId) setSelectedDocumentId("");
      return;
    }
    if (selectedDocumentId && selectedDocuments.length > 0 && !selectedDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId("");
    }
  }, [selectedDocumentId, selectedDocuments, selectedWorkspace]);

  useEffect(() => {
    let disposed = false;
    const loadGitState = async (workspace: KnowledgeWorkspace, options: { force?: boolean; showLoading?: boolean } = {}) => {
      const workspacePath = workspace.cwd?.trim();
      if (!workspacePath) return;
      const cacheKey = `${workspace.key}\t${workspacePath}`;
      if (!options.force && gitRefreshCacheRef.current[workspace.key] === cacheKey) return;
      gitRefreshCacheRef.current[workspace.key] = cacheKey;
      if (options.showLoading) {
        setGitByWorkspace((current) => {
          const existing = current[workspace.key];
          const loading = !(existing?.hasGit || existing?.error);
          const nextState: KnowledgeGitState = {
            ...(existing ?? {
              hasGit: false,
              branch: null,
              commitId: "",
              commitShortHash: "",
              changedCount: 0,
            }),
            loading,
          };
          if (gitStateEquals(existing, nextState)) return current;
          return { ...current, [workspace.key]: nextState };
        });
      }
      try {
        const result = await withTimeout(
          window.electron.getGitSnapshot({ cwd: workspacePath }),
          GIT_SNAPSHOT_TIMEOUT_MS,
          "读取 Git 信息超时，可先手动生成。",
        );
        if (disposed) return;
        setGitByWorkspace((current) => {
          const nextState: KnowledgeGitState = result.success
            ? resolveHeadFromSnapshot(result.data)
            : {
              loading: false,
              hasGit: false,
              branch: null,
              commitId: "",
              commitShortHash: "",
              changedCount: 0,
              error: result.error.message,
            };
          if (gitStateEquals(current[workspace.key], nextState)) return current;
          return { ...current, [workspace.key]: nextState };
        });
      } catch (error) {
        if (disposed) return;
        setGitByWorkspace((current) => {
          const nextState: KnowledgeGitState = {
            loading: false,
            hasGit: false,
            branch: null,
            commitId: "",
            commitShortHash: "",
            changedCount: 0,
            error: error instanceof Error ? error.message : String(error),
          };
          if (gitStateEquals(current[workspace.key], nextState)) return current;
          return { ...current, [workspace.key]: nextState };
        });
      }
    };

    workspaces.forEach((workspace) => {
      void loadGitState(workspace, { showLoading: true });
    });

    const timer = window.setInterval(() => {
      workspaces.forEach((workspace) => {
        void loadGitState(workspace, { force: true, showLoading: false });
      });
    }, GIT_REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [gitWorkspaceSignature]);

  useEffect(() => {
    setGenerationByWorkspace((current) => {
      let changed = false;
      const next = { ...current };
      for (const [workspaceKey, git] of Object.entries(gitByWorkspace)) {
        if (!git?.hasGit || !git.commitId || git.loading || hiddenWorkspaceKeys.has(workspaceKey)) continue;

        const generation = current[workspaceKey];
        if (generation && generation.status !== "idle" && !generation.commitId) {
          next[workspaceKey] = applyGitBinding(generation, git);
          changed = true;
        }

        const previousObservedCommit = observedGitCommitRef.current[workspaceKey];
        observedGitCommitRef.current[workspaceKey] = git.commitId;

        const currentGeneration = current[workspaceKey];
        const autoEnabled = autoUpdateByWorkspace[workspaceKey] ?? true;
        const headChangedWhileVisible = Boolean(previousObservedCommit && previousObservedCommit !== git.commitId);
        const restoredStaleGeneration = !previousObservedCommit && Boolean(currentGeneration?.commitId && currentGeneration.commitId !== git.commitId);
        const shouldAutoUpdate = autoEnabled && (headChangedWhileVisible || restoredStaleGeneration);

        if (!shouldAutoUpdate || !currentGeneration?.commitId || currentGeneration.status === "generating") continue;
	        next[workspaceKey] = applyGitBinding({
	          status: "generating",
	          completed: 0,
	          total: 1,
	          processing: 1,
	          failed: 0,
	          phase: "正在规划目录",
	        }, git);
        changed = true;
      }
      return changed ? next : current;
    });
  }, [autoUpdateByWorkspace, gitByWorkspace, hiddenWorkspaceKeys]);

  useEffect(() => {
    if (workspaces.length === 0) {
      if (selectedWorkspaceKey) setSelectedWorkspaceKey("");
      return;
    }
    if (!selectedWorkspaceKey && workspaces[0]) {
      setSelectedWorkspaceKey(workspaces[0].key);
      return;
    }
    if (selectedWorkspaceKey && workspaces.every((workspace) => workspace.key !== selectedWorkspaceKey) && workspaces[0]) {
      setSelectedWorkspaceKey(workspaces[0].key);
    }
  }, [selectedWorkspaceKey, workspaces]);

  useEffect(() => {
    if (!selectedWorkspace) {
      if (activeWikiTabId) setActiveWikiTabId("");
      if (openWikiTabs.length > 0) setOpenWikiTabs([]);
      setSourcePreviewByTabId({});
      return;
    }
    if (openWikiTabs.length > 0 || activeWikiTabId) return;
    const tab: KnowledgeOpenTab = {
      id: workspaceTabId(selectedWorkspace.key),
      kind: "workspace",
      workspaceKey: selectedWorkspace.key,
      title: selectedWorkspace.name,
    };
    setOpenWikiTabs([tab]);
    setActiveWikiTabId(tab.id);
  }, [activeWikiTabId, openWikiTabs.length, selectedWorkspace]);

  const startGeneration = (targetWorkspace = selectedWorkspace) => {
    if (!targetWorkspace) return;
    if (!embeddingReady) {
      setWorkspaceError("请先配置向量模型 embeddingModel，否则知识库不能生成和索引。");
      return;
    }
    const git = gitByWorkspace[targetWorkspace.key];
    const workspaceKey = targetWorkspace.key;
    const workspaceTab: KnowledgeOpenTab = {
      id: workspaceTabId(workspaceKey),
      kind: "workspace",
      workspaceKey,
      title: targetWorkspace.name,
    };
    completedDocumentSeedRef.current.delete(targetWorkspace.key);
    backendGenerationInFlightRef.current.add(workspaceKey);
    setOpenWikiTabs((current) => {
      const next = current.filter((tab) => tab.workspaceKey !== workspaceKey || tab.kind === "workspace");
      return next.some((tab) => tab.id === workspaceTab.id) ? next : [...next, workspaceTab];
    });
    setActiveWikiTabId(workspaceTab.id);
    setSelectedDocumentId("");
    setDocumentsByWorkspace((current) => {
      const next = { ...current };
      delete next[workspaceKey];
      return next;
    });
	    const startedState = applyGitBinding({
	      status: "generating",
	      completed: 0,
	      total: 1,
	      processing: 1,
	      failed: 0,
	      phase: "正在规划目录",
	    }, git);
    setGenerationByWorkspace((current) => ({
      ...current,
      [workspaceKey]: startedState,
    }));
    void invokeKnowledge<KnowledgeRunGenerationResponse>("knowledge:run-generation", {
      workspaceKey,
      state: startedState,
    })
      .then((result) => {
        const nextGeneration = normalizeGenerationState(result.generation) ?? {
          ...startedState,
          status: result.success ? "completed" : "paused",
          completed: result.success ? startedState.total : Math.min(startedState.completed, startedState.total - 1),
          processing: 0,
          failed: result.success ? 0 : 1,
          updatedAt: Date.now(),
        };
        const documents = (result.documents ?? [])
          .map(normalizeKnowledgeDocument)
          .filter((document): document is KnowledgeDocument => Boolean(document));
        setGenerationByWorkspace((current) => ({
          ...current,
          [workspaceKey]: nextGeneration,
        }));
        if (documents.length > 0) {
          setDocumentsByWorkspace((current) => ({
            ...current,
            [workspaceKey]: documents,
          }));
        } else if (nextGeneration.status === "completed") {
          void loadWorkspaceDocuments(workspaceKey)
            .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "读取 Repo Wiki 文档失败。"));
        }
        if (!result.success) {
          setWorkspaceError(result.error || result.report?.error || result.report?.message || "Repo Wiki 生成失败。");
        }
      })
      .catch((error) => {
        setGenerationByWorkspace((current) => ({
          ...current,
	          [workspaceKey]: {
	            ...(current[workspaceKey] ?? startedState),
	            status: "paused",
	            processing: 0,
	            failed: 1,
	            phase: "生成失败",
	            updatedAt: Date.now(),
	          },
        }));
        setWorkspaceError(error instanceof Error ? error.message : "Repo Wiki 生成失败。");
      })
      .finally(() => {
        backendGenerationInFlightRef.current.delete(workspaceKey);
      });
  };

  const pauseGeneration = () => {
    if (!selectedWorkspace) return;
    const workspaceKey = selectedWorkspace.key;
    const nextState = {
      ...(generationByWorkspace[workspaceKey] ?? createIdleGeneration()),
      status: "paused" as const,
      processing: 0,
      updatedAt: Date.now(),
    };
    setGenerationByWorkspace((current) => ({
      ...current,
      [workspaceKey]: nextState,
    }));
    void invokeKnowledge("knowledge:update-generation", { workspaceKey, state: nextState })
      .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "写入生成状态失败。"));
  };

  const continueGeneration = () => {
    startGeneration();
  };

  const cancelGeneration = () => {
    if (!selectedWorkspace) return;
    const workspaceKey = selectedWorkspace.key;
    const idleState = createIdleGeneration();
    backendGenerationInFlightRef.current.delete(workspaceKey);
    setGenerationByWorkspace((current) => ({
      ...current,
      [workspaceKey]: idleState,
    }));
    void invokeKnowledge("knowledge:update-generation", { workspaceKey, state: idleState })
      .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "写入生成状态失败。"));
  };

  const toggleAutoUpdate = () => {
    if (!selectedWorkspace || !gitReady) return;
    setAutoUpdateByWorkspace((current) => ({
      ...current,
      [selectedWorkspace.key]: !(current[selectedWorkspace.key] ?? true),
    }));
  };

  const saveWorkspaceLinks = (workspaceKey: string, linkedWorkspaceKeys: string[]) => {
    const key = normalizeWorkspaceKey(workspaceKey);
    if (!key) return;
    const nextTargets = Array.from(new Set(linkedWorkspaceKeys.map(normalizeWorkspaceKey).filter((item) => item && item !== key)));
    setRelationsByWorkspace((current) => ({
      ...current,
      [key]: nextTargets,
    }));
    void invokeKnowledge<KnowledgeWorkspaceLinksResponse>("knowledge:set-workspace-links", {
      workspaceKey: key,
      linkedWorkspaceKeys: nextTargets,
    })
      .then((result) => {
        const nextRelations = normalizeWorkspaceRelations(result.relations);
        setRelationsByWorkspace((current) => relationRecordEquals(current, nextRelations) ? current : nextRelations);
      })
      .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "关联知识库失败。"));
  };

  const toggleWorkspaceLink = (workspaceKey: string, linkedWorkspaceKey: string) => {
    const key = normalizeWorkspaceKey(workspaceKey);
    const target = normalizeWorkspaceKey(linkedWorkspaceKey);
    if (!key || !target || key === target) return;
    const currentTargets = relationsByWorkspace[key] ?? [];
    const nextTargets = currentTargets.includes(target)
      ? currentTargets.filter((item) => item !== target)
      : [...currentTargets, target];
    saveWorkspaceLinks(key, nextTargets);
  };

  const addWorkspace = async () => {
    setWorkspaceError(null);
    try {
      const selectedPath = await window.electron.selectDirectory();
      const key = normalizeWorkspaceKey(selectedPath);
      if (!key) return;
      if (systemWorkspace && key === systemWorkspace) {
        setWorkspaceError("系统工作区不参与知识库，请选择一个项目工作区。");
        return;
      }
      const saved = await invokeKnowledge<KnowledgeWorkspaceRecord>("knowledge:add-workspace", { cwd: key, source: "manual" });
      const workspace = normalizeKnowledgeWorkspace(saved);
      if (workspace) {
        setStoredWorkspaces((current) => {
          const next = current.filter((item) => item.key !== workspace.key);
          return [workspace, ...next];
        });
      }
      setHiddenWorkspaceKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      setManualWorkspacePaths((current) => current.some((item) => normalizeWorkspaceKey(item) === key) ? current : [key, ...current]);
      setSelectedWorkspaceKey(key);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "新增知识库失败。");
    }
  };

  const removeWorkspace = (workspace: KnowledgeWorkspace) => {
    setWorkspaceError(null);
    void invokeKnowledge("knowledge:remove-workspace", { workspaceKey: workspace.key })
      .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "删除工作区失败。"));
    setStoredWorkspaces((current) => current.filter((item) => item.key !== workspace.key));
    setHiddenWorkspaceKeys((current) => new Set(current).add(workspace.key));
    setManualWorkspacePaths((current) => current.filter((item) => normalizeWorkspaceKey(item) !== workspace.key));
    setGenerationByWorkspace((current) => {
      const next = { ...current };
      delete next[workspace.key];
      return next;
    });
    setRelationsByWorkspace((current) => {
      const next: KnowledgeWorkspaceRelations = {};
      for (const [key, targets] of Object.entries(current)) {
        if (key === workspace.key) continue;
        const filteredTargets = targets.filter((target) => target !== workspace.key);
        if (filteredTargets.length > 0) next[key] = filteredTargets;
      }
      return next;
    });
    if (linkEditorWorkspaceKey === workspace.key) {
      setLinkEditorWorkspaceKey("");
    }
    setDocumentsByWorkspace((current) => {
      const next = { ...current };
      delete next[workspace.key];
      return next;
    });
    const remainingTabs = openWikiTabs.filter((tab) => tab.workspaceKey !== workspace.key);
    setOpenWikiTabs(remainingTabs);
    if (activeWikiTab?.workspaceKey === workspace.key) {
      const fallbackTab = remainingTabs[0];
      if (fallbackTab) {
        activateWikiTab(fallbackTab);
      } else {
        setActiveWikiTabId("");
        setSelectedDocumentId("");
      }
    }
    if (selectedWorkspaceKey === workspace.key) {
      setSelectedWorkspaceKey("");
    }
  };

  return (
    <section className="flex h-full min-h-0 bg-white text-slate-900">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-slate-200 bg-[#f7f7f7]">
        <div className="border-b border-slate-200 bg-[#f7f7f7] px-4 py-3">
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                aria-label="返回聊天"
                onClick={onBack}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="text-base font-semibold">知识</div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("repo")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "repo" ? "bg-slate-100 text-slate-950 shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Repo Wiki
            </button>
            <button
              type="button"
              disabled
              title="TODO：记忆面板后续接入"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-slate-400 opacity-70"
            >
              <span>记忆</span>
              <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-400">
                TODO
              </span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={repoSearchQuery}
                onChange={(event) => setRepoSearchQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="搜索 Repo Wiki"
              />
              {repoSearchQuery ? (
                <button
                  type="button"
                  aria-label="清空 Repo Wiki 搜索"
                  onClick={() => setRepoSearchQuery("")}
                  className="rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" type="button" aria-label="筛选">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
          {hasRepoSearch ? (
            <div className="mt-2 truncate text-xs text-slate-400">
              找到 {repoSearchResultCount} 个结果
            </div>
          ) : null}
          <button
            type="button"
            onClick={addWorkspace}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FolderPlus className="h-4 w-4" />
            新增知识库
          </button>
          {workspaceError && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              {workspaceError}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
          {workspaces.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
              <Network className="mx-auto h-7 w-7 text-slate-300" />
              <div className="mt-3 text-sm font-semibold text-slate-700">暂无知识库</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">新增知识库后再生成 Repo Wiki。</div>
              <button
                type="button"
                onClick={addWorkspace}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <FolderPlus className="h-4 w-4" />
                新增知识库
              </button>
            </div>
          ) : visibleWorkspaces.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
              <Search className="mx-auto h-7 w-7 text-slate-300" />
              <div className="mt-3 text-sm font-semibold text-slate-700">没有匹配结果</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">换个关键词试试，支持搜索标题、章节、正文和工作区路径。</div>
            </div>
          ) : (
            <div className="space-y-0.5">
            {visibleWorkspaces.map((workspace) => {
              const workspaceGeneration = generationByWorkspace[workspace.key] ?? createIdleGeneration();
              const workspaceDocuments = filteredDocumentsByWorkspace[workspace.key] ?? [];
              const workspaceGit = gitByWorkspace[workspace.key];
              const selected = workspace.key === selectedWorkspace?.key;
              const expanded = expandedWorkspaceKeys.has(workspace.key);
              const linkedKeys = relationsByWorkspace[workspace.key] ?? [];
              const linkedWorkspaces = linkedKeys
                .map((key) => workspaces.find((item) => item.key === key))
                .filter((item): item is KnowledgeWorkspace => Boolean(item));
              const linkEditorOpen = linkEditorWorkspaceKey === workspace.key;
              const linkCandidates = workspaces.filter((item) => item.key !== workspace.key);
              const needsUpdate = Boolean(
                workspaceGit?.hasGit &&
                workspaceGit.commitId &&
                workspaceGeneration.commitId &&
                workspaceGeneration.commitId !== workspaceGit.commitId,
              );
              const statusLabel = workspaceGeneration.status === "idle"
                ? "去生成"
                : workspaceGeneration.status === "generating"
                  ? workspaceGeneration.total > 1
                    ? `生成中 ${workspaceGeneration.completed}/${workspaceGeneration.total}`
                    : workspaceDocuments.length > 0
                      ? `生成中 ${workspaceDocuments.length}`
                      : "生成中"
                  : workspaceGeneration.status === "paused"
                    ? workspaceGeneration.failed > 0 ? "生成失败" : "已暂停"
                    : "已完成";
              return (
                <div key={workspace.key}>
                  <div className={`group/workspace relative flex items-center rounded-md transition-colors ${selected ? "bg-slate-100" : "hover:bg-slate-50"}`}>
                    <button
                      type="button"
                      aria-label={`打开工作区 ${workspace.name}`}
                      title={`${workspace.name}\n${workspace.cwd}`}
                      className="flex min-w-0 flex-1 items-center justify-between px-1.5 py-1 text-left"
                      onClick={() => handleWorkspaceClick(workspace)}
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-slate-500 transition-colors ${
                            expanded || selected
                              ? "border-slate-300 bg-white"
                              : "border-slate-200 bg-white/70"
                          }`}
                        >
                          <Network className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold">{workspace.name}</span>
                        {linkedKeys.length > 0 ? (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-white/80 px-1 py-0.5 text-[10px] font-semibold leading-none text-slate-500">
                            <Link2 className="h-2.5 w-2.5" />
                            {linkedKeys.length}
                          </span>
                        ) : null}
                      </div>
                      <span className="ml-1.5 flex shrink-0 items-center gap-1">
                        <span className="text-[11px] font-semibold text-slate-500">{statusLabel}</span>
                        {workspaceGeneration.status !== "idle" ? (
                          <span className="text-slate-400">
                            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="pointer-events-none absolute left-8 top-full z-30 mt-1 hidden min-w-64 max-w-80 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-lg group-hover/workspace:block">
                      <div className="font-semibold text-slate-900">{workspace.name}</div>
                      {workspaceGit?.branch ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <GitBranch className="h-3.5 w-3.5" />
                          <span className="truncate">{workspaceGit.branch}</span>
                        </div>
                      ) : null}
                      <div className="mt-1 flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5" />
                        <span className="truncate">{workspace.cwd}</span>
                      </div>
                    </div>
                    {needsUpdate && workspaceGeneration.status !== "generating" ? (
                      <button
                        type="button"
                        aria-label={`更新 ${workspace.name} Repo Wiki`}
                        onClick={() => startGeneration(workspace)}
                        disabled={!embeddingReady}
                        className="mr-2 shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        更新
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`关联 ${workspace.name} 知识库`}
                      title="关联其他知识库"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedWorkspaceKey(workspace.key);
                        setLinkEditorWorkspaceKey((current) => current === workspace.key ? "" : workspace.key);
                      }}
                      className={`mr-0.5 rounded-md p-1 transition ${
                        linkEditorOpen || linkedKeys.length > 0
                          ? "bg-white text-slate-700"
                          : "text-slate-400 opacity-0 hover:bg-white hover:text-slate-700 group-hover/workspace:opacity-100 focus:opacity-100"
                      }`}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`删除 ${workspace.name}`}
                      onClick={() => removeWorkspace(workspace)}
                      className="mr-0.5 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-white hover:text-rose-600 group-hover/workspace:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {linkEditorOpen ? (
                    <div className="mx-1 mt-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-semibold text-slate-700">关联知识库</div>
                        {linkedWorkspaces.length > 0 ? (
                          <span className="shrink-0 text-[11px] text-slate-400">{linkedWorkspaces.length} 个</span>
                        ) : null}
                      </div>
                      {linkCandidates.length === 0 ? (
                        <div className="rounded-md bg-slate-50 px-2 py-1.5 text-xs leading-5 text-slate-400">
                          先新增前端、后端或接口仓库，再在这里关联。
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          {linkCandidates.map((candidate) => {
                            const checked = linkedKeys.includes(candidate.key);
                            return (
                              <button
                                key={candidate.key}
                                type="button"
                                onClick={() => toggleWorkspaceLink(workspace.key, candidate.key)}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition ${
                                  checked ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                                }`}
                              >
                                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                  checked ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"
                                }`}>
                                  {checked ? <span className="h-1.5 w-1.5 rounded-sm bg-white" /> : null}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                  {activeTab === "repo" && (expanded || hasRepoSearch) && workspaceGeneration.status !== "idle" && (
                    <SectionTree
                      active={workspaceDocuments.length > 0}
                      documents={workspaceDocuments}
                      selectedDocumentId={selectedDocumentId}
                      onSelectDocument={(document) => openDocumentTab(workspace, document)}
                      forceExpanded={hasRepoSearch}
                    />
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="border-b border-slate-200 bg-white">
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 items-end self-stretch overflow-x-auto">
                {openWikiTabs.map((tab) => {
                  const active = tab.id === activeWikiTabId;
                  return (
                    <div
                      key={tab.id}
                      className={`group flex h-12 max-w-[240px] shrink-0 items-center border-b-2 text-sm transition ${
                        active
                          ? "border-slate-950 bg-white font-semibold text-slate-950"
                          : "border-transparent bg-slate-50 text-slate-500 hover:bg-white hover:text-slate-800"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => activateWikiTab(tab)}
                        className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-left"
                        aria-current={active ? "page" : undefined}
                      >
                        {tab.kind === "source" ? (
                          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                        <span className="min-w-0 truncate">{tab.title}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`关闭 ${tab.title}`}
                        onClick={() => closeWikiTab(tab.id)}
                        className="mr-2 rounded p-0.5 text-slate-400 opacity-70 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100 focus:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-8 py-10">
          {!selectedWorkspace ? (
            <div className="flex w-full max-w-md flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-300">
                <Network className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-semibold">新增知识库</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">系统工作区不会默认进入知识库，请手动选择要生成 Repo Wiki 的项目目录。</p>
              <button
                type="button"
                onClick={addWorkspace}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <FolderPlus className="h-4 w-4" />
                新增知识库
              </button>
            </div>
          ) : (
            <div className={`flex w-full flex-col ${showingDocumentPreview || showingSourcePreview ? "max-w-5xl" : "max-w-2xl items-center"}`}>
              {showingSourcePreview ? (
                <SourceFileView preview={activeSourcePreview} />
              ) : showingDocumentPreview ? (
                previewDocument ? (
                  <WikiDocumentView document={previewDocument} generation={generation} onOpenSourceFile={openSourceTab} />
                ) : (
                  <WikiPreviewPlaceholder title={selectedPreviewTitle} />
                )
              ) : (
                <>
                  {generation.status !== "completed" ? (
                    <>
                      <div className="grid h-36 w-36 grid-cols-3 grid-rows-3 gap-2 opacity-45">
                      {Array.from({ length: 9 }).map((_, index) => (
                        <div key={index} className={`rounded border border-dashed border-slate-200 ${index === 4 ? "flex items-center justify-center border-solid bg-white shadow-sm" : ""}`}>
                          {index === 4 ? <Network className="h-7 w-7 text-slate-300" /> : null}
                        </div>
                      ))}
                    </div>

                    <h2 className="mt-3 text-2xl font-semibold">{hasStarted ? workspaceName : "生成你的 Repo Wiki"}</h2>
                  </>
                ) : (
                  <h2 className="text-2xl font-semibold">{workspaceName}</h2>
                )}

                <div className="mt-8 w-full">
                  {hasStarted ? (
                    <ProgressBlock state={generation} />
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                      <div className="grid gap-0 divide-y divide-slate-100">
                        <div className="flex items-center justify-between py-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-700">自动更新</div>
                            <div className="mt-1 text-sm text-slate-400">
                              {selectedGitState?.loading
                                ? "正在读取 Git 信息..."
                                : gitReady
                                  ? `绑定 ${selectedGitState?.branch || "HEAD"} · ${selectedGitState?.commitShortHash}${selectedGitState?.changedCount ? `，未提交改动 ${selectedGitState.changedCount}` : ""}`
                                  : selectedGitState?.error || "当前目录没有 Git 信息，不支持自动更新。"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={toggleAutoUpdate}
                            disabled={!gitReady}
                            aria-label="自动更新"
                          >
                            <Toggle checked={gitReady && autoUpdateEnabled} disabled={!gitReady} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between py-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-700">自动导出</div>
                            <div className="mt-1 text-sm text-slate-400">开启后，生成的 RepoWiki 将自动导出到项目的 .tech/repowiki 目录下。</div>
                          </div>
                          <Toggle checked />
                        </div>
                        <div className="flex items-center justify-between py-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-700">引用</div>
                            <div className="mt-1 text-sm text-slate-400">开启后，可被 Agent 引用。</div>
                          </div>
                          <Toggle checked={embeddingReady} disabled={!embeddingReady} />
                        </div>
                      </div>
                    </div>
                  )}

              {!embeddingReady && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-700">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    向量模型未配置
                  </div>
                  <div className="mt-1 text-sm leading-6">
                    知识库功能需要配置 embeddingModel；否则生成后不能启用 Agent 引用和向量检索。
                  </div>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {generation.status === "idle" ? (
                  <button
                    type="button"
                    onClick={() => startGeneration()}
                    disabled={!canStartGeneration || !embeddingReady}
                    className="sm:col-span-2 rounded-lg bg-slate-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    生成
                  </button>
                ) : generation.status === "generating" ? (
                  <>
                    <button type="button" onClick={pauseGeneration} className="rounded-lg bg-slate-950 px-4 py-3 text-base font-semibold text-white">
                      暂停
                    </button>
                    <button type="button" onClick={cancelGeneration} className="rounded-lg bg-slate-100 px-4 py-3 text-base font-semibold text-slate-900">
                      取消
                    </button>
                  </>
                ) : generation.status === "paused" ? (
                  <>
                    <button
                      type="button"
                      onClick={generation.failed > 0 ? () => startGeneration() : continueGeneration}
                      disabled={generation.failed > 0 && (!canStartGeneration || !embeddingReady)}
                      className="rounded-lg bg-slate-950 px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {generation.failed > 0 ? "重新生成" : "继续"}
                    </button>
                    <button type="button" onClick={cancelGeneration} className="rounded-lg bg-slate-100 px-4 py-3 text-base font-semibold text-slate-900">
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => startGeneration()}
                    disabled={!canStartGeneration || !embeddingReady}
                    className="sm:col-span-2 rounded-lg bg-slate-950 px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {selectedNeedsUpdate ? "更新" : "重新生成"}
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => onOpenSettings?.("profiles")}
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
              >
                  <Settings2 className="h-4 w-4" />
                  配置向量模型：{modelState.embeddingModel || "未配置"}
                  {modelState.wikiModel ? ` · Wiki: ${modelState.wikiModel}` : ""}
                </button>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </main>
    </section>
  );
}
