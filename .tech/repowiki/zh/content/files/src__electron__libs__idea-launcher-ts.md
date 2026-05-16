# src/electron/libs/idea-launcher.ts

> 模块：`electron` · 语言：`typescript` · 行数：728

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `parseIdeaVersionFromPath@102`
- `compareVersionParts@113`
- `selectBestIdeaInstallation@123`
- `buildIdeaOpenArgs@146`
- `parseWindowsTasklistCsv@157`
- `parseCsvLine@173`
- `discoverIdeaInstallations@202`
- `getIdeaStatus@222`
- `openIdea@234`
- `focusIdea@307`
- `waitForIdeaReady@352`
- `listRunningIdeaProcesses@392`
- `clampWaitMs@417`
- `focusWindowsProcess@422`
- `focusLinuxIdeaWindow@444`
- `execFileText@452`
- `discoverWindowsToolboxScripts@468`
- `discoverWindowsStandardInstalls@483`
- `discoverToolboxExecutables@513`
- `discoverMacApplications@529`
- `discoverLinuxExecutables@548`
- `toolboxRoots@570`
- `findIdeaLaunchers@586`
- `toInstallation@615`
- `inferEdition@634`
- `inferDisplayName@641`
- `dedupeInstallations@650`
- `sourcePriority@662`
- `spawnIdeaLauncher@677`
- `quoteWindowsArg@708`
- `safeReadDir@712`
- `safeStat@720`
- `WINDOWS_IDEA_PROCESS_NAMES@98`
- `WINDOWS_TOOLBOX_SCRIPT_NAMES@100`
- `MAC_IDEA_APP_NAMES@101`
- `normalizedPath@104`
- `namedVersion@105`
- `genericVersion@106`
- `toolboxBuild@107`
- `raw@108`

## 依赖输入

- `node:child_process`
- `node:os`
- `node:timers/promises`
- `node:fs`
- `node:path`

## 对外暴露

- `IdeaEdition`
- `IdeaLauncherKind`
- `IdeaInstallation`
- `RunningIdeaProcess`
- `IdeaStatus`
- `IdeaOpenInput`
- `IdeaOpenResult`
- `IdeaFocusResult`
- `IdeaWaitReadyInput`
- `IdeaWaitReadyResult`
- `parseIdeaVersionFromPath`
- `compareVersionParts`
- `selectBestIdeaInstallation`
- `buildIdeaOpenArgs`
- `parseWindowsTasklistCsv`
- `parseCsvLine`
- `discoverIdeaInstallations`
- `getIdeaStatus`
- `openIdea`
- `focusIdea`
- `waitForIdeaReady`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  error?: string;
  note?: string;
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

export function buildIdeaOpenArgs(inp
... (truncated)
```
