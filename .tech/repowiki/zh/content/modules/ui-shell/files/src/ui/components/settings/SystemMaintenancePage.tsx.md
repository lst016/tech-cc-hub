# src/ui/components/settings/SystemMaintenancePage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：273

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `formatBytes@69`
- `SystemMaintenancePage@88`
- `PRESET_TASKS@3`
- `units@72`
- `next@73`
- `unitIndex@74`
- `mounted@99`
- `unsubscribe@105`
- `updateMeta@116`
- `handleUpdateAction@120`
- `busyState@122`
- `canCheckUpdate@137`
- `canDownloadUpdate@139`
- `canInstallUpdate@140`
- `downloadPercent@141`
- `SystemMaintenancePageProps@81`
- `onPromptChange@85`
- `onLaunch@86`

## 依赖输入

- `react`
- `../../types`

## 对外暴露

- `SystemMaintenancePage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
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
  unsupported: {
    label: "暂无安装包",
    tone: "border-amber-500/20 bg-amber-50 text-amber-800",
    description: "已发现新版本，但当前平台缺少自动更新元数据，请到 GitHub Releases 手动查看。",
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
  const canDownloadUpdate = updateBusy === null
... (truncated)
```
