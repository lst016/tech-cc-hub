import { useEffect, useMemo, useState } from "react";
import type { AppUpdateActionResult, AppUpdateStatus, AppUpdateState } from "../../types";

const PRESET_TASKS = [
  {
    id: "health-check",
    label: "系统巡检",
    prompt: "请对当前软件执行一次系统维护巡检，重点检查运行时接线、内置 agent 解析、skills 索引和近期错误风险，并给出结论与建议。",
  },
  {
    id: "skills-governance",
    label: "治理 Skills",
    prompt: "请检查当前软件内的 skills 安装与同步状态，识别异常来源、失效远端、重复技能和需要修复的版本治理问题，并给出处理建议。",
  },
  {
    id: "agent-governance",
    label: "治理 Agent",
    prompt: "请检查系统级、用户级、项目级 agent 的解析结果与边界设置，识别覆盖顺序、入口文档和运行面隔离中的风险，并给出修复建议。",
  },
];

const UPDATE_STATE_META: Record<AppUpdateState, { label: string; tone: string; description: string }> = {
  idle: {
    label: "待检查",
    tone: "border-ink-900/10 bg-white text-ink-700",
    description: "可手动检查 GitHub Releases 是否有新版本。",
  },
  disabled: {
    label: "未启用",
    tone: "border-amber-500/20 bg-amber-50 text-amber-800",
    description: "开发模式或 CI 环境不会执行自动更新。",
  },
  checking: {
    label: "检查中",
    tone: "border-blue-500/20 bg-blue-50 text-blue-700",
    description: "正在连接 GitHub Releases 获取更新元数据。",
  },
  available: {
    label: "发现新版",
    tone: "border-accent/20 bg-accent/8 text-accent",
    description: "可以下载更新包，下载完成后重启安装。",
  },
  "not-available": {
    label: "已是最新",
    tone: "border-emerald-500/20 bg-emerald-50 text-emerald-700",
    description: "当前版本没有发现可用更新。",
  },
  downloading: {
    label: "下载中",
    tone: "border-blue-500/20 bg-blue-50 text-blue-700",
    description: "正在下载更新包，请保持网络连接。",
  },
  downloaded: {
    label: "待安装",
    tone: "border-emerald-500/20 bg-emerald-50 text-emerald-700",
    description: "更新已下载完成，重启应用后安装。",
  },
  error: {
    label: "检查失败",
    tone: "border-red-500/20 bg-red-50 text-red-700",
    description: "更新链路返回错误，请检查 GitHub Release 或网络。",
  },
};

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let next = value;
  let unitIndex = 0;
  while (next >= 1024 && unitIndex < units.length - 1) {
    next /= 1024;
    unitIndex += 1;
  }
  return `${next.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

type SystemMaintenancePageProps = {
  prompt: string;
  launching: boolean;
  onPromptChange: (value: string) => void;
  onLaunch: () => void;
};

export function SystemMaintenancePage({
  prompt,
  launching,
  onPromptChange,
  onLaunch,
}: SystemMaintenancePageProps) {
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [updateBusy, setUpdateBusy] = useState<"checking" | "downloading" | "installing" | null>(null);

  useEffect(() => {
    let mounted = true;
    void window.electron.getAppUpdateStatus().then((status) => {
      if (mounted) {
        setUpdateStatus(status);
      }
    });
    const unsubscribe = window.electron.onAppUpdateStatus((status) => {
      setUpdateStatus(status);
      if (status.status !== "checking" && status.status !== "downloading") {
        setUpdateBusy(null);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const updateMeta = useMemo(() => {
    return UPDATE_STATE_META[updateStatus?.status ?? "idle"];
  }, [updateStatus?.status]);

  const handleUpdateAction = async (action: "check" | "download" | "install") => {
    const busyState = action === "check" ? "checking" : action === "download" ? "downloading" : "installing";
    setUpdateBusy(busyState);
    let result: AppUpdateActionResult;
    if (action === "check") {
      result = await window.electron.checkForAppUpdates();
    } else if (action === "download") {
      result = await window.electron.downloadAppUpdate();
    } else {
      result = await window.electron.installAppUpdate();
    }
    setUpdateStatus(result.status);
    if (!result.success || action !== "install") {
      setUpdateBusy(null);
    }
  };

  const canCheckUpdate = updateBusy === null && updateStatus?.status !== "downloading";
  const canDownloadUpdate = updateBusy === null && updateStatus?.status === "available";
  const canInstallUpdate = updateBusy === null && updateStatus?.status === "downloaded";
  const downloadPercent = updateStatus?.progress?.percent ?? 0;

  return (
    <section className="grid gap-4">
      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-muted">版本更新</div>
            <h3 className="mt-1 text-base font-semibold text-ink-900">GitHub Releases 自动更新</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              使用 electron-updater 检查 GitHub Release 元数据，下载完成后通过重启安装。当前不做运行时代码热替换，避免签名和主进程状态风险。
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${updateMeta.tone}`}>
            {updateMeta.label}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-ink-900/10 bg-surface px-4 py-3">
            <div className="text-xs text-muted">当前版本</div>
            <div className="mt-1 text-sm font-semibold text-ink-900">{updateStatus?.currentVersion ?? "读取中"}</div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface px-4 py-3">
            <div className="text-xs text-muted">更新源</div>
            <div className="mt-1 text-sm font-semibold text-ink-900">GitHub Releases</div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface px-4 py-3">
            <div className="text-xs text-muted">目标版本</div>
            <div className="mt-1 text-sm font-semibold text-ink-900">{updateStatus?.version ?? "未发现"}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-ink-900/10 bg-white px-4 py-3 text-sm leading-6 text-muted">
          {updateStatus?.error || updateMeta.description}
        </div>

        {updateStatus?.status === "downloading" && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>下载进度 {downloadPercent.toFixed(1)}%</span>
              <span>
                {formatBytes(updateStatus.progress?.transferred ?? 0)} / {formatBytes(updateStatus.progress?.total ?? 0)}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min(Math.max(downloadPercent, 0), 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-ink-900/10 bg-white px-4 py-2 text-sm font-medium text-ink-800 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void handleUpdateAction("check"); }}
            disabled={!canCheckUpdate}
          >
            {updateBusy === "checking" ? "检查中..." : "检查更新"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void handleUpdateAction("download"); }}
            disabled={!canDownloadUpdate}
          >
            {updateBusy === "downloading" ? "下载中..." : "下载更新"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-ink-900/10 bg-white px-4 py-2 text-sm font-medium text-ink-800 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void handleUpdateAction("install"); }}
            disabled={!canInstallUpdate}
          >
            {updateBusy === "installing" ? "重启中..." : "重启安装"}
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="text-xs font-medium text-muted">系统维护面</div>
        <h3 className="mt-1 text-base font-semibold text-ink-900">内置维护 Agent</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          这里启动的是软件内置维护会话，只加载系统级 agent，不会自动带入用户级或项目级规则，也不会走普通开发聊天面。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESET_TASKS.map((task) => (
            <button
              key={task.id}
              type="button"
              className="rounded-full border border-ink-900/10 bg-white px-3 py-1.5 text-xs text-ink-700 transition-colors hover:bg-surface"
              onClick={() => onPromptChange(task.prompt)}
            >
              {task.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="text-xs font-medium text-muted">维护指令</div>
        <label className="mt-3 grid gap-2">
          <span className="text-sm font-medium text-ink-900">给维护 Agent 的任务</span>
          <textarea
            className="min-h-[180px] rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 text-sm leading-6 text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            placeholder="例如：请检查当前软件里的三层 agent 解析器、skills 同步入口和维护面工具边界。"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
          />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs leading-5 text-muted">
            启动后会新建一个独立维护会话，并切回主界面查看执行过程。
          </div>
          <button
            type="button"
            className="rounded-xl border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onLaunch}
            disabled={launching || !prompt.trim()}
          >
            {launching ? "启动中..." : "启动维护会话"}
          </button>
        </div>
      </div>
    </section>
  );
}
