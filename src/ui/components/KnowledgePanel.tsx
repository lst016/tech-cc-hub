import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  ChevronDown,
  FolderPlus,
  GitBranch,
  Lightbulb,
  MoreVertical,
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

type KnowledgePanelProps = {
  onBack: () => void;
  onOpenSettings?: (pageId?: SettingsPageId) => void;
};

type GenerationStatus = "idle" | "generating" | "paused" | "completed";

type GenerationState = {
  status: GenerationStatus;
  completed: number;
  total: number;
  processing: number;
  failed: number;
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

type KnowledgeDocument = {
  id: string;
  workspaceKey: string;
  section: string;
  title: string;
  content: string;
  sortOrder: number;
  updatedAt: number;
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
};

type KnowledgeWorkspaceRecord = NonNullable<KnowledgeListResponse["workspaces"]>[number];

type KnowledgeDocumentsResponse = {
  documents?: KnowledgeDocument[];
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
const KNOWLEDGE_GENERATION_STORAGE_KEY = "tech-cc-hub:knowledge-panel-generation";
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

function getWorkspaceParentPath(cwd?: string): string {
  if (!cwd) return "";
  const parts = cwd.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 1) return cwd;
  return parts.slice(0, -1).join("/");
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
  const total = Number.isFinite(raw.total) && raw.total && raw.total > 0 ? Math.floor(raw.total) : 183;
  const failed = Number.isFinite(raw.failed) && raw.failed && raw.failed > 0 ? Math.floor(raw.failed) : 0;
  const updatedAt = Number.isFinite(raw.updatedAt) && raw.updatedAt && raw.updatedAt > 0 ? raw.updatedAt : Date.now();
  let completed = Number.isFinite(raw.completed) && raw.completed && raw.completed > 0 ? Math.floor(raw.completed) : 0;
  let status = raw.status;

  if (status === "generating") {
    const elapsedSteps = Math.max(0, Math.floor((Date.now() - updatedAt) / 900));
    completed = Math.min(total, completed + elapsedSteps * 3);
    status = completed >= total ? "completed" : "generating";
  }

  return {
    status,
    completed: Math.min(total, Math.max(0, completed)),
    total,
    processing: status === "generating" ? 1 : 0,
    failed,
    commitId: typeof raw.commitId === "string" ? raw.commitId : undefined,
    commitShortHash: typeof raw.commitShortHash === "string" ? raw.commitShortHash : undefined,
    branch: typeof raw.branch === "string" ? raw.branch : null,
    updatedAt: Date.now(),
  };
}

function readStoredGenerationByWorkspace(): Record<string, GenerationState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_GENERATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const next: Record<string, GenerationState> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const workspaceKey = normalizeWorkspaceKey(key);
      const generation = normalizeGenerationState(value);
      if (workspaceKey && generation && generation.status !== "idle") {
        next[workspaceKey] = generation;
      }
    }
    return next;
  } catch {
    return {};
  }
}

function createIdleGeneration(): GenerationState {
  return {
    status: "idle",
    completed: 0,
    total: 183,
    processing: 0,
    failed: 0,
    updatedAt: Date.now(),
  };
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

function Toggle({ checked, disabled = false }: { checked: boolean; disabled?: boolean }) {
  return (
    <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-200"} ${disabled ? "opacity-45" : ""}`}>
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </span>
  );
}

function ProgressBlock({ state }: { state: GenerationState }) {
  const percent = Math.min(100, Math.round((state.completed / state.total) * 1000) / 10);
  const statusLabel = state.status === "paused"
    ? "已暂停"
    : state.status === "completed"
      ? "已完成"
      : "正在生成中";
  const progressPrefix = state.status === "paused"
    ? "已暂停"
    : state.status === "completed"
      ? "生成完成"
      : "正在生成中";

  return (
    <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <PauseCircle className={`h-4 w-4 ${state.status === "completed" ? "text-emerald-600" : "text-amber-500"}`} />
        <div className="text-sm font-semibold text-slate-800">{statusLabel}</div>
      </div>
      <div className="mt-3 text-sm leading-6 text-slate-700">
        {progressPrefix}，已完成 {state.completed}/{state.total} ({percent}%)，处理中: {state.processing}，失败: {state.failed}
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-500 transition-all duration-300" style={{ width: `${percent}%` }} />
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
}: {
  active: boolean;
  documents: KnowledgeDocument[];
  selectedDocumentId: string;
  onSelectDocument: (documentId: string) => void;
}) {
  if (!active || documents.length === 0) {
    return null;
  }

  const sections = Array.from(
    documents
      .reduce((groups, document) => {
        const section = document.section || "生成文档";
        groups.set(section, [...(groups.get(section) ?? []), document]);
        return groups;
      }, new Map<string, KnowledgeDocument[]>())
      .entries(),
  );

  return (
    <div className="mt-3 space-y-2">
      {sections.map(([sectionTitle, sectionDocuments]) => (
        <div key={sectionTitle}>
          <div className="flex items-center gap-2 px-2 py-1 text-sm font-semibold text-slate-600">
            <ChevronDown className="h-4 w-4" />
            <span>{sectionTitle}</span>
          </div>
          <div className="ml-7 mt-1 space-y-1">
            {sectionDocuments.map((document) => (
              <button
                type="button"
                key={document.id}
                onClick={() => onSelectDocument(document.id)}
                className={`block w-full truncate rounded-lg px-2 py-1 text-left text-sm transition ${
                  selectedDocumentId === document.id
                    ? "bg-slate-100 font-semibold text-slate-900"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {document.title}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WikiDocumentView({ document, generation }: { document: KnowledgeDocument; generation: GenerationState }) {
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
      <pre className="mt-5 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-700">{document.content}</pre>
      <div className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
        {generation.branch ? `${generation.branch} · ` : ""}
        {generation.commitShortHash || generation.commitId?.slice(0, 7) || "未绑定 Commit"}
      </div>
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
  const persistedGenerationSignatureRef = useRef<Record<string, string>>({});
  const completedDocumentSeedRef = useRef<Set<string>>(new Set());
  const backendGenerationInFlightRef = useRef<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"repo" | "memory">("repo");
  const [selectedWorkspaceKey, setSelectedWorkspaceKey] = useState<string>("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [systemWorkspace, setSystemWorkspace] = useState<string>("");
  const [manualWorkspacePaths, setManualWorkspacePaths] = useState<string[]>(() => readStoredWorkspacePaths());
  const [hiddenWorkspaceKeys, setHiddenWorkspaceKeys] = useState<Set<string>>(() => readStoredWorkspaceKeySet(KNOWLEDGE_HIDDEN_WORKSPACES_STORAGE_KEY));
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [knowledgeStateReady, setKnowledgeStateReady] = useState(false);
  const [storedWorkspaces, setStoredWorkspaces] = useState<KnowledgeWorkspace[]>([]);
  const [documentsByWorkspace, setDocumentsByWorkspace] = useState<Record<string, KnowledgeDocument[]>>({});
  const [generationByWorkspace, setGenerationByWorkspace] = useState<Record<string, GenerationState>>(() => readStoredGenerationByWorkspace());
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
  const selectedDocument = selectedDocuments.find((document) => document.id === selectedDocumentId)
    ?? (selectedDocumentId ? undefined : selectedDocuments[0]);
  const previewDocument = selectedDocument;
  const selectedPreviewTitle = selectedDocument?.title;
  const selectedGitState = selectedWorkspace ? gitByWorkspace[selectedWorkspace.key] : undefined;
  const gitReady = Boolean(selectedGitState?.hasGit && selectedGitState.commitId);
  const canStartGeneration = Boolean(selectedWorkspace);
  const autoUpdateEnabled = selectedWorkspace
    ? autoUpdateByWorkspace[selectedWorkspace.key] ?? gitReady
    : false;
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
    setStoredWorkspaces(nextWorkspaces);
    setHiddenWorkspaceKeys(new Set());
    setGenerationByWorkspace(nextGenerations);
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
    try {
      const activeGenerations = Object.fromEntries(
        Object.entries(generationByWorkspace).filter(([, state]) => state.status !== "idle"),
      );
      if (Object.keys(activeGenerations).length === 0) {
        window.localStorage.removeItem(KNOWLEDGE_GENERATION_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(KNOWLEDGE_GENERATION_STORAGE_KEY, JSON.stringify(activeGenerations));
    } catch {
      // Ignore storage failures; the current UI state still remains usable.
    }
  }, [generationByWorkspace]);

  useEffect(() => {
    if (!knowledgeStateReady) return;
    for (const [workspaceKey, state] of Object.entries(generationByWorkspace)) {
      const signature = JSON.stringify({
        status: state.status,
        completed: state.completed,
        total: state.total,
        processing: state.processing,
        failed: state.failed,
        commitId: state.commitId ?? "",
        branch: state.branch ?? "",
      });
      if (persistedGenerationSignatureRef.current[workspaceKey] === signature) continue;
      persistedGenerationSignatureRef.current[workspaceKey] = signature;

      if (state.status === "completed") {
        void invokeKnowledge<{ documents?: unknown[] }>("knowledge:complete-generation", { workspaceKey, state })
          .then((result) => {
            const documents = (result.documents ?? [])
              .map(normalizeKnowledgeDocument)
              .filter((document): document is KnowledgeDocument => Boolean(document));
            setDocumentsByWorkspace((current) => ({ ...current, [workspaceKey]: documents }));
            completedDocumentSeedRef.current.add(workspaceKey);
          })
          .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "写入 Repo Wiki 文档失败。"));
        continue;
      }

      void invokeKnowledge("knowledge:update-generation", { workspaceKey, state })
        .catch((error) => setWorkspaceError(error instanceof Error ? error.message : "写入生成状态失败。"));
    }
  }, [generationByWorkspace, knowledgeStateReady]);

  useEffect(() => {
    if (!selectedWorkspace || generation.status !== "completed") {
      if (!selectedWorkspace) setSelectedDocumentId("");
      return;
    }
    const workspaceKey = selectedWorkspace.key;
    if ((documentsByWorkspace[workspaceKey]?.length ?? 0) > 0 && completedDocumentSeedRef.current.has(workspaceKey)) return;

    let disposed = false;
    invokeKnowledge<KnowledgeDocumentsResponse>("knowledge:list-documents", { workspaceKey })
      .then((result) => {
        if (disposed) return;
        const documents = (result.documents ?? [])
          .map(normalizeKnowledgeDocument)
          .filter((document): document is KnowledgeDocument => Boolean(document));
        setDocumentsByWorkspace((current) => ({ ...current, [workspaceKey]: documents }));
        if (documents.length > 0) {
          completedDocumentSeedRef.current.add(workspaceKey);
          setSelectedDocumentId((current) => documents.some((document) => document.id === current) ? current : documents[0]!.id);
        }
      })
      .catch((error) => {
        if (!disposed) setWorkspaceError(error instanceof Error ? error.message : "读取 Repo Wiki 文档失败。");
      });
    return () => {
      disposed = true;
    };
  }, [documentsByWorkspace, generation.status, selectedWorkspace]);

  useEffect(() => {
    if (!selectedWorkspace) {
      if (selectedDocumentId) setSelectedDocumentId("");
      return;
    }
    if (generation.status !== "completed") {
      if (selectedDocumentId) setSelectedDocumentId("");
      return;
    }
    if (selectedDocuments.length > 0 && !selectedDocuments.some((document) => document.id === selectedDocumentId)) {
      setSelectedDocumentId(selectedDocuments[0]!.id);
    }
  }, [generation.status, selectedDocumentId, selectedDocuments, selectedWorkspace]);

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
          total: currentGeneration.total || 183,
          processing: 1,
          failed: 0,
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
    const timer = window.setInterval(() => {
      setGenerationByWorkspace((currentByWorkspace) => {
        let changed = false;
        const nextByWorkspace: Record<string, GenerationState> = {};
        for (const [workspaceKey, current] of Object.entries(currentByWorkspace)) {
          if (current.status !== "generating") {
            nextByWorkspace[workspaceKey] = current;
            continue;
          }
          const hasBackendTask = backendGenerationInFlightRef.current.has(workspaceKey);
          const nextCompleted = hasBackendTask
            ? Math.min(Math.max(0, current.total - 1), current.completed + 3)
            : Math.min(current.total, current.completed + 3);
          nextByWorkspace[workspaceKey] = {
            ...current,
            completed: nextCompleted,
            processing: hasBackendTask || nextCompleted < current.total ? 1 : 0,
            status: hasBackendTask || nextCompleted < current.total ? "generating" : "completed",
            updatedAt: Date.now(),
          };
          changed = true;
        }
        return changed ? nextByWorkspace : currentByWorkspace;
      });
    }, 900);

    return () => window.clearInterval(timer);
  }, []);

  const startGeneration = () => {
    if (!selectedWorkspace) return;
    if (!embeddingReady) {
      setWorkspaceError("请先配置向量模型 embeddingModel，否则知识库不能生成和索引。");
      return;
    }
    const git = gitByWorkspace[selectedWorkspace.key];
    const workspaceKey = selectedWorkspace.key;
    completedDocumentSeedRef.current.delete(selectedWorkspace.key);
    backendGenerationInFlightRef.current.add(workspaceKey);
    setSelectedDocumentId("");
    setDocumentsByWorkspace((current) => {
      const next = { ...current };
      delete next[workspaceKey];
      return next;
    });
    const startedState = applyGitBinding({
      status: "generating",
      completed: 0,
      total: 183,
      processing: 1,
      failed: 0,
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
        setDocumentsByWorkspace((current) => ({
          ...current,
          [workspaceKey]: documents,
        }));
        if (documents.length > 0) {
          setSelectedDocumentId(documents[0]!.id);
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
    setGenerationByWorkspace((current) => ({
      ...current,
      [selectedWorkspace.key]: {
        ...(current[selectedWorkspace.key] ?? createIdleGeneration()),
        status: "paused",
        processing: 0,
        updatedAt: Date.now(),
      },
    }));
  };

  const toggleAutoUpdate = () => {
    if (!selectedWorkspace || !gitReady) return;
    setAutoUpdateByWorkspace((current) => ({
      ...current,
      [selectedWorkspace.key]: !(current[selectedWorkspace.key] ?? true),
    }));
  };

  const continueGeneration = () => {
    if (!selectedWorkspace) return;
    setGenerationByWorkspace((current) => ({
      ...current,
      [selectedWorkspace.key]: {
        ...(current[selectedWorkspace.key] ?? createIdleGeneration()),
        status: "generating",
        processing: 1,
        updatedAt: Date.now(),
      },
    }));
  };

  const cancelGeneration = () => {
    if (!selectedWorkspace) return;
    setGenerationByWorkspace((current) => ({
      ...current,
      [selectedWorkspace.key]: createIdleGeneration(),
    }));
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
      setWorkspaceError(error instanceof Error ? error.message : "新增工作区失败。");
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
    setDocumentsByWorkspace((current) => {
      const next = { ...current };
      delete next[workspace.key];
      return next;
    });
    if (selectedWorkspaceKey === workspace.key) {
      setSelectedWorkspaceKey("");
    }
  };

  return (
    <section className="flex h-full min-h-0 bg-white text-slate-900">
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-base font-semibold">知识</div>
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
              onClick={() => setActiveTab("memory")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeTab === "memory" ? "bg-slate-100 text-slate-950 shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}
            >
              记忆
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder={activeTab === "repo" ? "搜索 Repo Wiki" : "搜索记忆"}
              />
            </div>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" type="button" aria-label="筛选">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={addWorkspace}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <FolderPlus className="h-4 w-4" />
            新增工作区
          </button>
          {workspaceError && (
            <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              {workspaceError}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {workspaces.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
              <Network className="mx-auto h-7 w-7 text-slate-300" />
              <div className="mt-3 text-sm font-semibold text-slate-700">暂无项目工作区</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">新增后再生成 Repo Wiki。</div>
              <button
                type="button"
                onClick={addWorkspace}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <FolderPlus className="h-4 w-4" />
                新增
              </button>
            </div>
          ) : (
            <div className="space-y-2">
            {workspaces.map((workspace) => {
              const workspaceGeneration = generationByWorkspace[workspace.key] ?? createIdleGeneration();
              const workspaceGit = gitByWorkspace[workspace.key];
              const selected = workspace.key === selectedWorkspace?.key;
              const needsUpdate = Boolean(
                workspaceGit?.hasGit &&
                workspaceGit.commitId &&
                workspaceGeneration.commitId &&
                workspaceGeneration.commitId !== workspaceGit.commitId,
              );
              const statusLabel = workspaceGeneration.status === "idle"
                ? "去生成"
                : needsUpdate
                  ? "需更新"
                : workspaceGeneration.status === "generating"
                  ? "生成中"
                  : workspaceGeneration.status === "paused"
                    ? "已暂停"
                    : "已完成";
              return (
                <div key={workspace.key}>
                  <div className={`group flex items-center rounded-lg transition-colors ${selected ? "bg-slate-100" : "hover:bg-slate-50"}`}>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between px-3 py-2 text-left"
                      onClick={() => setSelectedWorkspaceKey(workspace.key)}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                          <Network className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{workspace.name}</span>
                          <span className="block truncate text-xs text-slate-400">
                            {getWorkspaceParentPath(workspace.cwd) || (workspace.source === "manual" ? "手动添加" : "项目工作区")}
                          </span>
                        </span>
                      </div>
                      <span className="ml-3 shrink-0 text-xs font-semibold text-slate-500">{statusLabel}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`删除 ${workspace.name}`}
                      onClick={() => removeWorkspace(workspace)}
                      className="mr-2 rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-white hover:text-rose-600 group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {activeTab === "repo" && selected && workspaceGeneration.status !== "idle" && (
                    <SectionTree
                      active={workspaceGeneration.status === "completed"}
                      documents={documentsByWorkspace[workspace.key] ?? []}
                      selectedDocumentId={selectedDocumentId}
                      onSelectDocument={setSelectedDocumentId}
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
            <div className="flex items-center gap-2">
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" type="button" onClick={onBack} aria-label="返回聊天">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-12 items-center border-b-2 border-slate-950 px-3 text-sm font-semibold">
                <BookOpen className="mr-2 h-4 w-4 text-slate-500" />
                {workspaceName}
                <button className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-100" type="button" aria-label="关闭">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" type="button" aria-label="更多">
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-5 py-3">
            <h1 className="text-lg font-semibold">{workspaceName}</h1>
            {selectedWorkspace?.cwd && (
              <>
                <GitBranch className="h-4 w-4 text-slate-400" />
                <span className="truncate font-mono text-sm text-slate-500">{selectedWorkspace.cwd}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 bg-sky-50 px-5 py-2 text-sm font-medium text-sky-600">
            <Lightbulb className="h-4 w-4" />
            Repo Wiki（为您准备）和知识卡片（为 Agent 准备）将基于您的代码库一起生成和更新。
            <button className="ml-auto rounded p-1 text-sky-500 hover:bg-sky-100" type="button" aria-label="关闭提示">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-8 py-10">
          {!selectedWorkspace ? (
            <div className="flex w-full max-w-md flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-slate-300">
                <Network className="h-7 w-7" />
              </div>
                    <h2 className="mt-5 text-2xl font-semibold">新增项目工作区</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">系统工作区不会默认进入知识库，请手动选择要生成 Repo Wiki 的项目目录。</p>
              <button
                type="button"
                onClick={addWorkspace}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <FolderPlus className="h-4 w-4" />
                新增工作区
              </button>
            </div>
          ) : (
          <div className={`flex w-full flex-col ${generation.status === "completed" ? "max-w-4xl" : "max-w-2xl items-center"}`}>
            {generation.status !== "completed" && (
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
            )}

            <div className="mt-8 w-full">
              {hasStarted ? (
                generation.status === "completed" && previewDocument ? (
                  <WikiDocumentView document={previewDocument} generation={generation} />
                ) : generation.status === "completed" ? (
                  <WikiPreviewPlaceholder title={selectedPreviewTitle} />
                ) : (
                  <ProgressBlock state={generation} />
                )
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
                    onClick={startGeneration}
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
                    <button type="button" onClick={continueGeneration} className="rounded-lg bg-slate-950 px-4 py-3 text-base font-semibold text-white">
                      继续
                    </button>
                    <button type="button" onClick={cancelGeneration} className="rounded-lg bg-slate-100 px-4 py-3 text-base font-semibold text-slate-900">
                      取消
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={startGeneration}
                    disabled={!canStartGeneration || !embeddingReady}
                    className="sm:col-span-2 rounded-lg bg-slate-950 px-4 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    重新生成
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
          </div>
          )}
        </div>
      </main>
    </section>
  );
}
