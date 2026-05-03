import { useCallback, useEffect, useMemo, useState } from "react";
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

const UPDATE_STATE_META: Record<AppUpdateState, { label: string; tone: string }> = {
  idle: { label: "待检查", tone: "border-ink-900/10 bg-white text-ink-700" },
  disabled: { label: "未启用", tone: "border-amber-500/20 bg-amber-50 text-amber-800" },
  checking: { label: "检查中", tone: "border-blue-500/20 bg-blue-50 text-blue-700" },
  available: { label: "发现新版", tone: "border-accent/20 bg-accent/8 text-accent" },
  "not-available": { label: "已是最新", tone: "border-emerald-500/20 bg-emerald-50 text-emerald-700" },
  downloading: { label: "下载中", tone: "border-blue-500/20 bg-blue-50 text-blue-700" },
  downloaded: { label: "待安装", tone: "border-emerald-500/20 bg-emerald-50 text-emerald-700" },
  error: { label: "检查失败", tone: "border-red-500/20 bg-red-50 text-red-700" },
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

const ABOUT_LINKS = [
  { id: "docs", label: "帮助文档", url: "https://github.com/anthropics/tech-cc-hub?tab=readme-ov-file#readme" },
  { id: "changelog", label: "更新日志", url: "https://github.com/anthropics/tech-cc-hub/releases" },
  { id: "feedback", label: "意见反馈", url: "https://github.com/anthropics/tech-cc-hub/issues/new" },
  { id: "issues", label: "问题报告", url: "https://github.com/anthropics/tech-cc-hub/issues" },
  { id: "website", label: "官网", url: "https://code.claude.com" },
];

type AboutPageProps = {
  onStartMaintenanceSession: (prompt: string) => Promise<void>;
  onClose: () => void;
};

export function AboutPage({ onStartMaintenanceSession, onClose }: AboutPageProps) {
  const [updateStatus, setUpdateStatus] = useState<AppUpdateStatus | null>(null);
  const [updateBusy, setUpdateBusy] = useState<"checking" | "downloading" | "installing" | null>(null);
  const [maintenancePrompt, setMaintenancePrompt] = useState(
    "请对当前软件执行一次系统维护巡检，重点检查三层 agent 解析、运行面隔离和 skills 治理入口，并输出结论与建议。",
  );
  const [launching, setLaunching] = useState(false);
  const [status, setStatus] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    void window.electron.getAppUpdateStatus().then((status) => {
      if (mounted) setUpdateStatus(status);
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

  const handleLaunchMaintenance = useCallback(() => {
    void (async () => {
      if (!maintenancePrompt.trim()) {
        setStatus({ tone: "error", message: "请先填写维护指令。" });
        return;
      }
      setLaunching(true);
      setStatus(null);
      try {
        await onStartMaintenanceSession(maintenancePrompt.trim());
        onClose();
      } catch (error) {
        console.error("Failed to launch maintenance session:", error);
        setStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "启动维护会话失败。",
        });
      } finally {
        setLaunching(false);
      }
    })();
  }, [maintenancePrompt, onClose, onStartMaintenanceSession]);

  const canCheck = updateBusy === null && updateStatus?.status !== "downloading";
  const canDownload = updateBusy === null && updateStatus?.status === "available";
  const canInstall = updateBusy === null && updateStatus?.status === "downloaded";
  const downloadPercent = updateStatus?.progress?.percent ?? 0;

  return (
    <section className="grid gap-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#111318] text-xl font-black text-white shadow-[0_14px_30px_rgba(17,19,24,0.16)]">
          T
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink-900">tech-cc-hub</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-[#6B778C]">
          Free, local, open-source desktop app for Claude Code — built with Electron, React, and Claude Agent SDK.
        </p>
      </div>

      {/* Version + Update Card */}
      <div className="rounded-[24px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink-900">
              v{updateStatus?.currentVersion ?? "..."}
            </span>
            <a
              href="https://github.com/anthropics/tech-cc-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-ink-700"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${updateMeta.tone}`}>
            {updateMeta.label}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-xl bg-[#1D2129] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2B303B] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => { void handleUpdateAction("check"); }}
            disabled={!canCheck}
          >
            {updateBusy === "checking" ? "检查中..." : "检查更新"}
          </button>
          {canDownload && (
            <button
              type="button"
              className="rounded-xl border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              onClick={() => { void handleUpdateAction("download"); }}
            >
              下载更新
            </button>
          )}
          {canInstall && (
            <button
              type="button"
              className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              onClick={() => { void handleUpdateAction("install"); }}
            >
              重启安装
            </button>
          )}
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

        <div className="mt-4 flex items-center justify-between border-t border-ink-900/10 pt-4">
          <span className="text-sm text-ink-700">包含预发布/dev 版本</span>
          <div className="h-6 w-11 rounded-full border border-ink-900/15 bg-ink-900/10 p-0.5">
            <div className="h-4 w-4 rounded-full bg-white shadow-sm" />
          </div>
        </div>
      </div>

      {/* System Maintenance */}
      <div className="rounded-[24px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="text-xs font-medium text-muted">系统维护</div>
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
              onClick={() => {
                setStatus(null);
                setMaintenancePrompt(task.prompt);
              }}
            >
              {task.label}
            </button>
          ))}
        </div>

        <label className="mt-4 grid gap-2">
          <span className="text-sm font-medium text-ink-900">维护指令</span>
          <textarea
            className="min-h-[120px] rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 text-sm leading-6 text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            placeholder="例如：请检查当前软件里的三层 agent 解析器、skills 同步入口和维护面工具边界。"
            value={maintenancePrompt}
            onChange={(event) => {
              setStatus(null);
              setMaintenancePrompt(event.target.value);
            }}
          />
        </label>

        {status && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs ${status.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
            {status.message}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs leading-5 text-muted">
            启动后会新建一个独立维护会话，并切回主界面查看执行过程。
          </div>
          <button
            type="button"
            className="rounded-xl border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleLaunchMaintenance}
            disabled={launching || !maintenancePrompt.trim()}
          >
            {launching ? "启动中..." : "启动维护会话"}
          </button>
        </div>
      </div>

      {/* Links */}
      <div className="rounded-[24px] border border-ink-900/10 bg-white/86 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        {ABOUT_LINKS.map((link, index) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between px-5 py-4 text-sm text-ink-700 transition-colors hover:bg-surface ${
              index !== 0 ? "border-t border-ink-900/10" : ""
            } ${index === 0 ? "rounded-t-[24px]" : ""} ${index === ABOUT_LINKS.length - 1 ? "rounded-b-[24px]" : ""}`}
          >
            <span>{link.label}</span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </a>
        ))}
      </div>
    </section>
  );
}
