import { existsSync, mkdirSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { dirname, join } from "path";
import { homedir } from "os";
import {
  loadSkillRegistry,
  saveSkillRegistry,
  getDefaultSkillPath,
  type SkillRegistry,
  type SkillScope,
  type SkillSourceKind,
  type SkillSourceRecord,
  type SkillSyncRequest,
  type SkillSyncResponse,
  type SkillSyncResult,
} from "./config-store.js";

const execFileAsync = promisify(execFile);

const DEFAULT_CHECK_INTERVAL_HOURS = 1;
const DEFAULT_GIT_BRANCH = "main";
const DEFAULT_PULL_INTERVAL_MS = 15 * 60_000;

type SchedulerState = {
  timer: ReturnType<typeof setInterval> | null;
  inFlight: boolean;
};

const schedulerState: SchedulerState = { timer: null, inFlight: false };

function nowMs(): number {
  return Date.now();
}

function resolveHomePath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") {
    return getDefaultSkillPath();
  }

  const homePathMatch = /^~[\\/](.*)$/.exec(trimmed);
  if (!homePathMatch) {
    return trimmed;
  }

  const tail = homePathMatch[1];
  if (!tail) {
    return getDefaultSkillPath();
  }

  return join(homedir(), ...tail.split(/[/\\]/).filter(Boolean));
}

function shouldSync(
  source: SkillSourceRecord,
  now: number,
  force: boolean = false,
): boolean {
  if (force) {
    return true;
  }

  const checkEveryHours = Math.max(source.checkEveryHours ?? DEFAULT_CHECK_INTERVAL_HOURS, 1);
  const intervalMs = checkEveryHours * 3600_000;

  return !(source.lastCheckedAt && now - source.lastCheckedAt < intervalMs);
}

async function runGitCommand(cwd: string, args: string[], cwdHint?: string): Promise<string> {
  const workingDir = cwdHint ? cwdHint : cwd;
  const { stdout } = await execFileAsync("git", args, {
    cwd: workingDir,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 2_000_000,
  });
  return stdout.trim();
}

async function getCurrentCommit(path: string): Promise<string> {
  return runGitCommand(path, ["rev-parse", "HEAD"]);
}

async function ensureGitRemote(path: string, gitUrl: string): Promise<void> {
  try {
    await runGitCommand(path, ["remote", "set-url", "origin", gitUrl]);
    return;
  } catch {
    await runGitCommand(path, ["remote", "add", "origin", gitUrl]);
  }
}

async function syncRemoteToLocal(source: SkillSourceRecord): Promise<string> {
  const repoPath = resolveHomePath(source.path);
  const gitUrl = source.gitUrl?.trim();
  if (!gitUrl) {
    throw new Error("远端源缺少 Git URL。");
  }

  const branch = source.branch?.trim() || DEFAULT_GIT_BRANCH;
  const parent = dirname(repoPath);

  if (!existsSync(repoPath)) {
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
    await runGitCommand(parent, ["clone", gitUrl, repoPath], parent);
  } else if (!existsSync(join(repoPath, ".git"))) {
    throw new Error("目标路径已存在但不是 git 仓库，请手动修正该路径。");
  } else {
    await runGitCommand(repoPath, ["fetch", "--all", "--prune"]);
    await ensureGitRemote(repoPath, gitUrl);

    await runGitCommand(repoPath, ["fetch", "--prune"]);
    try {
      await runGitCommand(repoPath, ["checkout", branch]);
    } catch {
      await runGitCommand(repoPath, ["checkout", "-B", branch, `origin/${branch}`]);
    }

    try {
      await runGitCommand(repoPath, ["pull", "--ff-only", "origin", branch]);
    } catch {
      await runGitCommand(repoPath, ["pull", "--ff-only"]);
    }
  }

    return getCurrentCommit(repoPath);
}

function defaultScopeValue(value?: string): SkillScope | undefined {
  return value === "single" ? "single" : value === "bundle" ? "bundle" : undefined;
}

function normalizeSkillForWrite(source: SkillSourceRecord): SkillSourceRecord {
  const kind: SkillSourceKind = source.kind === "remote" ? "remote" : "local";
  return {
    id: source.id || crypto.randomUUID(),
    name: source.name?.trim() || "未命名Skill源",
    kind,
    enabled: source.enabled !== false,
    path: source.path?.trim() || getDefaultSkillPath(),
    gitUrl: kind === "remote" ? (source.gitUrl ?? "").trim() : "",
    scope: kind === "remote" ? defaultScopeValue(source.scope) : undefined,
    branch: kind === "remote" ? source.branch?.trim() || DEFAULT_GIT_BRANCH : undefined,
    lastPulledAt: source.lastPulledAt,
    lastCheckedAt: source.lastCheckedAt,
    checkEveryHours: Math.max(source.checkEveryHours ?? DEFAULT_CHECK_INTERVAL_HOURS, 1),
    lastKnownCommit: source.lastKnownCommit?.trim() || undefined,
    lastError: source.lastError,
  };
}

async function syncSingleRemoteSource(
  source: SkillSourceRecord,
  options: SkillSyncRequest,
): Promise<{ result: SkillSyncResult; source: SkillSourceRecord }> {
  const current = normalizeSkillForWrite(source);
  const sourceName = current.name || "未命名Skill源";
  const checkedAt = nowMs();

  if (!current.enabled) {
    return {
      result: {
        sourceId: current.id,
        sourceName,
        status: "skipped",
        message: "技能源未启用",
        checkedAt,
      },
      source: { ...current, lastCheckedAt: checkedAt },
    };
  }

  if (!shouldSync(current, checkedAt, options.force)) {
    return {
      result: {
        sourceId: current.id,
        sourceName,
        status: "skipped",
        message: "未到检查周期",
        checkedAt,
      },
      source: { ...current, lastCheckedAt: checkedAt },
    };
  }

  const previousCommit = current.lastKnownCommit;
  try {
    const latestCommit = await syncRemoteToLocal(current);
    const updatedSource: SkillSourceRecord = {
      ...current,
      path: current.path,
      lastCheckedAt: checkedAt,
      lastPulledAt: checkedAt,
      lastKnownCommit: latestCommit,
      lastError: undefined,
    };

    const status = previousCommit && previousCommit !== latestCommit ? "updated" : "checked";
    return {
      result: {
        sourceId: current.id,
        sourceName,
        status,
        message: status === "updated" ? "已更新到最新版本" : "版本无变化",
        previousCommit,
        latestCommit,
        checkedAt,
      },
      source: updatedSource,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      result: {
        sourceId: current.id,
        sourceName,
        status: "error",
        message,
        checkedAt,
      },
      source: {
        ...current,
        lastCheckedAt: checkedAt,
        lastError: message,
      },
    };
  }
}

async function runDueSync(sources: SkillSourceRecord[], options: SkillSyncRequest): Promise<SkillSyncResponse> {
  const ids = options.sourceIds;
  const targetSet = ids && ids.length > 0 ? new Set(ids) : null;
  const targets = sources
    .map((source) => ({ ...normalizeSkillForWrite(source) }))
    .filter((source) => source.kind === "remote");

  const results: SkillSyncResult[] = [];
  const nextSources = sources.map((source) => normalizeSkillForWrite(source));

  for (const target of targets) {
    if (targetSet && !targetSet.has(target.id)) {
      continue;
    }

    const index = nextSources.findIndex((item) => item.id === target.id);
    const { result, source } = await syncSingleRemoteSource(target, {
      ...options,
      force: options.force === true,
    });
    if (index >= 0) {
      nextSources[index] = source;
    }
    results.push(result);
  }

  const nextRegistry: SkillRegistry = { sources: nextSources };
  saveSkillRegistry(nextRegistry);

  return { results };
}

export async function syncSkillSources(options: SkillSyncRequest = {}): Promise<SkillSyncResponse> {
  const registry = loadSkillRegistry();
  return runDueSync(registry.sources, options);
}

async function executePeriodicSync(): Promise<void> {
  if (schedulerState.inFlight) {
    return;
  }

  schedulerState.inFlight = true;
  try {
    await syncSkillSources();
  } catch (error) {
    console.error("[skill-sync] Scheduled sync failed:", error);
  } finally {
    schedulerState.inFlight = false;
  }
}

export function startSkillSyncScheduler(): void {
  if (schedulerState.timer) {
    return;
  }

  void executePeriodicSync();
  schedulerState.timer = setInterval(() => {
    void executePeriodicSync();
  }, DEFAULT_PULL_INTERVAL_MS);
}

export function stopSkillSyncScheduler(): void {
  if (!schedulerState.timer) {
    return;
  }

  clearInterval(schedulerState.timer);
  schedulerState.timer = null;
}
