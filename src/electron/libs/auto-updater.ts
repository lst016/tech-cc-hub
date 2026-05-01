import { app } from "electron";
import log from "electron-log";
import { autoUpdater } from "electron-updater";
import type { ProgressInfo, UpdateInfo } from "electron-updater";

export type AppUpdateState =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
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
  if (platform === "darwin" && arch === "arm64") {
    return "latest-arm64";
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

    this.setStatus({ status: "idle" });
    setTimeout(() => {
      void this.checkForUpdates(true);
    }, 3000);
  }

  onStatus(listener: AppUpdateStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): AppUpdateStatus {
    return this.status;
  }

  async checkForUpdates(silent = false): Promise<AppUpdateActionResult> {
    if (!app.isPackaged) {
      const status = this.setStatus({
        status: "disabled",
        error: "开发模式不会检查 GitHub Releases 更新，打包后自动启用。",
      });
      return { success: false, status, error: status.error };
    }

    try {
      this.setStatus({
        status: "checking",
        error: undefined,
        checkedAt: Date.now(),
      });
      const result = await autoUpdater.checkForUpdates();
      if (!result) {
        const status = this.setStatus({
          status: silent ? "idle" : "not-available",
          checkedAt: Date.now(),
        });
        return { success: true, status };
      }
      return { success: true, status: this.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = this.setStatus({
        status: "error",
        error: message,
        checkedAt: Date.now(),
      });
      return { success: false, status, error: message };
    }
  }

  async downloadUpdate(): Promise<AppUpdateActionResult> {
    if (!app.isPackaged) {
      const status = this.setStatus({
        status: "disabled",
        error: "开发模式不会下载更新包。",
      });
      return { success: false, status, error: status.error };
    }

    try {
      this.setStatus({ status: "downloading", error: undefined });
      await autoUpdater.downloadUpdate();
      return { success: true, status: this.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = this.setStatus({ status: "error", error: message });
      return { success: false, status, error: message };
    }
  }

  quitAndInstall(): AppUpdateActionResult {
    if (this.status.status !== "downloaded") {
      const status = this.setStatus({
        status: "error",
        error: "还没有下载完成的更新包。",
      });
      return { success: false, status, error: status.error };
    }

    autoUpdater.quitAndInstall(true, true);
    setTimeout(() => {
      app.exit(0);
    }, 1000);
    return { success: true, status: this.status };
  }

  private registerEventHandlers(): void {
    autoUpdater.on("checking-for-update", () => {
      this.setStatus({
        status: "checking",
        error: undefined,
        checkedAt: Date.now(),
      });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.setStatus({
        status: "available",
        version: info.version,
        releaseName: info.releaseName,
        releaseDate: info.releaseDate,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        checkedAt: Date.now(),
        error: undefined,
      });
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      this.setStatus({
        status: "not-available",
        version: info.version,
        releaseDate: info.releaseDate,
        checkedAt: Date.now(),
        error: undefined,
      });
    });

    autoUpdater.on("download-progress", (progress: ProgressInfo) => {
      this.setStatus({
        status: "downloading",
        progress: {
          bytesPerSecond: progress.bytesPerSecond,
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
        },
        error: undefined,
      });
    });

    autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
      this.setStatus({
        status: "downloaded",
        version: info.version,
        releaseName: info.releaseName,
        releaseDate: info.releaseDate,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        progress: undefined,
        error: undefined,
      });
    });

    autoUpdater.on("error", (error: Error) => {
      this.setStatus({
        status: "error",
        error: error.message,
      });
    });
  }

  private createStatus(partial: Partial<AppUpdateStatus>): AppUpdateStatus {
    return {
      status: partial.status ?? this.status?.status ?? "idle",
      currentVersion: app.getVersion(),
      isPackaged: app.isPackaged,
      provider: "github",
      channel: partial.channel ?? this.status?.channel,
      version: partial.version ?? this.status?.version,
      releaseName: partial.releaseName ?? this.status?.releaseName,
      releaseDate: partial.releaseDate ?? this.status?.releaseDate,
      releaseNotes: partial.releaseNotes ?? this.status?.releaseNotes,
      checkedAt: partial.checkedAt ?? this.status?.checkedAt,
      progress: partial.progress ?? this.status?.progress,
      error: partial.error,
    };
  }

  private setStatus(partial: Partial<AppUpdateStatus>): AppUpdateStatus {
    this.status = this.createStatus(partial);
    this.broadcast();
    return this.status;
  }

  private broadcast(): void {
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }
}

export const appAutoUpdater = new AppAutoUpdater();
