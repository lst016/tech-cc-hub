import { execFile, spawn } from "node:child_process";
import { homedir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import {
  existsSync,
  readdirSync,
  statSync,
  type Dirent,
  type Stats,
} from "node:fs";
import {
  basename,
  extname,
  join,
  normalize,
  resolve,
} from "node:path";

export type IdeaEdition = "ultimate" | "community" | "any";

export type IdeaLauncherKind = "toolbox-script" | "executable" | "mac-app";

export type IdeaInstallation = {
  id: string;
  displayName: string;
  launcherPath: string;
  launcherKind: IdeaLauncherKind;
  source: "toolbox-script" | "toolbox-app" | "standard-install" | "manual";
  edition: Exclude<IdeaEdition, "any"> | "unknown";
  versionText?: string;
  versionParts: number[];
  mtimeMs: number;
};

export type RunningIdeaProcess = {
  pid: number;
  imageName: string;
  command?: string;
};

export type IdeaStatus = {
  platform: NodeJS.Platform;
  running: RunningIdeaProcess[];
  installations: IdeaInstallation[];
  recommended: IdeaInstallation | null;
};

export type IdeaOpenInput = {
  projectPath?: string;
  filePath?: string;
  line?: number;
  column?: number;
  edition?: IdeaEdition;
  version?: string;
  launcherPath?: string;
  allowLaunch?: boolean;
};

export type IdeaOpenResult = {
  success: boolean;
  action: "idea_open";
  reusedExisting: boolean;
  launched: boolean;
  launcher: IdeaInstallation | null;
  args: string[];
  runningBefore: RunningIdeaProcess[];
  matchingInstallations?: IdeaInstallation[];
  error?: string;
  note?: string;
};

export type IdeaRerunShortcut = "ctrl-f5" | "shift-f10";

export type IdeaRerunInput = Pick<IdeaOpenInput, "projectPath" | "filePath" | "line" | "column" | "edition" | "version" | "launcherPath" | "allowLaunch"> & {
  shortcut?: IdeaRerunShortcut;
  focusDelayMs?: number;
};

export type IdeaRerunResult = {
  success: boolean;
  action: "idea_restart";
  shortcut: IdeaRerunShortcut;
  keyStroke: string;
  openResult?: IdeaOpenResult;
  focused: boolean;
  sent: boolean;
  running: RunningIdeaProcess[];
  note?: string;
  error?: string;
};

export type IdeaReadLogsInput = Pick<IdeaOpenInput, "projectPath" | "filePath" | "line" | "column" | "edition" | "version" | "launcherPath" | "allowLaunch"> & {
  openRunWindow?: boolean;
  runWindowShortcut?: string;
  focusDelayMs?: number;
  copyDelayMs?: number;
  tailLines?: number;
  maxChars?: number;
  restoreClipboard?: boolean;
};

export type IdeaReadLogsResult = {
  success: boolean;
  action: "idea_read_logs";
  focused: boolean;
  copied: boolean;
  openResult?: IdeaOpenResult;
  running: RunningIdeaProcess[];
  text: string;
  lineCount: number;
  truncated: boolean;
  source: "idea-run-console";
  note?: string;
  error?: string;
};

export type IdeaFocusResult = {
  success: boolean;
  action: "idea_focus";
  focused: boolean;
  running: RunningIdeaProcess[];
  pid?: number;
  error?: string;
  note?: string;
};

export type IdeaWaitReadyInput = {
  timeoutMs?: number;
  intervalMs?: number;
};

export type IdeaWaitReadyResult = {
  success: boolean;
  action: "idea_wait_ready";
  timedOut: boolean;
  waitedMs: number;
  running: RunningIdeaProcess[];
  error?: string;
  note?: string;
};

type DiscoverOptions = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
};

const WINDOWS_IDEA_PROCESS_NAMES = new Set(["idea64.exe", "idea.exe"]);
const WINDOWS_TOOLBOX_SCRIPT_NAMES = new Set(["idea.cmd", "idea.bat", "idea64.cmd", "idea64.bat"]);
const MAC_IDEA_APP_NAMES = new Set(["IntelliJ IDEA.app", "IntelliJ IDEA CE.app"]);

export function parseIdeaVersionFromPath(filePath: string): { text: string; parts: number[] } | null {
  const normalizedPath = filePath.replace(/[\\/]+/g, " ");
  const namedVersion = normalizedPath.match(/IntelliJ IDEA(?: Community)?\s+((?:20\d{2})(?:\.\d+){0,3})/i);
  const genericVersion = normalizedPath.match(/(?:^|[\s_-])((?:20\d{2})(?:\.\d+){1,3})(?:$|[\s_-])/);
  const toolboxBuild = normalizedPath.match(/(?:^|[\s_-])((?:2[0-9]{2})(?:\.\d+){1,3})(?:$|[\s_-])/);
  const raw = namedVersion?.[1] ?? genericVersion?.[1] ?? toolboxBuild?.[1];
  if (!raw) return null;
  const parts = raw.split(".").map((part) => Number.parseInt(part, 10)).filter(Number.isFinite);
  return parts.length > 0 ? { text: raw, parts } : null;
}

export function compareVersionParts(left: number[], right: number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    if (l !== r) return l - r;
  }
  return 0;
}

export function selectBestIdeaInstallation(
  installations: IdeaInstallation[],
  edition: IdeaEdition = "any",
): IdeaInstallation | null {
  const filtered = installations.filter((installation) => {
    return edition === "any" || installation.edition === edition || installation.edition === "unknown";
  });
  if (filtered.length === 0) return null;

  return [...filtered].sort((a, b) => {
    const scriptDelta = Number(b.source === "toolbox-script") - Number(a.source === "toolbox-script");
    if (scriptDelta !== 0) return scriptDelta;

    const versionDelta = compareVersionParts(b.versionParts, a.versionParts);
    if (versionDelta !== 0) return versionDelta;

    const sourceDelta = sourcePriority(b) - sourcePriority(a);
    if (sourceDelta !== 0) return sourceDelta;

    return b.mtimeMs - a.mtimeMs;
  })[0] ?? null;
}

export function filterIdeaInstallations(
  installations: IdeaInstallation[],
  input: Pick<IdeaOpenInput, "edition" | "version" | "launcherPath"> = {},
): IdeaInstallation[] {
  const requestedLauncherPath = input.launcherPath?.trim();
  const requestedVersion = input.version?.trim();
  const requestedEdition = input.edition ?? "any";

  return installations.filter((installation) => {
    if (requestedLauncherPath) {
      const expectedPath = normalize(resolve(requestedLauncherPath)).toLowerCase();
      const actualPath = normalize(installation.launcherPath).toLowerCase();
      if (actualPath !== expectedPath) return false;
    }

    if (requestedVersion) {
      const haystack = [
        installation.versionText,
        installation.displayName,
        installation.launcherPath,
      ].filter(Boolean).join(" ");
      if (!haystack.includes(requestedVersion)) return false;
    }

    return requestedEdition === "any"
      || installation.edition === requestedEdition
      || installation.edition === "unknown";
  });
}

export function selectIdeaInstallation(
  installations: IdeaInstallation[],
  input: Pick<IdeaOpenInput, "edition" | "version" | "launcherPath"> = {},
): IdeaInstallation | null {
  return selectBestIdeaInstallation(filterIdeaInstallations(installations, input), input.edition ?? "any");
}

export function buildIdeaOpenArgs(input: Pick<IdeaOpenInput, "projectPath" | "filePath" | "line" | "column">): string[] {
  const args: string[] = [];
  if (input.projectPath) args.push(resolve(input.projectPath));
  if (input.filePath) {
    if (input.line && input.line > 0) args.push("--line", String(input.line));
    if (input.column && input.column > 0) args.push("--column", String(input.column));
    args.push(resolve(input.filePath));
  }
  return args;
}

export function parseWindowsTasklistCsv(output: string): RunningIdeaProcess[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine)
    .filter((columns) => columns.length >= 2)
    .map((columns) => ({
      imageName: columns[0] ?? "",
      pid: Number.parseInt(columns[1] ?? "", 10),
    }))
    .filter((processInfo) => {
      return Number.isFinite(processInfo.pid) && WINDOWS_IDEA_PROCESS_NAMES.has(processInfo.imageName.toLowerCase());
    });
}

export function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      columns.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  columns.push(current);
  return columns;
}

export function discoverIdeaInstallations(options: DiscoverOptions = {}): IdeaInstallation[] {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const installations: IdeaInstallation[] = [];

  if (platform === "win32") {
    installations.push(...discoverWindowsToolboxScripts(env));
    installations.push(...discoverWindowsStandardInstalls(env));
    installations.push(...discoverToolboxExecutables(env, platform));
  } else if (platform === "darwin") {
    installations.push(...discoverMacApplications());
    installations.push(...discoverToolboxExecutables(env, platform));
  } else {
    installations.push(...discoverLinuxExecutables(env));
    installations.push(...discoverToolboxExecutables(env, platform));
  }

  return dedupeInstallations(installations);
}

export async function getIdeaStatus(options: DiscoverOptions = {}): Promise<IdeaStatus> {
  const platform = options.platform ?? process.platform;
  const installations = discoverIdeaInstallations({ ...options, platform });
  const running = await listRunningIdeaProcesses(platform).catch(() => []);
  return {
    platform,
    running,
    installations,
    recommended: selectBestIdeaInstallation(installations),
  };
}

export async function openIdea(input: IdeaOpenInput = {}): Promise<IdeaOpenResult> {
  const status = await getIdeaStatus();
  const allowLaunch = input.allowLaunch ?? true;
  const args = buildIdeaOpenArgs(input);

  if (status.running.length > 0 && args.length === 0) {
    return {
      success: true,
      action: "idea_open",
      reusedExisting: true,
      launched: false,
      launcher: status.recommended,
      args,
      runningBefore: status.running,
      note: "IDEA 已在运行，无需调用启动器。",
    };
  }

  if (status.running.length === 0 && !allowLaunch) {
    return {
      success: false,
      action: "idea_open",
      reusedExisting: false,
      launched: false,
      launcher: status.recommended,
      args,
      runningBefore: status.running,
      error: "IDEA 未运行，且 allowLaunch=false。",
    };
  }

  const matchingInstallations = filterIdeaInstallations(status.installations, input);
  const launcher = selectIdeaInstallation(status.installations, input);
  if (!launcher) {
    return {
      success: false,
      action: "idea_open",
      reusedExisting: status.running.length > 0,
      launched: false,
      launcher: null,
      args,
      runningBefore: status.running,
      matchingInstallations,
      error: "未找到 IntelliJ IDEA 启动器。请安装 IDEA，或启用 JetBrains Toolbox shell scripts。",
    };
  }

  const spawnResult = spawnIdeaLauncher(launcher, args);
  if (!spawnResult.success) {
    return {
      success: false,
      action: "idea_open",
      reusedExisting: status.running.length > 0,
      launched: false,
      launcher,
      args,
      runningBefore: status.running,
      matchingInstallations,
      error: spawnResult.error,
    };
  }

  return {
    success: true,
    action: "idea_open",
    reusedExisting: status.running.length > 0,
    launched: status.running.length === 0,
    launcher,
    args,
    runningBefore: status.running,
    matchingInstallations,
    note: status.running.length > 0
      ? "已向现有 IDEA 进程发送启动器请求；是否接管由当前安装的 IDE 支持情况决定。"
      : "已在后台发起 IDEA 启动请求。",
  };
}

export async function rerunIdeaRunConfiguration(input: IdeaRerunInput = {}): Promise<IdeaRerunResult> {
  const shortcut = input.shortcut ?? "ctrl-f5";
  const keyStroke = shortcutToSendKeysStroke(shortcut);
  let openResult: IdeaOpenResult | undefined;

  if (input.projectPath || input.filePath) {
    openResult = await openIdea({
      projectPath: input.projectPath,
      filePath: input.filePath,
      line: input.line,
      column: input.column,
      edition: input.edition,
      version: input.version,
      launcherPath: input.launcherPath,
      allowLaunch: input.allowLaunch ?? true,
    });
    if (!openResult.success) {
      return {
        success: false,
        action: "idea_restart",
        shortcut,
        keyStroke,
        openResult,
        focused: false,
        sent: false,
        running: openResult.runningBefore,
        error: openResult.error ?? "Unable to open or reuse the requested IDEA project before rerun.",
      };
    }
    await delay(clampWaitMs(input.focusDelayMs, 0, 10000, 1200));
  }

  const focusResult = await focusIdea();
  if (!focusResult.success) {
    return {
      success: false,
      action: "idea_restart",
      shortcut,
      keyStroke,
      openResult,
      focused: false,
      sent: false,
      running: focusResult.running,
      error: focusResult.error ?? "IDEA is not running.",
    };
  }

  try {
    await sendIdeaRerunShortcut(keyStroke);
    return {
      success: true,
      action: "idea_restart",
      shortcut,
      keyStroke,
      openResult,
      focused: true,
      sent: true,
      running: focusResult.running,
      note: "Requested IDEA to rerun the current Run Configuration. This uses the IDE run surface and does not start Maven/Gradle from tech-cc-hub.",
    };
  } catch (error) {
    return {
      success: false,
      action: "idea_restart",
      shortcut,
      keyStroke,
      openResult,
      focused: true,
      sent: false,
      running: focusResult.running,
      error: error instanceof Error ? error.message : "Failed to send IDEA rerun shortcut.",
    };
  }
}

export async function readIdeaRunConsoleLogs(input: IdeaReadLogsInput = {}): Promise<IdeaReadLogsResult> {
  let openResult: IdeaOpenResult | undefined;

  if (input.projectPath || input.filePath) {
    openResult = await openIdea({
      projectPath: input.projectPath,
      filePath: input.filePath,
      line: input.line,
      column: input.column,
      edition: input.edition,
      version: input.version,
      launcherPath: input.launcherPath,
      allowLaunch: input.allowLaunch ?? true,
    });
    if (!openResult.success) {
      return {
        success: false,
        action: "idea_read_logs",
        focused: false,
        copied: false,
        openResult,
        running: openResult.runningBefore,
        text: "",
        lineCount: 0,
        truncated: false,
        source: "idea-run-console",
        error: openResult.error ?? "Unable to open or reuse the requested IDEA project before reading logs.",
      };
    }
    await delay(clampWaitMs(input.focusDelayMs, 0, 10000, 1200));
  }

  const focusResult = await focusIdea();
  if (!focusResult.success) {
    return {
      success: false,
      action: "idea_read_logs",
      focused: false,
      copied: false,
      openResult,
      running: focusResult.running,
      text: "",
      lineCount: 0,
      truncated: false,
      source: "idea-run-console",
      error: focusResult.error ?? "IDEA is not running.",
    };
  }

  try {
    const rawText = await copyIdeaRunConsoleText({
      openRunWindow: input.openRunWindow ?? true,
      runWindowShortcut: input.runWindowShortcut ?? "%4",
      copyDelayMs: clampWaitMs(input.copyDelayMs, 100, 10000, 800),
      restoreClipboard: input.restoreClipboard ?? true,
    });
    const trimmed = tailLogText(rawText, {
      tailLines: input.tailLines ?? 400,
      maxChars: input.maxChars ?? 60000,
    });

    return {
      success: true,
      action: "idea_read_logs",
      focused: true,
      copied: true,
      openResult,
      running: focusResult.running,
      text: trimmed.text,
      lineCount: trimmed.lineCount,
      truncated: trimmed.truncated,
      source: "idea-run-console",
      note: "Copied the current IntelliJ IDEA Run console text and restored the previous clipboard when requested.",
    };
  } catch (error) {
    return {
      success: false,
      action: "idea_read_logs",
      focused: true,
      copied: false,
      openResult,
      running: focusResult.running,
      text: "",
      lineCount: 0,
      truncated: false,
      source: "idea-run-console",
      error: error instanceof Error ? error.message : "Failed to copy IDEA Run console logs.",
    };
  }
}

export async function focusIdea(): Promise<IdeaFocusResult> {
  const running = await listRunningIdeaProcesses(process.platform).catch(() => []);
  const target = running[0];
  if (!target) {
    return {
      success: false,
      action: "idea_focus",
      focused: false,
      running,
      error: "IDEA 未运行。",
    };
  }

  try {
    if (process.platform === "win32") {
      await focusWindowsProcess(target.pid);
    } else if (process.platform === "darwin") {
      const appName = running.some((processInfo) => (processInfo.command ?? "").includes("IntelliJ IDEA CE.app"))
        ? "IntelliJ IDEA CE"
        : "IntelliJ IDEA";
      await execFileText("open", ["-a", appName], 5000);
    } else {
      await focusLinuxIdeaWindow();
    }

    return {
      success: true,
      action: "idea_focus",
      focused: true,
      running,
      pid: target.pid,
      note: "已请求把正在运行的 IDEA 窗口拉到前台。",
    };
  } catch (error) {
    return {
      success: false,
      action: "idea_focus",
      focused: false,
      running,
      pid: target.pid,
      error: error instanceof Error ? error.message : "聚焦 IDEA 失败。",
    };
  }
}

export async function waitForIdeaReady(input: IdeaWaitReadyInput = {}): Promise<IdeaWaitReadyResult> {
  const timeoutMs = clampWaitMs(input.timeoutMs, 1000, 120000, 30000);
  const intervalMs = clampWaitMs(input.intervalMs, 200, 5000, 1000);
  const startedAt = Date.now();
  let lastError: string | undefined;
  let lastRunning: RunningIdeaProcess[] = [];

  while (Date.now() - startedAt <= timeoutMs) {
    try {
      lastRunning = await listRunningIdeaProcesses(process.platform);
      if (lastRunning.length > 0) {
        return {
          success: true,
          action: "idea_wait_ready",
          timedOut: false,
          waitedMs: Date.now() - startedAt,
          running: lastRunning,
          note: "IDEA 已在运行。",
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    const elapsedMs = Date.now() - startedAt;
    const remainingMs = timeoutMs - elapsedMs;
    if (remainingMs <= 0) break;
    await delay(Math.min(intervalMs, remainingMs));
  }

  return {
    success: false,
    action: "idea_wait_ready",
    timedOut: true,
    waitedMs: Date.now() - startedAt,
    running: lastRunning,
    error: lastError ?? "等待 IDEA 运行超时。",
  };
}

async function listRunningIdeaProcesses(platform: NodeJS.Platform): Promise<RunningIdeaProcess[]> {
  if (platform === "win32") {
    const output = await execFileText("tasklist.exe", ["/fo", "csv", "/nh"], 5000);
    return parseWindowsTasklistCsv(output);
  }

  const output = await execFileText("ps", ["-axo", "pid=,comm=,args="], 5000);
  const processes: RunningIdeaProcess[] = [];
  for (const line of output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    const match = line.match(/^(\d+)\s+(\S+)\s+(.+)$/);
    if (!match) continue;
    const processInfo: RunningIdeaProcess = {
      pid: Number.parseInt(match[1], 10),
      imageName: basename(match[2] ?? ""),
      command: match[3],
    };
    if (!Number.isFinite(processInfo.pid)) continue;
    const haystack = `${processInfo.imageName} ${processInfo.command ?? ""}`.toLowerCase();
    if (haystack.includes("intellij idea") || haystack.includes("/idea") || haystack.includes("\\idea")) {
      processes.push(processInfo);
    }
  }
  return processes;
}

function clampWaitMs(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(Math.floor(value ?? fallback), max));
}

function shortcutToSendKeysStroke(shortcut: IdeaRerunShortcut): string {
  switch (shortcut) {
    case "shift-f10":
      return "+{F10}";
    case "ctrl-f5":
    default:
      return "^{F5}";
  }
}

async function sendIdeaRerunShortcut(keyStroke: string): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("IDEA Run Configuration rerun is currently supported only on Windows.");
  }

  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${keyStroke.replace(/'/g, "''")}')
`;
  await execFileText("powershell.exe", ["-NoProfile", "-STA", "-Command", script], 5000);
}

export function tailLogText(text: string, options: { tailLines?: number; maxChars?: number } = {}): { text: string; lineCount: number; truncated: boolean } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.length > 0 ? normalized.split("\n") : [];
  const lineLimit = clampCount(options.tailLines, 1, 5000, 400);
  let truncated = lines.length > lineLimit;
  let output = lines.slice(-lineLimit).join("\n");

  const charLimit = clampCount(options.maxChars, 1000, 500000, 60000);
  if (output.length > charLimit) {
    output = output.slice(-charLimit);
    truncated = true;
  }

  return {
    text: output,
    lineCount: output ? output.split("\n").length : 0,
    truncated,
  };
}

function clampCount(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(Math.floor(value ?? fallback), max));
}

async function copyIdeaRunConsoleText(input: {
  openRunWindow: boolean;
  runWindowShortcut: string;
  copyDelayMs: number;
  restoreClipboard: boolean;
}): Promise<string> {
  if (process.platform !== "win32") {
    throw new Error("IDEA Run console log capture is currently supported only on Windows.");
  }

  const script = `
Add-Type -AssemblyName System.Windows.Forms
$oldClipboard = ""
$hadClipboard = $false
try {
  $oldClipboard = Get-Clipboard -Raw -ErrorAction Stop
  $hadClipboard = $true
} catch {}
try {
  if (${input.openRunWindow ? "$true" : "$false"}) {
    [System.Windows.Forms.SendKeys]::SendWait('${powershellSingleQuoted(input.runWindowShortcut)}')
    Start-Sleep -Milliseconds 500
  }
  [System.Windows.Forms.SendKeys]::SendWait('^a')
  Start-Sleep -Milliseconds 120
  [System.Windows.Forms.SendKeys]::SendWait('^c')
  Start-Sleep -Milliseconds ${input.copyDelayMs}
  $captured = Get-Clipboard -Raw -ErrorAction SilentlyContinue
  if ($null -eq $captured) { $captured = "" }
  [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($captured))
} finally {
  if (${input.restoreClipboard ? "$true" : "$false"}) {
    if ($hadClipboard) {
      Set-Clipboard -Value $oldClipboard
    } else {
      Set-Clipboard -Value ""
    }
  }
}
`;
  const encoded = (await execFileText("powershell.exe", ["-NoProfile", "-STA", "-Command", script], 15000)).trim();
  if (!encoded) return "";
  return Buffer.from(encoded, "base64").toString("utf8");
}

function powershellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

async function focusWindowsProcess(pid: number): Promise<void> {
  const script = `
$targetPid = ${pid}
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class TechCcHubWindowTools {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$process = Get-Process -Id $targetPid -ErrorAction Stop
if ($process.MainWindowHandle -eq 0) {
  throw "IDEA 进程没有主窗口句柄。"
}
[TechCcHubWindowTools]::ShowWindow($process.MainWindowHandle, 9) | Out-Null
[TechCcHubWindowTools]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
`;

  await execFileText("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], 5000);
}

async function focusLinuxIdeaWindow(): Promise<void> {
  try {
    await execFileText("wmctrl", ["-xa", "jetbrains-idea"], 3000);
  } catch {
    await execFileText("wmctrl", ["-xa", "jetbrains-idea-ce"], 3000);
  }
}

function execFileText(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    execFile(command, args, {
      windowsHide: true,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolvePromise(stdout);
    });
  });
}

function discoverWindowsToolboxScripts(env: NodeJS.ProcessEnv): IdeaInstallation[] {
  const scriptsRoot = env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "JetBrains", "Toolbox", "scripts") : "";
  if (!scriptsRoot || !existsSync(scriptsRoot)) return [];

  return safeReadDir(scriptsRoot)
    .filter((entry) => entry.isFile())
    .map((entry) => join(scriptsRoot, entry.name))
    .filter((scriptPath) => WINDOWS_TOOLBOX_SCRIPT_NAMES.has(basename(scriptPath).toLowerCase()))
    .map((scriptPath) => toInstallation(scriptPath, {
      launcherKind: "toolbox-script",
      source: "toolbox-script",
      displayName: `JetBrains Toolbox ${basename(scriptPath)}`,
    }));
}

function discoverWindowsStandardInstalls(env: NodeJS.ProcessEnv): IdeaInstallation[] {
  const roots = [
    env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "Programs") : "",
    env.ProgramFiles ? join(env.ProgramFiles, "JetBrains") : "",
    env["ProgramFiles(x86)"] ? join(env["ProgramFiles(x86)"], "JetBrains") : "",
    "C:\\Program Files\\JetBrains",
  ].filter(Boolean);

  const installations: IdeaInstallation[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of safeReadDir(root)) {
      if (!entry.isDirectory() || !/IntelliJ IDEA/i.test(entry.name)) continue;
      const installRoot = join(root, entry.name);
      for (const exeName of ["idea64.exe", "idea.exe"]) {
        const launcherPath = join(installRoot, "bin", exeName);
        if (existsSync(launcherPath)) {
          installations.push(toInstallation(launcherPath, {
            launcherKind: "executable",
            source: "standard-install",
            displayName: entry.name,
          }));
          break;
        }
      }
    }
  }
  return installations;
}

function discoverToolboxExecutables(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): IdeaInstallation[] {
  const roots = toolboxRoots(env, platform);
  const installations: IdeaInstallation[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const launcherPath of findIdeaLaunchers(root, platform, 8)) {
      installations.push(toInstallation(launcherPath, {
        launcherKind: platform === "darwin" && launcherPath.endsWith("/idea") ? "mac-app" : "executable",
        source: "toolbox-app",
        displayName: inferDisplayName(launcherPath),
      }));
    }
  }
  return installations;
}

function discoverMacApplications(): IdeaInstallation[] {
  const installations: IdeaInstallation[] = [];
  for (const root of ["/Applications", join(homedir(), "Applications")]) {
    if (!existsSync(root)) continue;
    for (const entry of safeReadDir(root)) {
      if (!entry.isDirectory() || !MAC_IDEA_APP_NAMES.has(entry.name)) continue;
      const launcherPath = join(root, entry.name, "Contents", "MacOS", "idea");
      if (existsSync(launcherPath)) {
        installations.push(toInstallation(launcherPath, {
          launcherKind: "mac-app",
          source: "standard-install",
          displayName: entry.name,
        }));
      }
    }
  }
  return installations;
}

function discoverLinuxExecutables(env: NodeJS.ProcessEnv): IdeaInstallation[] {
  const roots = [
    join(homedir(), ".local", "share", "JetBrains", "Toolbox", "apps"),
    "/opt",
    "/usr/local/bin",
    env.HOME ? join(env.HOME, ".local", "bin") : "",
  ].filter(Boolean);

  const installations: IdeaInstallation[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const launcherPath of findIdeaLaunchers(root, "linux", root === "/opt" ? 4 : 2)) {
      installations.push(toInstallation(launcherPath, {
        launcherKind: "executable",
        source: root.includes("Toolbox") ? "toolbox-app" : "manual",
        displayName: inferDisplayName(launcherPath),
      }));
    }
  }
  return installations;
}

function toolboxRoots(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  if (platform === "win32") {
    return [
      env.LOCALAPPDATA ? join(env.LOCALAPPDATA, "JetBrains", "Toolbox", "apps") : "",
    ].filter(Boolean);
  }
  if (platform === "darwin") {
    return [
      join(homedir(), "Library", "Application Support", "JetBrains", "Toolbox", "apps"),
    ];
  }
  return [
    join(homedir(), ".local", "share", "JetBrains", "Toolbox", "apps"),
  ];
}

function findIdeaLaunchers(root: string, platform: NodeJS.Platform, maxDepth: number): string[] {
  const found: string[] = [];
  const visit = (dir: string, depth: number): void => {
    if (depth > maxDepth) return;
    for (const entry of safeReadDir(dir)) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/^(node_modules|\.git|cache|plugins)$/i.test(entry.name)) continue;
        visit(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const lowerName = entry.name.toLowerCase();
      const normalizedPath = normalize(fullPath).toLowerCase();
      const isIdeaPath = normalizedPath.includes("idea-u")
        || normalizedPath.includes("idea-c")
        || normalizedPath.includes("intellij idea");
      if (!isIdeaPath) continue;
      if (platform === "win32" && (lowerName === "idea64.exe" || lowerName === "idea.exe")) {
        found.push(fullPath);
      } else if (platform !== "win32" && lowerName === "idea") {
        found.push(fullPath);
      }
    }
  };
  visit(root, 0);
  return found;
}

function toInstallation(
  launcherPath: string,
  metadata: Pick<IdeaInstallation, "launcherKind" | "source" | "displayName">,
): IdeaInstallation {
  const version = parseIdeaVersionFromPath(launcherPath);
  const stat = safeStat(launcherPath);
  return {
    id: normalize(launcherPath).toLowerCase(),
    launcherPath,
    launcherKind: metadata.launcherKind,
    source: metadata.source,
    displayName: metadata.displayName,
    edition: inferEdition(launcherPath),
    versionText: version?.text,
    versionParts: version?.parts ?? [],
    mtimeMs: Number(stat?.mtimeMs ?? 0),
  };
}

function inferEdition(filePath: string): IdeaInstallation["edition"] {
  const lower = filePath.toLowerCase();
  if (lower.includes("idea-c") || lower.includes("community")) return "community";
  if (lower.includes("idea-u") || lower.includes("ultimate") || lower.includes("intellij idea")) return "ultimate";
  return "unknown";
}

function inferDisplayName(filePath: string): string {
  const parts = normalize(filePath).split(/[\\/]+/).filter(Boolean);
  const named = [...parts].reverse().find((part) => /IntelliJ IDEA/i.test(part));
  if (named) return named;
  const product = parts.find((part) => /^IDEA-[UC]$/i.test(part));
  const version = parseIdeaVersionFromPath(filePath)?.text;
  return [product ?? "IntelliJ IDEA", version].filter(Boolean).join(" ");
}

function dedupeInstallations(installations: IdeaInstallation[]): IdeaInstallation[] {
  const seen = new Set<string>();
  const result: IdeaInstallation[] = [];
  for (const installation of installations) {
    const key = normalize(installation.launcherPath).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(installation);
  }
  return result;
}

function sourcePriority(installation: IdeaInstallation): number {
  switch (installation.source) {
    case "toolbox-script":
      return 4;
    case "standard-install":
      return 3;
    case "toolbox-app":
      return 2;
    case "manual":
      return 1;
    default:
      return 0;
  }
}

function spawnIdeaLauncher(launcher: IdeaInstallation, args: string[]): { success: boolean; error?: string } {
  try {
    const extension = extname(launcher.launcherPath).toLowerCase();
    const isWindowsScript = process.platform === "win32" && (extension === ".cmd" || extension === ".bat");
    const child = isWindowsScript
      ? spawn(process.env.ComSpec ?? "cmd.exe", [
        "/d",
        "/s",
        "/c",
        [quoteWindowsArg(launcher.launcherPath), ...args.map(quoteWindowsArg)].join(" "),
      ], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      })
      : spawn(launcher.launcherPath, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

    child.unref();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "启动 IntelliJ IDEA 失败。",
    };
  }
}

function quoteWindowsArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function safeReadDir(path: string): Dirent[] {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return [];
  }
}

function safeStat(path: string): Stats | null {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}
