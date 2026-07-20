import { app } from "electron";
import log from "electron-log";
import { createRequire } from "node:module";
import type { ProgressInfo, UpdateInfo } from "electron-updater";
import {
  buildGitHubReleaseDownloadFeedUrl,
  createReleaseUpdatePlan,
  getPlatformUpdateChannel,
  isMissingPlatformUpdateMetadataError,
  selectNewestReleaseAboveCurrent,
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
  return getPlatformUpdateChannel(process.platform, process.arch);
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
  private lastPreparedUpdatePlan: ReleaseUpdatePlan | null = null;
  private readonly skippedUpdateReleaseTags = new Set<string>();

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
      await this.prepareCrossReleaseFeed();
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
      const fallbackStatus = isMissingPlatformUpdateMetadataError(error)
        ? await this.checkReleaseFallback(message)
        : null;
      if (fallbackStatus) {
        return {
          success: fallbackStatus.status !== "error",
          status: fallbackStatus,
          error: fallbackStatus.status === "error" ? fallbackStatus.error : undefined,
        };
      }
      const status = this.setStatus({
        status: "error",
        error: message,
        checkedAt: Date.now(),
      });
      return { success: false, status, error: message };
    }
  }

  private useDefaultGitHubFeed(): void {
    this.lastPreparedUpdatePlan = null;
    autoUpdater.disableDifferentialDownload = false;
    autoUpdater.previousBlockmapBaseUrlOverride = null;
    autoUpdater.setFeedURL({
      provider: "github",
      owner: UPDATE_OWNER,
      repo: UPDATE_REPO,
      releaseType: "release",
    });
    const channel = getUpdateChannel();
    if (channel) {
      autoUpdater.channel = channel;
    }
  }

  private useReleaseDownloadFeed(plan: ReleaseUpdatePlan): void {
    const release = plan.selectedRelease;
    if (!release?.tagName) return;

    const canUseDifferentialDownload = !plan.isMultiReleaseUpdate && Boolean(plan.previousBlockmapBaseUrl);
    autoUpdater.setFeedURL(buildGitHubReleaseDownloadFeedUrl(UPDATE_OWNER, UPDATE_REPO, release.tagName));
    autoUpdater.disableDifferentialDownload = !canUseDifferentialDownload;
    autoUpdater.previousBlockmapBaseUrlOverride = canUseDifferentialDownload
      ? plan.previousBlockmapBaseUrl ?? null
      : null;
    if (getUpdateChannel() && release.metadataFile === "latest.yml") {
      autoUpdater.channel = null;
    }
  }

  private async fetchRecentReleases(): Promise<GitHubReleaseLike[] | null> {
    const response = await fetch(getReleaseListApiUrl(), {
      headers: getGitHubRequestHeaders(),
    });
    if (!response.ok) return null;

    const releases = await response.json();
    return Array.isArray(releases) ? releases as GitHubReleaseLike[] : null;
  }

  private async prepareCrossReleaseFeed(): Promise<ReleaseFallbackInfo | null> {
    this.useDefaultGitHubFeed();

    try {
      const releases = await this.fetchRecentReleases();
      if (!releases) return null;

      const plan = createReleaseUpdatePlan(
        releases,
        app.getVersion(),
        process.platform,
        process.arch,
        UPDATE_OWNER,
        UPDATE_REPO,
        { excludeTags: this.skippedUpdateReleaseTags },
      );
      this.lastPreparedUpdatePlan = plan;
      const release = plan.selectedRelease;
      if (!release?.tagName || !release.hasCompatibleUpdateMetadata) return release;

      this.useReleaseDownloadFeed(plan);
      const canUseDifferentialDownload = !plan.isMultiReleaseUpdate && Boolean(plan.previousBlockmapBaseUrl);
      let updateStrategy = "differential download remains enabled";
      if (!canUseDifferentialDownload) {
        updateStrategy = plan.isMultiReleaseUpdate
          ? "using full download for cross-release update"
          : "using full download because the current release blockmap location is unknown";
      }
      log.info(
        `Selected app update release ${release.tagName} for ${process.platform}/${process.arch}; ${updateStrategy}`,
      );
      return release;
    } catch (error) {
      log.warn(`Unable to preselect app update release: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async checkReleaseFallback(originalError: string): Promise<AppUpdateStatus | null> {
    try {
      const currentVersion = app.getVersion();
      const releases = await this.fetchRecentReleases();
      const failedTag = this.lastPreparedUpdatePlan?.selectedRelease?.tagName;
      if (failedTag) {
        this.skippedUpdateReleaseTags.add(failedTag);
      }
      const fallbackPlan = releases
        ? createReleaseUpdatePlan(releases, currentVersion, process.platform, process.arch, UPDATE_OWNER, UPDATE_REPO, {
          excludeTags: this.skippedUpdateReleaseTags,
        })
        : null;
      const fallback = fallbackPlan?.selectedRelease ?? null;

      if (!fallback) {
        const newestRelease = releases
          ? selectNewestReleaseAboveCurrent(releases, currentVersion, process.platform, process.arch)
          : null;
        if (newestRelease && newestRelease.missingUpdateAssets.length > 0) {
          return this.setStatus({
            status: "unsupported",
            version: newestRelease.version,
            releaseName: newestRelease.releaseName,
            releaseDate: newestRelease.releaseDate,
            releaseNotes: newestRelease.releaseNotes,
            releaseUrl: newestRelease.releaseUrl,
            checkedAt: Date.now(),
            error: `发现 v${newestRelease.version}，但该 Release 缺少当前平台 (${process.platform}/${process.arch}) 的自动更新元数据或安装包。请等待对应安装包发布或到 GitHub Releases 手动查看。`,
          });
        }
        return this.setStatus({
          status: "not-available",
          checkedAt: Date.now(),
          error: undefined,
        });
      }

      if (!fallbackPlan) {
        return this.setStatus({
          status: "error",
          checkedAt: Date.now(),
          error: originalError,
        });
      }

      this.lastPreparedUpdatePlan = fallbackPlan;
      this.useReleaseDownloadFeed(fallbackPlan);
      log.warn(
        `Skipping incomplete or unreachable app update release ${failedTag ?? "(unknown)"}; prepared ${fallback.tagName} for the next update check`,
      );
      return this.setStatus({
        status: "available",
        version: fallback.version,
        releaseName: fallback.releaseName,
        releaseDate: fallback.releaseDate,
        releaseNotes: fallback.releaseNotes,
        releaseUrl: fallback.releaseUrl,
        checkedAt: Date.now(),
        error: `当前 Release 自动更新资产不可用，已切换到 ${fallback.tagName ?? `v${fallback.version}`}；请再次检查更新以继续。`,
      });

    } catch {
      return null;
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
        releaseName: info.releaseName ?? undefined,
        releaseDate: info.releaseDate ?? undefined,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        checkedAt: Date.now(),
        error: undefined,
      });
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      this.setStatus({
        status: "not-available",
        version: info.version,
        releaseDate: info.releaseDate ?? undefined,
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
        releaseName: info.releaseName ?? undefined,
        releaseDate: info.releaseDate ?? undefined,
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
      releaseUrl: partial.releaseUrl ?? this.status?.releaseUrl,
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
