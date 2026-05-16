# src/ui/components/settings/AboutPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：314

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `formatBytes@33`
- `AboutPage@58`
- `PRESET_TASKS@3`
- `units@36`
- `next@37`
- `unitIndex@38`
- `ABOUT_LINKS@45`
- `mounted@69`
- `unsubscribe@73`
- `updateMeta@84`
- `handleUpdateAction@88`
- `busyState@90`
- `handleLaunchMaintenance@105`
- `canCheck@128`
- `canDownload@130`
- `canInstall@131`
- `downloadPercent@132`
- `AboutPageProps@53`
- `onStartMaintenanceSession@55`
- `onClose@56`

## 依赖输入

- `react`
- `../../types`

## 对外暴露

- `AboutPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
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
  unsupported: { label: "暂无安装包", tone: "border-amber-500/20 bg-amber-50 text-amber-800" },
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
... (truncated)
```
