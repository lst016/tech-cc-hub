# src/ui/components/BrowserWorkbenchPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：1056

## 文件职责

浏览器工作台页面组件，提供本地开发服务器的预览和标注功能

## 关键符号

- `probeLocalTarget@0 - 探测本地浏览器目标是否在线，支持超时控制`
- `LocalTargetPreview@0 - 本地目标预览组件，显示服务器状态`
- `isCurrentAppUrl@0 - 判断URL是否为当前应用URL`
- `isLoopbackHost@0 - 判断是否为localhost相关主机`
- `readRecentLocalBrowserTargets@0 - 从localStorage读取最近使用的本地浏览器目标`
- `rememberRecentLocalBrowserTarget@0 - 保存最近使用的本地浏览器目标到localStorage`
- `buildLocalBrowserTargets@0 - 构建本地浏览器目标列表`
- `BrowserWorkbenchPage@0 - 浏览器工作台页面主组件`

## 依赖输入

- `../dev-electron-shim`
- `../events`
- `../store/useAppStore`
- `../utils/browser-workbench-visibility`
- `../utils/workbench-url`
- `./ActivityWorkspaceTabs`
- `../utils/activity-workspace-tabs`

## 对外暴露

- `BrowserWorkbenchPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
﻿import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { DEV_BROWSER_PREVIEW_FLAG, getDevElectronRuntimeSource } from "../dev-electron-shim";
import { ADD_PROMPT_ATTACHMENT_EVENT, PROMPT_FOCUS_EVENT, type AddPromptAttachmentDetail } from "../events";
import { useAppStore } from "../store/useAppStore";
import { hasRenderableBrowserWorkbenchBounds, shouldAttachBrowserWorkbench } from "../utils/browser-workbench-visibility";
import { normalizeWorkbenchUrl } from "../utils/workbench-url";
import { ActivityWorkspaceTabs } from "./ActivityWorkspaceTabs";
import type { ActivityWorkspaceTab } from "../utils/activity-workspace-tabs";

type BrowserWorkbenchPageProps = {
  active?: boolean;
  initialUrl?: string;
  occluded?: boolean;
  sessionId?: string | null;
  onOpenTrace?: () => void;
  onOpenUsage?: () => void;
  onOpenPreview?: () => void;
  onOpenGit?: () => void;
};

type AnnotationTool = "screenshot" | "page";

const defaultBrowserState: BrowserWorkbenchState = {
  url: "",
  title: "",
  loading: false,
  canGoBack: false,
  canGoForward: false,
  annotationMode: false,
};

const isBrowserPreviewRuntime = () => (
  typeof window !== "undefined" &&
  (!/Electron/i.test(window.navigator.userAgent) || getDevElectronRuntimeSource() !== "electron")
);

const hasBrowserWorkbenchRuntime = () => (
  typeof window !== "undefined" &&
  typeof window.electron?.openBrowserWorkbench === "function" &&
  typeof window.electron?.setBrowserWorkbenchBounds === "function"
);

type LocalBrowserTarget = {
  id: string;
  title: string;
  host: string;
  url: string;
  current?: boolean;
  recent?: boolean;
};

const RECENT_LOCAL_BROWSER_TARGETS_KEY = "tech-cc-hub:browser-workbench:recent-local-targets";
const COMMON_LOCAL_BROWSER_PORTS = [3000, 4173, 5173, 8000, 8001, 8080];
const MAX_LOCAL_BROWSER_TARGETS = 5;
const MAX_RECENT_LOCAL_BROWSER_TARGETS = 5;

type LocalTargetStatus = "checking" | "online" | "offline";

async function probeLocalTarget(url: string, timeoutMs = 1400): Promise<LocalTargetStatus> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, {
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal,
    });
    return "online";
  } catch {
    return "offline";
  } finally {
    window.clearTimeout(timeout);
  }
}

function LocalTargetPreview({ target }: { target: LocalBrowserTarget }) {
  return (
    <div className="grid h-[74px] w-[120px] shrink-0 place-items-center rounded-[14px] border border-black/8 bg-[#f8fafc] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="h-[54px] w-[92px] rounded-md border border-black/10 bg-white px-2 py-1.5 shadow-sm">
        <div className="mb-2 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b5f]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffc043]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#31c46a]" />
        </div>
        <div className="mb-1.5 h-1.5 rounded-full bg-ink-900/14" />
        <div className="mb-2 h-1.5 w-14 rounded-full bg-ink-900/18" />
        <div className="truncate text-[8px] font-semibold leading-none text-ink-800">{target.title}</div>
        <div className="mt-0.5 truncate text-[7px] leading-none text-muted">{target.host}</div>
      </div>
    </div>
  );
}

function isCurrentAppUrl(value: string) {
  if (!value.trim() || typeof window === "undefined") return false;
  try {
    const target = new URL(normalizeWorkbenchUrl(value) ?? value, window.location.href);
    const current = new URL(window.location.href);
    return target.origin === current.origin && target.pathname === current.pathname;
  } catch {
    return false;
  }
}

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function formatLocalBrowserTargetTitle(url: URL) {
  return url.host || url.hostname || url.href;
}

function getWorkspaceRecentStorageKey(workspaceKey: string) {
  return `${RECENT_LOCAL_BROWSER_TARGETS_KEY}:${encodeURIComponent(workspaceKey || "__glob
... (truncated)
```
