import { toast } from "sonner";

const KNOWLEDGE_AUTO_UPDATE_STORAGE_KEY = "tech-cc-hub:knowledge-panel-auto-update";

type CodeGraphSyncResponse = {
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

function isAlreadyGenerating(error: string): boolean {
  return /已有.*CodeGraph.*同步任务|already.*running|indexing/i.test(error);
}

export async function triggerKnowledgeRefreshAfterCommit(cwd?: string): Promise<void> {
  const workspaceKey = normalizeWorkspaceKey(cwd);
  if (!workspaceKey) return;
  if (!readAutoUpdateEnabled(workspaceKey)) return;

  toast.info("Git 提交完成，正在同步 CodeGraph。");
  try {
    const result = await window.electron.invoke<CodeGraphSyncResponse>("codegraph:sync", {
      workspaceRoot: workspaceKey,
      mode: "sync",
    });
    if (result?.success) {
      toast.success("CodeGraph 已按最新提交同步。");
      return;
    }
    const error = result?.error ?? "CodeGraph 自动同步失败。";
    if (!isAlreadyGenerating(error)) {
      toast.error("CodeGraph 自动同步失败。", { description: error });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isAlreadyGenerating(message)) {
      toast.error("CodeGraph 自动同步失败。", { description: message });
    }
  }
}
