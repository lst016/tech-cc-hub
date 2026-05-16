# src/electron/libs/auto-updater.ts

> 模块：`electron` · 语言：`typescript` · 行数：476

## 文件职责

基于electron-updater的应用自动更新管理

## 关键符号

- `AppAutoUpdater@0 - 自动更新器类，管理更新检查、下载和安装流程`
- `checkForUpdates@0 - 检查更新并返回结果状态`
- `downloadUpdate@0 - 下载可用更新`
- `installUpdate@0 - 安装已下载的更新并重启应用`
- `AppUpdateStatus@0 - 更新状态类型，包含status、progress、error等字段`

## 依赖输入

- `electron`
- `electron-log`
- `node:module`
- `electron-updater`
- `./auto-updater-fallback.js`

## 对外暴露

- `AppUpdateState`
- `AppUpdateStatus`
- `AppUpdateActionResult`
- `appAutoUpdater`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { app } from "electron";
import log from "electron-log";
import { createRequire } from "node:module";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import {
  buildGitHubReleaseDownloadFeedUrl,
  createReleaseUpdatePlan,
  isMissingPlatformUpdateMetadataError,
  selectBestReleaseForUpdate,
  type GitHubReleaseLike,
  type ReleaseFallbackInfo,
  type ReleaseUpdatePlan,
} from "./auto-updater-fallback.js";

const require = createRequire(import.meta.url);
const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
const UPDATE_OWNER = "lst016";
const UPDATE_REPO = "tech-cc-hub";
const RELEASE_LOOKUP_LIMIT = 30;

export type AppUpdateState =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "unsupported"
  | "error";

export type AppUpdateStatus = {
  status: AppUpdateState;
  currentVersion: string;
  isPackaged: boolean;
  provider: "github";
  channel?: string;
  version?: string;
  releaseName?: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseUrl?: string;
  checkedAt?: number;
  progress?: {
    bytesPerSecond: number;
    percent: number;
    transferred: number;
    total: number;
  };
  error?: string;
};

export type AppUpdateActionResult = {
  success: boolean;
  status: AppUpdateStatus;
  error?: string;
};

type AppUpdateStatusListener = (status: AppUpdateStatus) => void;

function getUpdateChannel(): string | undefined {
  const { platform, arch } = process;
  if (platform === "win32" && arch === "arm64") {
    return "latest-win-arm64";
  }
  return undefined;
}

function normalizeReleaseNotes(releaseNotes: UpdateInfo["releaseNotes"]): string | undefined {
  if (typeof releaseNotes === "string") {
    return releaseNotes;
  }
  if (!Array.isArray(releaseNotes)) {
    return undefined;
  }
  return releaseNotes
    .map((note) => {
      if (!note || typeof note !== "object") {
        return "";
      }
      const candidate = note as { version?: unknown; note?: unknown };
      const version = typeof candidate.version === "string" ? candidate.version.trim() : "";
      const text = typeof candidate.note === "string" ? candidate.note.trim() : "";
      return [version, text].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n") || undefined;
}

function isAutoUpdateDisabled(): boolean {
  return process.env.TECH_CC_HUB_DISABLE_AUTO_UPDATE === "1" ||
    process.env.AGENT_COWORK_DISABLE_AUTO_UPDATE === "1" ||
    process.env.CI === "true" ||
    process.env.CI === "1" ||
    process.env.GITHUB_ACTIONS === "true";
}

function getReleaseListApiUrl(): string {
  return `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases?per_page=${RELEASE_LOOKUP_LIMIT}`;
}

function getGitHubRequestHeaders(): Record<string, string> {
  return {
    "Accept": "application/vnd.github+json",
    "User-Agent": "tech-cc-hub-updater",
  };
}

class AppAutoUpdater {
  private initialized = false;
  private readonly listeners = new Set<AppUpdateStatusListener>();
  private status: AppUpdateStatus;

  constructor() {
    const channel = getUpdateChannel();
    this.status = this.createStatus({ status: "idle", channel });

    autoUpdater.logger = log;
    log.transports.file.level = "info";
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableDifferentialDownload = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.fullChangelog = true;
    if (channel) {
      autoUpdater.channel = channel;
    }
  }

  initialize(listener?: AppUpdateStatusListener): void {
    if (listener) {
      this.listeners.add(listener);
    }
    if (this.initialized) {
      this.broadcast();
      return;
    }

    this.initialized = true;
    this.registerEventHandlers();

    if (isAutoUpdateDisabled()) {
      this.setStatus({
        status: "disabled",
        error: "自动更新已通过环境变量或 CI 环境禁用。",
      });
      return;
    }

    if (!app.isPackaged) {
      this.setStatus({
        status: "disabled",
        error: "开发模式不会检查 GitHub Releases 更新，打包后自动启用。",
      });
      return;
    }

    this.setStatus({ status: "id
... (truncated)
```
