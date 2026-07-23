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
import {
  discoverInternalVersionFeeds,
  getInternalUpdateMetadataUrl,
  getUpdateSourceOrder,
  isVersionedInternalUpdateUrl,
  resolveAppUpdateSourcePolicy,
  type AppUpdateProvider,
  type AppUpdateSourcePolicy,
} from "./auto-updater-sources.js";

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
  provider: AppUpdateProvider;
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
  private readonly sourcePolicy: AppUpdateSourcePolicy;
  private activeProvider: AppUpdateProvider;
  private checkingSourceChain = false;
  private lastPreparedUpdatePlan: ReleaseUpdatePlan | null = null;
  private readonly skippedUpdateReleaseTags = new Set<string>();

  constructor() {
    this.sourcePolicy = resolveAppUpdateSourcePolicy();
    this.activeProvider = getUpdateSourceOrder(this.sourcePolicy.mode)[0] ?? "github";
    const channel = getUpdateChannel();
    this.status = this.createStatus({
      status: "idle",
      channel,
      provider: this.activeProvider,
    });

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
        error: "开发模式不会检查应用更新，打包后自动启用。",
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
        error: "开发模式不会检查应用更新，打包后自动启用。",
      });
      return { success: false, status, error: status.error };
    }

    const sources = getUpdateSourceOrder(this.sourcePolicy.mode);
    let lastError: unknown = null;

    this.checkingSourceChain = true;
    try {
      for (let index = 0; index < sources.length; index += 1) {
        const provider = sources[index];
        if (!provider) continue;

        this.activeProvider = provider;
        this.setStatus({
          status: "checking",
          provider,
          error: undefined,
          checkedAt: Date.now(),
        });

        try {
          const result = provider === "internal"
            ? await this.checkInternalFeed()
            : await this.checkGitHubFeed();
          if (result?.isUpdateAvailable) {
            return { success: true, status: this.status };
          }

          if (index < sources.length - 1) {
            log.info(`No internal update available; falling back to ${sources[index + 1]}`);
            continue;
          }

          const status = this.setStatus({
            status: silent ? "idle" : "not-available",
            provider,
            checkedAt: Date.now(),
            error: undefined,
          });
          return { success: true, status };
        } catch (error) {
          lastError = error;
          const message = error instanceof Error ? error.message : String(error);
          if (index < sources.length - 1) {
            log.warn(
              `${provider === "internal" ? "Internal" : "GitHub"} update source failed; ` +
                `falling back to ${sources[index + 1]}: ${message}`,
            );
            continue;
          }

          const fallbackStatus = provider === "github" && isMissingPlatformUpdateMetadataError(error)
            ? await this.checkReleaseFallback(message)
            : null;
          if (fallbackStatus) {
            return {
              success: fallbackStatus.status !== "error",
              status: fallbackStatus,
              error: fallbackStatus.status === "error" ? fallbackStatus.error : undefined,
            };
          }
        }
      }
    } finally {
      this.checkingSourceChain = false;
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError ?? "更新源不可用");
    const status = this.setStatus({
      status: "error",
      provider: this.activeProvider,
      error: message,
      checkedAt: Date.now(),
    });
    return { success: false, status, error: message };
  }

  private useInternalFeed(feedUrl: string): void {
    this.activeProvider = "internal";
    this.lastPreparedUpdatePlan = null;
    autoUpdater.setFeedURL({
      provider: "generic",
      url: feedUrl,
    });
    autoUpdater.disableDifferentialDownload = true;
    autoUpdater.previousBlockmapBaseUrlOverride = null;
    const channel = getUpdateChannel();
    if (channel) {
      autoUpdater.channel = channel;
    }
  }

  private useDefaultGitHubFeed(): void {
    this.activeProvider = "github";
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

  private async probeInternalMetadata(feedUrl: string): Promise<void> {
    const metadataUrl = getInternalUpdateMetadataUrl(
      feedUrl,
      process.platform,
      process.arch,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.sourcePolicy.internalProbeTimeoutMs);
    try {
      const response = await fetch(metadataUrl, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`内网更新元数据不可用（HTTP ${response.status}）：${metadataUrl}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveInternalFeedUrl(): Promise<string> {
    const configuredUrl = this.sourcePolicy.internalFeedUrl;
    if (isVersionedInternalUpdateUrl(configuredUrl)) {
      await this.probeInternalMetadata(configuredUrl);
      return configuredUrl;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.sourcePolicy.internalProbeTimeoutMs);
    let listingHtml: string;
    try {
      const response = await fetch(configuredUrl, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`内网版本目录不可用（HTTP ${response.status}）：${configuredUrl}`);
      }
      listingHtml = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    const candidates = discoverInternalVersionFeeds(configuredUrl, listingHtml);
    if (candidates.length === 0) {
      return await this.resolveBootstrapInternalFeed(
        `内网版本目录没有发现 vX.Y.Z 子目录：${configuredUrl}`,
      );
    }

    for (const candidate of candidates) {
      try {
        await this.probeInternalMetadata(candidate.feedUrl);
        return candidate.feedUrl;
      } catch (error) {
        log.warn(
          `Skipping incomplete internal update directory ${candidate.feedUrl}: ` +
            `${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return await this.resolveBootstrapInternalFeed(
      `内网版本目录中没有当前平台可用的更新元数据：${configuredUrl}`,
    );
  }

  private async resolveBootstrapInternalFeed(reason: string): Promise<string> {
    const bootstrapFeedUrl = this.sourcePolicy.internalBootstrapFeedUrl;
    if (!bootstrapFeedUrl) {
      throw new Error(reason);
    }
    log.warn(`${reason}; falling back to configured bootstrap feed ${bootstrapFeedUrl}`);
    await this.probeInternalMetadata(bootstrapFeedUrl);
    return bootstrapFeedUrl;
  }

  private async checkInternalFeed() {
    const feedUrl = await this.resolveInternalFeedUrl();
    this.useInternalFeed(feedUrl);
    log.info(`Selected internal update feed ${feedUrl}`);
    return await autoUpdater.checkForUpdates();
  }

  private async checkGitHubFeed() {
    await this.prepareCrossReleaseFeed();
    return await autoUpdater.checkForUpdates();
  }

  private async fetchRecentReleases(): Promise<GitHubReleaseLike[] | null> {
    const response = await fetch(
      `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases?per_page=${RELEASE_LOOKUP_LIMIT}`,
      {
        headers: getGitHubRequestHeaders(),
      },
    );
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
        `Selected app update release ${release.tagName} from GitHub for ` +
          `${process.platform}/${process.arch}; ${updateStrategy}`,
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
            provider: "github",
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
          provider: "github",
          checkedAt: Date.now(),
          error: undefined,
        });
      }

      if (!fallbackPlan) {
        return this.setStatus({
          status: "error",
          provider: "github",
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
        provider: "github",
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
      const canFallbackToGitHub = this.activeProvider === "internal" &&
        getUpdateSourceOrder(this.sourcePolicy.mode).includes("github");
      if (canFallbackToGitHub) {
        log.warn(`Internal update download failed; retrying from GitHub: ${message}`);
        try {
          this.checkingSourceChain = true;
          this.activeProvider = "github";
          this.setStatus({
            status: "checking",
            provider: "github",
            error: "内网下载失败，正在切换到 GitHub 备用源。",
            checkedAt: Date.now(),
          });
          const result = await this.checkGitHubFeed();
          if (!result?.isUpdateAvailable) {
            throw new Error("GitHub 备用源没有当前客户端可用的新版本");
          }
          this.checkingSourceChain = false;
          this.setStatus({
            status: "downloading",
            provider: "github",
            error: undefined,
          });
          await autoUpdater.downloadUpdate();
          return { success: true, status: this.status };
        } catch (fallbackError) {
          const fallbackMessage = fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
          const combinedMessage = `内网下载失败：${message}；GitHub 备用源失败：${fallbackMessage}`;
          const status = this.setStatus({
            status: "error",
            provider: "github",
            error: combinedMessage,
          });
          return { success: false, status, error: combinedMessage };
        } finally {
          this.checkingSourceChain = false;
        }
      }
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
      if (this.checkingSourceChain) return;
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
      if (this.checkingSourceChain) return;
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
      provider: partial.provider ?? this.activeProvider ?? this.status?.provider ?? "github",
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
