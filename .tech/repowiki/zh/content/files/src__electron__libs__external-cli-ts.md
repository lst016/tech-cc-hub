# src/electron/libs/external-cli.ts

> 模块：`electron` · 语言：`typescript` · 行数：188

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `uniqueExistingDirs@22`
- `getVoltaNodeImageDirs@34`
- `getDefaultWindowsCliDirs@46`
- `splitPathEntries@58`
- `buildExternalCliEnv@69`
- `hasPathSeparator@91`
- `resolveFromDirectory@95`
- `quoteWindowsCmdArgument@103`
- `buildWindowsCmdLine@111`
- `wrapWindowsCmdLineForSlashS@115`
- `resolveExternalCliCommand@119`
- `prepareExternalCliCommand@141`
- `runExternalCli@169`
- `WINDOWS_COMMAND_EXTENSIONS@20`
- `seen@24`
- `normalized@27`
- `nodeImageRoot@37`
- `localAppData@48`
- `appData@49`
- `pathEntries@74`
- `normalizedEnv@79`
- `extension@97`
- `candidates@98`
- `escaped@106`
- `trimmed@124`
- `dir@129`
- `base@130`
- `resolved@135`
- `mergedEnv@143`
- `resolvedCommand@144`
- `prepared@171`
- `CliEnv@5`
- `RunExternalCliOptions@7`
- `PreparedExternalCliCommand@13`

## 依赖输入

- `child_process`
- `fs`
- `path`
- `os`

## 对外暴露

- `buildExternalCliEnv`
- `resolveExternalCliCommand`
- `prepareExternalCliCommand`
- `runExternalCli`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { execFile } from "child_process";
import { existsSync, readdirSync } from "fs";
import { delimiter, dirname, extname, isAbsolute, join } from "path";
import { homedir } from "os";

type CliEnv = Record<string, string | undefined>;

type RunExternalCliOptions = {
  timeout?: number;
  cwd?: string;
  env?: CliEnv;
};

type PreparedExternalCliCommand = {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  windowsVerbatimArguments?: boolean;
};

const WINDOWS_COMMAND_EXTENSIONS = [".cmd", ".exe", ".bat", ".com", ".ps1", ""];

function uniqueExistingDirs(dirs: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const dir of dirs) {
    const normalized = dir?.trim();
    if (!normalized || seen.has(normalized.toLowerCase()) || !existsSync(normalized)) continue;
    seen.add(normalized.toLowerCase());
    result.push(normalized);
  }
  return result;
}

function getVoltaNodeImageDirs(localAppData: string | undefined): string[] {
  if (!localAppData) return [];
  const nodeImageRoot = join(localAppData, "Volta", "tools", "image", "node");
  try {
    return readdirSync(nodeImageRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(nodeImageRoot, entry.name));
  } catch {
    return [];
  }
}

function getDefaultWindowsCliDirs(env: CliEnv): string[] {
  const localAppData = env.LOCALAPPDATA ?? join(env.USERPROFILE ?? homedir(), "AppData", "Local");
  const appData = env.APPDATA ?? join(env.USERPROFILE ?? homedir(), "AppData", "Roaming");
  return uniqueExistingDirs([
    join(localAppData, "Volta", "bin"),
    ...getVoltaNodeImageDirs(localAppData),
    join(appData, "npm"),
    env.ProgramFiles ? join(env.ProgramFiles, "Volta") : undefined,
    env["ProgramFiles(x86)"] ? join(env["ProgramFiles(x86)"], "Volta") : undefined,
  ]);
}

function splitPathEntries(env: CliEnv): string[] {
  return Object.entries(env)
    .filter(([key]) => key.toLowerCase() === "path")
    .map(([, value]) => value)
    .filter((value): value is string => Boolean(value))
    .join(delimiter)
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildExternalCliEnv(env: CliEnv = process.env): NodeJS.ProcessEnv {
  if (process.platform !== "win32") {
    return { ...env } as NodeJS.ProcessEnv;
  }

  const pathEntries = uniqueExistingDirs([
    ...splitPathEntries(env),
    ...getDefaultWindowsCliDirs(env),
  ]);
  const normalizedEnv = { ...env };
  for (const key of Object.keys(normalizedEnv)) {
    if (key.toLowerCase() === "path") {
      delete normalizedEnv[key];
    }
  }

  return {
    ...normalizedEnv,
    Path: pathEntries.join(delimiter),
  } as NodeJS.ProcessEnv;
}

function hasPathSeparator(command: string): boolean {
  return command.includes("/") || command.includes("\\");
}

function resolveFromDirectory(dir: string, command: string): string | null {
  const extension = extname(command);
  const candidates = extension
    ? [join(dir, command)]
    : WINDOWS_COMMAND_EXTENSIONS.map((candidateExtension) => join(dir, `${command}${candidateExtension}`));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function quoteWindowsCmdArgument(value: string): string {
  if (value.length === 0) return "\"\"";
  const escaped = value
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/\\+$/g, "$&$&");
  return `"${escaped}"`;
}

function buildWindowsCmdLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteWindowsCmdArgument).join(" ");
}

function wrapWindowsCmdLineForSlashS(commandLine: string): string {
  return `"${commandLine}"`;
}

export function resolveExternalCliCommand(command: string, env: CliEnv = process.env): string {
  if (process.platform !== "win32") {
    return command;
  }

  const trimmed = command.trim();
  if (!trimmed) return command;

  if (hasPathSeparator(trimmed) || isAbsolute(trimmed)) {
    const dir = dirname(trimmed);
    const base = trimmed.slice(dir.length + 1);
    return resolveFromDirectory(dir, base) ?? trimmed;
  }

  for (const dir of splitPathEntries(buildExternalCliEnv(env))) {
    const
... (truncated)
```
