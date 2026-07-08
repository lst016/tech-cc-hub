// src/electron/libs/emulator-installer/index.ts
// -----------------------------------------------------------------------------
// Phase 8: device-emulator-plugin public install surface.
// Exposes installEmulatorPlugin / getEmulatorInstallStatus. Phase 3 wires these
// to the renderer via IPC; tests and one-off scripts can also call them
// directly. Currently supports InstallSource.kind === "npm" only; GitHub
// release installs are stubbed with an explicit "unsupported" error so the
// UI never silently no-ops.
// -----------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type {
  EmulatorPlatform,
  InstallSource,
  RemoteAgentProtocol,
} from "../compat-plugin-default-enabled.js";
import {
  fetchLatestNpmVersion,
  installNpmPackageGlobal,
  isPackageInstalledGlobally,
} from "./install-from-npm.js";
import type { EmulatorInstallResult, EmulatorInstallStatusKind } from "./types.js";

export type { EmulatorInstallResult, EmulatorInstallStatusKind } from "./types.js";

const CLAUDE_ROOT = join(homedir(), ".claude");
const PLUGINS_DIR = join(CLAUDE_ROOT, "plugins");
const INSTALLED_PLUGINS_FILE = join(PLUGINS_DIR, "installed_plugins.json");

type InstalledPluginEntry = {
  installPath: string;
  version?: string;
  installedAt?: string;
};

type InstalledPluginsStore = {
  plugins?: Record<string, InstalledPluginEntry[]>;
};

function readInstalledPluginEntries(): InstalledPluginsStore {
  if (!existsSync(INSTALLED_PLUGINS_FILE)) return {};
  try {
    const raw = readFileSync(INSTALLED_PLUGINS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as { plugins?: unknown };
    if (parsed && typeof parsed === "object" && parsed.plugins && typeof parsed.plugins === "object") {
      return parsed as InstalledPluginsStore;
    }
    return {};
  } catch {
    return {};
  }
}

function recordInstalledPlugin(
  pluginId: string,
  installPath: string,
  version: string,
): void {
  if (!existsSync(PLUGINS_DIR)) {
    mkdirSync(PLUGINS_DIR, { recursive: true });
  }
  const store = readInstalledPluginEntries();
  const existing = Array.isArray(store.plugins?.[pluginId]) ? store.plugins![pluginId] : [];
  const next = existing.filter((entry) => entry.installPath !== installPath);
  next.push({ installPath, version, installedAt: new Date().toISOString() });
  store.plugins = { ...(store.plugins ?? {}), [pluginId]: next };
  writeFileSync(INSTALLED_PLUGINS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export type InstallEmulatorInput = {
  pluginId: string;
  emulatorPlatform: EmulatorPlatform;
  installSource: InstallSource;
  requiresRemoteAgent?: boolean;
  remoteAgentProtocol?: RemoteAgentProtocol;
  /** Resolved install path. Defaults to a well-known npm-global lib path. */
  installPath?: string;
};

function defaultNpmGlobalInstallPath(packageName: string): string {
  // npm global installs land under {prefix}/lib/node_modules/<name>. We use a
  // path that's correct for the user-global prefix on macOS / Linux. Windows
  // global prefix is queried separately by npm, so this fallback is best-effort
  // and only used for record-keeping — the actual binary resolution is done by
  // npm / the MCP server at runtime.
  return join(homedir(), ".npm-global", "lib", "node_modules", packageName);
}

export async function installEmulatorPlugin(
  input: InstallEmulatorInput,
): Promise<EmulatorInstallResult> {
  const baseResult: EmulatorInstallResult = {
    success: false,
    installed: false,
    connected: false,
    status: "installing",
    message: "准备安装模拟器。",
    checkedAt: Date.now(),
  };

  if (input.installSource.kind !== "npm") {
    return {
      ...baseResult,
      status: "error",
      message: `暂未实现 ${input.installSource.kind} 安装源。`,
      error: "unsupported-install-source",
    };
  }

  const latestVersion = await fetchLatestNpmVersion(input.installSource.packageName);
  const installResult = await installNpmPackageGlobal({
    packageName: input.installSource.packageName,
  });

  if (!installResult.success) {
    return {
      ...baseResult,
      status: "error",
      latestVersion: latestVersion ?? undefined,
      message: `${input.installSource.packageName} 安装失败。`,
      error: installResult.error,
    };
  }

  const installPath = input.installPath ?? defaultNpmGlobalInstallPath(input.installSource.packageName);
  const resolvedVersion = installResult.version ?? latestVersion ?? "unknown";
  recordInstalledPlugin(input.pluginId, installPath, resolvedVersion);

  return {
    success: true,
    installed: true,
    connected: !input.requiresRemoteAgent,
    status: input.requiresRemoteAgent ? "needs-remote-agent" : "ready",
    version: resolvedVersion,
    latestVersion: latestVersion ?? undefined,
    installPath,
    message: input.requiresRemoteAgent
      ? "模拟器包已安装。请配置远程 macOS Agent 后即可使用。"
      : "模拟器包已安装并就绪。",
    checkedAt: Date.now(),
  };
}

export async function getEmulatorInstallStatus(
  input: InstallEmulatorInput,
): Promise<EmulatorInstallResult> {
  const checkedAt = Date.now();

  if (input.installSource.kind !== "npm") {
    return {
      success: true,
      installed: false,
      connected: false,
      status: "not-installed",
      message: `暂未实现 ${input.installSource.kind} 安装源。`,
      checkedAt,
    };
  }

  const [latestVersion, installState] = await Promise.all([
    fetchLatestNpmVersion(input.installSource.packageName),
    isPackageInstalledGlobally(input.installSource.packageName),
  ]);

  if (!installState.installed) {
    return {
      success: true,
      installed: false,
      connected: false,
      status: "not-installed",
      latestVersion: latestVersion ?? undefined,
      message: latestVersion ? `未安装，最新版本 v${latestVersion}。` : "未安装。",
      checkedAt,
    };
  }

  return {
    success: true,
    installed: true,
    connected: !input.requiresRemoteAgent,
    status: input.requiresRemoteAgent ? "needs-remote-agent" : "ready",
    version: installState.version,
    latestVersion: latestVersion ?? undefined,
    updateAvailable: latestVersion ? latestVersion !== installState.version : false,
    message: input.requiresRemoteAgent
      ? "已安装；需配置远程 macOS Agent 后才能连接。"
      : "已安装并就绪。",
    checkedAt,
  };
}
