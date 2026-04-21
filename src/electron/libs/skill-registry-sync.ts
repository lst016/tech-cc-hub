import { execFile } from "child_process";
import { app } from "electron";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { promisify } from "util";

import {
  loadSkillInventory,
  saveSkillInventory,
  type InstalledSkillRecord,
  type SkillInventory,
  type SkillSyncRequest,
  type SkillSyncResponse,
  type SkillSyncResult,
} from "./config-store.js";

const execFileAsync = promisify(execFile);

const DEFAULT_CHECK_INTERVAL_HOURS = 24;
const DEFAULT_GIT_BRANCH = "main";
const DEFAULT_PULL_INTERVAL_MS = 15 * 60_000;
const SKILL_REPO_CACHE_DIR_NAME = "skill-repo-cache";

type SchedulerState = {
  timer: ReturnType<typeof setInterval> | null;
  inFlight: boolean;
};

type CachedRepoState = {
  repoPath: string;
  commit: string;
};

const schedulerState: SchedulerState = { timer: null, inFlight: false };

function nowMs(): number {
  return Date.now();
}

function shouldSync(
  skill: InstalledSkillRecord,
  now: number,
  force: boolean = false,
): boolean {
  if (skill.sourceType !== "git") {
    return false;
  }

  if (force) {
    return true;
  }

  const checkEveryHours = Math.max(skill.checkEveryHours ?? DEFAULT_CHECK_INTERVAL_HOURS, 1);
  const intervalMs = checkEveryHours * 3600_000;

  return !(skill.lastCheckedAt && now - skill.lastCheckedAt < intervalMs);
}

async function runGitCommand(cwd: string, args: string[], cwdHint?: string): Promise<string> {
  const workingDir = cwdHint ?? cwd;
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

async function ensureGitRemote(path: string, remoteUrl: string): Promise<void> {
  try {
    await runGitCommand(path, ["remote", "set-url", "origin", remoteUrl]);
    return;
  } catch {
    await runGitCommand(path, ["remote", "add", "origin", remoteUrl]);
  }
}

function getRepoCachePath(remoteUrl: string): string {
  const cacheKey = Buffer.from(remoteUrl).toString("base64url").slice(0, 80) || "repo";
  return join(app.getPath("userData"), SKILL_REPO_CACHE_DIR_NAME, cacheKey);
}

async function ensureCachedRepo(
  remoteUrl: string,
  branch: string,
  cache: Map<string, Promise<CachedRepoState>>,
): Promise<CachedRepoState> {
  const cacheKey = `${remoteUrl}#${branch}`;
  const existing = cache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const checkoutPromise = (async () => {
    const repoPath = getRepoCachePath(remoteUrl);
    const parent = dirname(repoPath);

    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }

    if (!existsSync(join(repoPath, ".git"))) {
      if (existsSync(repoPath)) {
        rmSync(repoPath, { recursive: true, force: true });
      }
      await runGitCommand(parent, ["clone", remoteUrl, repoPath], parent);
    }

    await ensureGitRemote(repoPath, remoteUrl);
    await runGitCommand(repoPath, ["fetch", "--all", "--prune"]);

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

    return {
      repoPath,
      commit: await getCurrentCommit(repoPath),
    };
  })();

  cache.set(cacheKey, checkoutPromise);
  try {
    return await checkoutPromise;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
}

function clearDirectoryContents(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    return;
  }

  for (const entry of readdirSync(path)) {
    rmSync(join(path, entry), { recursive: true, force: true });
  }
}

async function syncRepoSnapshotSkill(
  skill: InstalledSkillRecord,
  remoteUrl: string,
  branch: string,
  cache: Map<string, Promise<CachedRepoState>>,
): Promise<string> {
  const remoteSubpath = skill.remoteSubpath?.trim();
  if (!remoteSubpath) {
    throw new Error("当前 skill 缺少仓库内路径，无法从远端仓库同步。");
  }

  const { repoPath, commit } = await ensureCachedRepo(remoteUrl, branch, cache);
  const sourcePath = join(repoPath, ...remoteSubpath.split(/[\\/]/).filter(Boolean));
  if (!existsSync(sourcePath)) {
    throw new Error(`远端仓库中未找到技能目录：${remoteSubpath}`);
  }

  clearDirectoryContents(skill.path);
  cpSync(sourcePath, skill.path, {
    recursive: true,
    force: true,
  });

  return commit;
}

async function syncRemoteToLocal(
  skill: InstalledSkillRecord,
  cache: Map<string, Promise<CachedRepoState>>,
): Promise<string> {
  const repoPath = skill.path.trim();
  const remoteUrl = skill.remoteUrl?.trim();
  if (!remoteUrl) {
    throw new Error("缺少远程 Git 地址。");
  }

  const branch = skill.branch?.trim() || DEFAULT_GIT_BRANCH;
  const parent = dirname(repoPath);

  if (!existsSync(repoPath)) {
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
    await runGitCommand(parent, ["clone", remoteUrl, repoPath], parent);
    return getCurrentCommit(repoPath);
  }

  if (!existsSync(join(repoPath, ".git"))) {
    return syncRepoSnapshotSkill(skill, remoteUrl, branch, cache);
  }

  await runGitCommand(repoPath, ["fetch", "--all", "--prune"]);
  await ensureGitRemote(repoPath, remoteUrl);

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

  return getCurrentCommit(repoPath);
}

function normalizeSkillForWrite(skill: InstalledSkillRecord): InstalledSkillRecord {
  const sourceType = skill.sourceType === "git" ? "git" : "manual";
  return {
    id: skill.id || crypto.randomUUID(),
    name: skill.name?.trim() || "未命名 Skill",
    kind: skill.kind === "bundle" ? "bundle" : "single",
    path: skill.path?.trim() || "",
    sourceType,
    installedAt: skill.installedAt,
    syncEnabled: sourceType === "git",
    remoteUrl: sourceType === "git" ? skill.remoteUrl?.trim() || undefined : undefined,
    remoteSubpath: sourceType === "git" ? skill.remoteSubpath?.trim() || undefined : undefined,
    branch: sourceType === "git" ? skill.branch?.trim() || DEFAULT_GIT_BRANCH : undefined,
    lastPulledAt: skill.lastPulledAt,
    lastCheckedAt: skill.lastCheckedAt,
    checkEveryHours: sourceType === "git"
      ? Math.max(skill.checkEveryHours ?? DEFAULT_CHECK_INTERVAL_HOURS, 1)
      : undefined,
    lastKnownCommit: skill.lastKnownCommit?.trim() || undefined,
    lastError: skill.lastError,
  };
}

async function syncSingleSkill(
  skill: InstalledSkillRecord,
  options: SkillSyncRequest,
  cache: Map<string, Promise<CachedRepoState>>,
): Promise<{ result: SkillSyncResult; skill: InstalledSkillRecord }> {
  const current = normalizeSkillForWrite(skill);
  const skillName = current.name || "未命名 Skill";
  const checkedAt = nowMs();

  if (current.sourceType !== "git") {
    return {
      result: {
        skillId: current.id,
        skillName,
        status: "skipped",
        message: "当前是手动安装，还没有配置 Git 跟踪。",
        checkedAt,
      },
      skill: { ...current, lastCheckedAt: checkedAt },
    };
  }

  if (!shouldSync(current, checkedAt, options.force)) {
    return {
      result: {
        skillId: current.id,
        skillName,
        status: "skipped",
        message: "还没到下一次检查时间。",
        checkedAt,
      },
      skill: { ...current, lastCheckedAt: checkedAt },
    };
  }

  const previousCommit = current.lastKnownCommit;
  try {
    const latestCommit = await syncRemoteToLocal(current, cache);
    const updatedSkill: InstalledSkillRecord = {
      ...current,
      lastCheckedAt: checkedAt,
      lastPulledAt: checkedAt,
      lastKnownCommit: latestCommit,
      lastError: undefined,
    };

    const status = previousCommit && previousCommit !== latestCommit ? "updated" : "checked";
    return {
      result: {
        skillId: current.id,
        skillName,
        status,
        message: status === "updated" ? "已拉取到最新版本。" : "远端没有新提交。",
        previousCommit,
        latestCommit,
        checkedAt,
      },
      skill: updatedSkill,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      result: {
        skillId: current.id,
        skillName,
        status: "error",
        message,
        checkedAt,
      },
      skill: {
        ...current,
        lastCheckedAt: checkedAt,
        lastError: message,
      },
    };
  }
}

async function runDueSync(
  inventory: SkillInventory,
  options: SkillSyncRequest,
): Promise<SkillSyncResponse> {
  const ids = options.skillIds;
  const targetSet = ids && ids.length > 0 ? new Set(ids) : null;
  const nextSkills = inventory.skills.map((skill) => normalizeSkillForWrite(skill));
  const results: SkillSyncResult[] = [];
  const remoteCache = new Map<string, Promise<CachedRepoState>>();

  for (const target of nextSkills) {
    if (target.sourceType !== "git") {
      continue;
    }
    if (targetSet && !targetSet.has(target.id)) {
      continue;
    }

    const index = nextSkills.findIndex((item) => item.id === target.id);
    const { result, skill } = await syncSingleSkill(target, {
      ...options,
      force: options.force === true,
    }, remoteCache);
    if (index >= 0) {
      nextSkills[index] = skill;
    }
    results.push(result);
  }

  saveSkillInventory({
    rootPath: inventory.rootPath,
    skills: nextSkills,
  });

  return { results };
}

export async function syncSkillSources(options: SkillSyncRequest = {}): Promise<SkillSyncResponse> {
  const inventory = loadSkillInventory();
  return runDueSync(inventory, options);
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
