import { toast } from "sonner";

const KNOWLEDGE_AUTO_UPDATE_STORAGE_KEY = "tech-cc-hub:knowledge-panel-auto-update";

type KnowledgeGenerationStatus = "idle" | "generating" | "paused" | "completed";

type KnowledgeGenerationState = {
  status?: KnowledgeGenerationStatus;
};

type KnowledgeWorkspaceRecord = {
  key?: string;
  cwd?: string;
};

type KnowledgeListResponse = {
  workspaces?: KnowledgeWorkspaceRecord[];
  generations?: Record<string, KnowledgeGenerationState | undefined>;
};

type KnowledgeRunGenerationResponse = {
  success?: boolean;
  error?: string;
};

function normalizeWorkspaceKey(cwd?: string | null): string {
  return cwd?.trim() ?? "";
}

function readAutoUpdateEnabled(workspaceKey: string): boolean {
  try {
    const raw = window.localStorage.getItem(KNOWLEDGE_AUTO_UPDATE_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[workspaceKey];
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
}

function findKnowledgeWorkspace(result: KnowledgeListResponse, cwd: string): KnowledgeWorkspaceRecord | undefined {
  const workspaceKey = normalizeWorkspaceKey(cwd);
  return result.workspaces?.find((workspace) => {
    const key = normalizeWorkspaceKey(workspace.key);
    const workspaceCwd = normalizeWorkspaceKey(workspace.cwd);
    return key === workspaceKey || workspaceCwd === workspaceKey;
  });
}

function isKnowledgeEnabled(generation?: KnowledgeGenerationState): boolean {
  return Boolean(generation?.status && generation.status !== "idle");
}

function isAlreadyGenerating(error: string): boolean {
  return /已有.*Repo Wiki.*生成任务|already.*running/i.test(error);
}

export async function triggerKnowledgeRefreshAfterCommit(cwd?: string): Promise<void> {
  const workspaceKey = normalizeWorkspaceKey(cwd);
  if (!workspaceKey) return;

  let list: KnowledgeListResponse;
  try {
    list = await window.electron.invoke<KnowledgeListResponse>("knowledge:list");
  } catch {
    return;
  }

  const workspace = findKnowledgeWorkspace(list, workspaceKey);
  const knowledgeWorkspaceKey = normalizeWorkspaceKey(workspace?.key ?? workspace?.cwd);
  if (!knowledgeWorkspaceKey || !readAutoUpdateEnabled(knowledgeWorkspaceKey)) return;

  const generation = list.generations?.[knowledgeWorkspaceKey];
  if (!isKnowledgeEnabled(generation) || generation?.status === "generating") return;

  toast.info("Git 提交完成，正在更新知识库。");
  try {
    const result = await window.electron.invoke<KnowledgeRunGenerationResponse>("knowledge:run-generation", {
      workspaceKey: knowledgeWorkspaceKey,
      state: {
        status: "generating",
        completed: 0,
        total: 1,
        processing: 1,
        failed: 0,
        phase: "Git 提交后自动更新",
      },
    });
    if (result?.success) {
      toast.success("知识库已按最新提交更新。");
      return;
    }
    const error = result?.error ?? "知识库自动更新失败。";
    if (!isAlreadyGenerating(error)) {
      toast.error("知识库自动更新失败。", { description: error });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isAlreadyGenerating(message)) {
      toast.error("知识库自动更新失败。", { description: message });
    }
  }
}
