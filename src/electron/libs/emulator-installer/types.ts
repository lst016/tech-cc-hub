// src/electron/libs/emulator-installer/types.ts
// -----------------------------------------------------------------------------
// Phase 8: device-emulator-plugin runtime install layer — pure data types.
// No electron / fs / child_process imports here. Consumed by both the UI
// (via IPC, wired in Phase 3) and the installer side-effects (Phase 2).
//
// InstallSource / EmulatorPlatform / RemoteAgentProtocol are kept on
// compat-plugin-default-enabled so the data-layer (manifest parsing) and the
// runtime layer (this module) share a single source of truth.
// -----------------------------------------------------------------------------

export type EmulatorInstallStatusKind =
  | "not-installed"
  | "installing"
  | "installed"
  | "needs-remote-agent"
  | "ready"
  | "error";

export type EmulatorInstallResult = {
  success: boolean;
  installed: boolean;
  connected: boolean;
  status: EmulatorInstallStatusKind;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  message: string;
  error?: string;
  installPath?: string;
  remoteAgentUrl?: string;
  checkedAt: number;
};
