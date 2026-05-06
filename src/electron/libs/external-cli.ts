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
    const resolved = resolveFromDirectory(dir, trimmed);
    if (resolved) return resolved;
  }

  return trimmed;
}

export function prepareExternalCliCommand(command: string, args: string[], env: CliEnv = process.env): PreparedExternalCliCommand {
  const mergedEnv = buildExternalCliEnv(env);
  const resolvedCommand = resolveExternalCliCommand(command, mergedEnv);

  if (process.platform !== "win32") {
    return { command: resolvedCommand, args, env: mergedEnv };
  }

  if (/\.(cmd|bat)$/i.test(resolvedCommand)) {
    return {
      command: process.env.COMSPEC || "cmd.exe",
      args: ["/d", "/s", "/c", resolvedCommand, ...args],
      env: mergedEnv,
    };
  }

  if (/\.ps1$/i.test(resolvedCommand)) {
    return {
      command: "powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolvedCommand, ...args],
      env: mergedEnv,
    };
  }

  return { command: resolvedCommand, args, env: mergedEnv };
}

export function runExternalCli(command: string, args: string[], options: RunExternalCliOptions = {}): Promise<{ stdout: string; stderr: string }> {
  const prepared = prepareExternalCliCommand(command, args, options.env ?? process.env);
  return new Promise((resolve, reject) => {
    execFile(prepared.command, prepared.args, {
      timeout: options.timeout,
      cwd: options.cwd,
      env: prepared.env,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}
