// src/electron/libs/emulator-installer/ipc.ts
// -----------------------------------------------------------------------------
// Phase 8: device-emulator-plugin IPC bridge.
// Registers 3 channels on ipcMain (install / status / refresh-style update
// check). Validates unknown IPC payloads before forwarding to the runtime
// installer so callers get a typed error instead of a thrown exception.
// -----------------------------------------------------------------------------

import { ipcMain } from "electron";

import {
  getEmulatorInstallStatus,
  installEmulatorPlugin,
  type InstallEmulatorInput,
} from "./index.js";
import type { EmulatorInstallResult } from "./types.js";
import type {
  EmulatorPlatform,
  InstallSource,
  RemoteAgentProtocol,
} from "../compat-plugin-default-enabled.js";

const ERROR_INVALID_INPUT: EmulatorInstallResult = {
  success: false,
  installed: false,
  connected: false,
  status: "error",
  message: "Invalid emulator input.",
  error: "invalid-input",
  checkedAt: Date.now(),
};

const KNOWN_PLATFORMS: ReadonlySet<EmulatorPlatform> = new Set<EmulatorPlatform>(["android", "ios"]);
const KNOWN_PROTOCOLS: ReadonlySet<RemoteAgentProtocol> = new Set<RemoteAgentProtocol>(["websocket", "http"]);

function parseInstallSource(input: unknown): InstallSource | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  if (obj.kind === "npm" && typeof obj.packageName === "string" && obj.packageName) {
    return { kind: "npm", packageName: obj.packageName };
  }
  if (
    obj.kind === "github-release" &&
    typeof obj.repo === "string" &&
    typeof obj.assetPattern === "string" &&
    obj.repo &&
    obj.assetPattern
  ) {
    return { kind: "github-release", repo: obj.repo, assetPattern: obj.assetPattern };
  }
  return null;
}

export function parseEmulatorInput(input: unknown): InstallEmulatorInput | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.pluginId !== "string" || !obj.pluginId) return null;
  if (
    typeof obj.emulatorPlatform !== "string" ||
    !KNOWN_PLATFORMS.has(obj.emulatorPlatform as EmulatorPlatform)
  ) {
    return null;
  }
  const installSource = parseInstallSource(obj.installSource);
  if (!installSource) return null;
  const requiresRemoteAgent = obj.requiresRemoteAgent === true;
  const remoteAgentProtocol =
    typeof obj.remoteAgentProtocol === "string" &&
    KNOWN_PROTOCOLS.has(obj.remoteAgentProtocol as RemoteAgentProtocol)
      ? (obj.remoteAgentProtocol as RemoteAgentProtocol)
      : undefined;
  const installPath =
    typeof obj.installPath === "string" && obj.installPath ? obj.installPath : undefined;
  return {
    pluginId: obj.pluginId,
    emulatorPlatform: obj.emulatorPlatform as EmulatorPlatform,
    installSource,
    requiresRemoteAgent,
    remoteAgentProtocol,
    installPath,
  };
}

export function registerEmulatorInstallerIpc(): void {
  ipcMain.handle("plugins:installEmulator", async (_event, input: unknown) => {
    const parsed = parseEmulatorInput(input);
    if (!parsed) return ERROR_INVALID_INPUT;
    return await installEmulatorPlugin(parsed);
  });
  ipcMain.handle("plugins:getEmulatorStatus", async (_event, input: unknown) => {
    const parsed = parseEmulatorInput(input);
    if (!parsed) return ERROR_INVALID_INPUT;
    return await getEmulatorInstallStatus(parsed);
  });
  // Phase 3 reuses the status probe as the "refresh" path. Phase 5 may add a
  // dedicated latestVersion-only probe if the registry scan gets expensive.
  ipcMain.handle("plugins:checkEmulatorUpdate", async (_event, input: unknown) => {
    const parsed = parseEmulatorInput(input);
    if (!parsed) return ERROR_INVALID_INPUT;
    return await getEmulatorInstallStatus(parsed);
  });
}
