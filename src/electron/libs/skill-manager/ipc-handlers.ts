// Source: CV from skills-manager Tauri commands (skills.rs, scenarios.rs, sync.rs, scan.rs, browse.rs, tools.rs)
// Adapted for Electron ipcMain.handle pattern

import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { ipcMain, app } from "electron";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import { basename, join, relative, resolve, sep } from "path";
import { tmpdir } from "os";
import * as db from "./db.js";
import { getDb } from "./db.js";
import { ensureCentralRepo } from "./central-repo.js";
import {
  getAllSkills,
  getSkillById,
  deleteSkill,
} from "./db.js";
import {
  getAllScenarios,
  getActiveScenarioId,
  getAllTargets,
  getTagsMap,
  getScenariosForSkill,
  getSkillsForScenario as getSkillsForScenarioDb,
} from "./db.js";
import {
  defaultToolAdapters,
  allToolAdapters,
  enabledInstalledAdapters,
  findAdapterWithStore,
  isInstalled,
  skillsDir as adapterSkillsDir,
  type ToolAdapter,
} from "./tool-adapters.js";
import { installFromLocal, installSkillDirToDestination, hashLocalSource, resolveLocalSkillName } from "./installer.js";
import { inferSkillName, is_valid_skill_dir, hashDirectory, parseSkillMd } from "./sync-engine.js";
import {
  getAllScenarioDtos,
  getActiveScenarioDto,
  createScenario,
  updateScenarioInfo,
  deleteScenarioAndCleanup,
  applyScenarioToDefault,
  addSkillToScenarioAndSync,
  removeSkillFromScenarioAndSync,
  reorderScenarioList,
  toScenarioDto,
  ensureDefaultScenario,
} from "./scenarios.js";
import {
  scanLocalSkills as scanLocalSkillsFn,
  groupDiscovered,
  matchImportedSkillId,
} from "./scanner.js";
import {
  fetchLeaderboard,
  searchSkillssh,
} from "./marketplace.js";
import { skillsDir } from "./central-repo.js";
import {
  syncSkill,
  removeTarget,
  targetDirName,
  syncModeForTool,
  isTargetCurrent,
} from "./sync-engine.js";
import type {
  ManagedSkill,
  SkillToolToggle,
  SkillDocument,
  SourceSkillDocument,
  Scenario,
  ToolInfo,
  ScanResult,
  SkillsShSkill,
  BatchImportResult,
  BatchDeleteSkillsResult,
  BatchUpdateSkillsResult,
  UpdateSkillResult,
  GitPreviewResult,
  SkillTarget,
} from "./types.js";

// -- Init --

let initialized = false;

type SkillIpcHandler = (...args: any[]) => unknown | Promise<unknown>;

const skillIpcHandlers = new Map<string, SkillIpcHandler>();

function registerSkillIpcHandler(channel: string, handler: SkillIpcHandler): void {
  skillIpcHandlers.set(channel, handler);
  ipcMain.handle(channel, (_event: any, ...args: any[]) => {
    initSkillManager();
    return handler(...args);
  });
}

export async function handleSkillManagerInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  initSkillManager();
  const handler = skillIpcHandlers.get(channel);
  if (!handler || !channel.startsWith("skills:")) {
    throw new Error(`Unsupported skill manager channel: ${channel}`);
  }
  return await handler(...args);
}

export function initSkillManager(): void {
  if (initialized) return;

  try {
    // Ensure DB and central repo dirs exist
    getDb(); // triggers migration
    ensureCentralRepo();
    ensureDefaultScenario();
    initialized = true;
  } catch (err) {
    console.error("[skill-manager] init failed:", err);
  }
}

// -- Helpers --

function managedSkillToDto(skill: ReturnType<typeof getAllSkills>[number]): ManagedSkill {
  const allTargets = getAllTargets();
  const tagsMap = getTagsMap();

  const targets: SkillTarget[] = allTargets
    .filter((t) => t.skill_id === skill.id)
    .map((t) => ({
      id: t.id,
      skill_id: t.skill_id,
      tool: t.tool,
      target_path: t.target_path,
      mode: t.mode,
      status: t.status,
      synced_at: t.synced_at,
    }));

  const scenario_ids = getScenariosForSkill(skill.id);
  const tags = tagsMap[skill.id] || [];

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    source_type: skill.source_type,
    source_ref: skill.source_ref,
    source_ref_resolved: skill.source_ref_resolved,
    source_subpath: skill.source_subpath,
    source_branch: skill.source_branch,
    source_revision: skill.source_revision,
    remote_revision: skill.remote_revision,
    central_path: skill.central_path,
    content_hash: skill.content_hash,
    enabled: skill.enabled,
    created_at: skill.created_at,
    updated_at: skill.updated_at,
    status: skill.status,
    update_status: skill.update_status,
    last_checked_at: skill.last_checked_at,
    last_check_error: skill.last_check_error,
    targets,
    scenario_ids,
    tags,
  };
}

function managedSkillById(id: string): ManagedSkill {
  const skill = getSkillById(id);
  if (!skill) throw new Error("Skill not found");
  return managedSkillToDto(skill);
}

function reimportLocalSkill(skillId: string): ManagedSkill {
  const skill = getSkillById(skillId);
  if (!skill) throw new Error("Skill not found");

  if (skill.source_type !== "local" && skill.source_type !== "import") {
    throw new Error("Only local skills can be reimported");
  }

  const sourcePath = skill.source_ref;
  if (!sourcePath) throw new Error("Local skill is missing its original source path");
  if (!existsSync(sourcePath)) throw new Error("Original source path no longer exists");

  const stagedPath = skill.central_path.replace(
    new RegExp(`${skill.name}$`),
    `.${skill.name}.staged-${randomUUID()}`,
  );
  const result = installSkillDirToDestination(sourcePath, skill.name, stagedPath);
  const backupPath = skill.central_path + `.backup-${randomUUID()}`;

  if (existsSync(skill.central_path)) {
    renameSync(skill.central_path, backupPath);
  }
  try {
    renameSync(stagedPath, skill.central_path);
  } catch (e) {
    if (existsSync(backupPath)) {
      try { renameSync(backupPath, skill.central_path); } catch { /* ignore */ }
    }
    throw e;
  }
  try { rmSync(backupPath, { recursive: true, force: true }); } catch { /* ignore */ }

  db.updateSkillAfterInstall(
    skillId, skill.name, result.description ?? null,
    null, null, result.content_hash, "local_only",
  );

  const targets = db.getTargetsForSkill(skillId) as Array<{ target_path: string; mode: string }>;
  for (const t of targets) {
    if (t.mode !== "copy") continue;
    syncSkill(skill.central_path, t.target_path, "copy");
  }

  return managedSkillById(skillId);
}

function findSkillDir(root: string, skillId: string): string {
  const directCandidates = [
    join(root, skillId),
    join(root, "skills", skillId),
    join(root, ".agents", "skills", skillId),
  ];
  for (const candidate of directCandidates) {
    if (is_valid_skill_dir(candidate)) return candidate;
  }

  const queue = [root];
  const ignored = new Set([".git", "node_modules", "target", "dist", "build", ".next", ".turbo", "vendor"]);
  for (let index = 0; index < queue.length && index < 5000; index++) {
    const dir = queue[index];
    if (is_valid_skill_dir(dir)) {
      const tail = dir.split(/[\\/]/).pop();
      if (tail === skillId) return dir;
    }

    let entries: Array<{ isDirectory: () => boolean; name: string }>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue;
      queue.push(join(dir, entry.name));
    }
  }

  for (const dir of queue) {
    if (is_valid_skill_dir(dir)) return dir;
  }

  throw new Error(`No skill directory found for ${skillId}`);
}

function installSkillsshSkill(source: string, skillId: string): ManagedSkill {
  const normalizedSource = source.trim().replace(/^\/+|\/+$/g, "");
  const normalizedSkillId = skillId.trim().replace(/^\/+|\/+$/g, "");
  if (!normalizedSource || !normalizedSkillId) {
    throw new Error("skills.sh source and skill id are required");
  }

  const sourceRef = `${normalizedSource}/${normalizedSkillId}`;
  const existing = db.getSkillBySourceRef("skillssh", sourceRef);
  if (existing) {
    const activeId = getActiveScenarioId();
    if (activeId) addSkillToScenarioAndSync(existing.id, activeId);
    return managedSkillToDto(existing);
  }

  const repoUrl = `https://github.com/${normalizedSource}.git`;
  const tempDir = mkdtempSync(join(tmpdir(), "tech-cc-skillssh-"));
  try {
    execFileSync("git", ["clone", "--depth", "1", repoUrl, tempDir], { stdio: "pipe" });
    let revision: string | null = null;
    try {
      revision = execFileSync("git", ["-C", tempDir, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
    } catch {
      revision = null;
    }

    const skillDir = findSkillDir(tempDir, normalizedSkillId);
    const result = installFromLocal(skillDir, normalizedSkillId);
    const now = Date.now();
    const id = randomUUID();
    const subpath = relative(tempDir, skillDir) || null;

    db.insertSkill({
      id,
      name: result.name,
      description: result.description ?? null,
      source_type: "skillssh",
      source_ref: sourceRef,
      source_ref_resolved: repoUrl,
      source_subpath: subpath,
      source_branch: null,
      source_revision: revision,
      remote_revision: revision,
      central_path: result.central_path,
      content_hash: result.content_hash,
      enabled: true,
      created_at: now,
      updated_at: now,
      status: "ok",
      update_status: "up_to_date",
      last_checked_at: now,
      last_check_error: null,
    });

    const activeId = getActiveScenarioId();
    if (activeId) addSkillToScenarioAndSync(id, activeId);

    return managedSkillById(id);
  } catch (error) {
    throw new Error(`Install from skills.sh failed: ${String(error)}`);
  } finally {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

const GIT_PREVIEW_TEMP_PREFIX = "tech-cc-skill-git-";

type GitInstallSelection = {
  dir_name: string;
  name?: string;
  selected?: boolean;
};

type GitInstallResult = {
  installed: number;
  updated: number;
  skipped: number;
  errors: string[];
};

function normalizeGitRepoUrl(repoUrl: string): string {
  const normalized = repoUrl.trim();
  if (!normalized) {
    throw new Error("Git repository URL is required");
  }
  if (/[\r\n]/.test(normalized)) {
    throw new Error("Git repository URL cannot contain newlines");
  }
  return normalized;
}

function cloneGitRepo(repoUrl: string): string {
  const normalizedRepoUrl = normalizeGitRepoUrl(repoUrl);
  const tempDir = mkdtempSync(join(tmpdir(), GIT_PREVIEW_TEMP_PREFIX));
  try {
    execFileSync("git", ["clone", "--depth", "1", normalizedRepoUrl, tempDir], {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 120_000,
    });
    return tempDir;
  } catch (error) {
    cleanupGitPreviewTempDir(tempDir);
    throw new Error(`Git clone failed: ${extractProcessErrorMessage(error)}`);
  }
}

function extractProcessErrorMessage(error: unknown): string {
  const value = error as { stderr?: Buffer | string; stdout?: Buffer | string; message?: string };
  const stderr = value.stderr ? String(value.stderr).trim() : "";
  const stdout = value.stdout ? String(value.stdout).trim() : "";
  return stderr || stdout || value.message || String(error);
}

function readGitRepoMetadata(tempDir: string): { repoUrl: string; revision: string | null; branch: string | null } {
  const repoUrl = execFileSync("git", ["-C", tempDir, "remote", "get-url", "origin"], {
    encoding: "utf-8",
    stdio: "pipe",
  }).trim();

  let revision: string | null = null;
  try {
    revision = execFileSync("git", ["-C", tempDir, "rev-parse", "HEAD"], {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
  } catch {
    revision = null;
  }

  let branch: string | null = null;
  try {
    const value = execFileSync("git", ["-C", tempDir, "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    branch = value && value !== "HEAD" ? value : null;
  } catch {
    branch = null;
  }

  return { repoUrl, revision, branch };
}

function discoverGitSkillDirs(root: string): string[] {
  const result: string[] = [];
  const queue = [root];
  const ignored = new Set([
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "dist",
    "build",
    "target",
    "vendor",
    ".next",
    ".turbo",
  ]);

  for (let index = 0; index < queue.length && index < 5000; index++) {
    const dir = queue[index];
    if (is_valid_skill_dir(dir)) {
      result.push(dir);
      continue;
    }

    let entries: Array<{ isDirectory: () => boolean; name: string }>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue;
      queue.push(join(dir, entry.name));
    }
  }

  return result.sort((a, b) => relative(root, a).localeCompare(relative(root, b), "en"));
}

function previewGitInstall(repoUrl: string): GitPreviewResult {
  const tempDir = cloneGitRepo(repoUrl);
  const skillDirs = discoverGitSkillDirs(tempDir);
  if (skillDirs.length === 0) {
    cleanupGitPreviewTempDir(tempDir);
    throw new Error("No skill directory containing SKILL.md was found in this repository");
  }

  return {
    temp_dir: tempDir,
    skills: skillDirs.map((dir) => {
      const meta = parseSkillMd(dir);
      const dirName = relative(tempDir, dir) || ".";
      return {
        dir_name: dirName,
        name: inferSkillName(dir),
        description: meta.description,
      };
    }),
  };
}

function isSafeGitPreviewTempDir(tempDir: string): boolean {
  const resolvedTempDir = resolve(tempDir);
  const tempRoot = resolve(tmpdir());
  return basename(resolvedTempDir).startsWith(GIT_PREVIEW_TEMP_PREFIX)
    && (resolvedTempDir === tempRoot || resolvedTempDir.startsWith(tempRoot + sep));
}

function resolveGitPreviewSkillDir(tempDir: string, dirName: string): string {
  if (!isSafeGitPreviewTempDir(tempDir)) {
    throw new Error("Invalid Git preview temp directory");
  }
  if (!dirName || dirName.includes("\0")) {
    throw new Error("Invalid Git skill directory");
  }
  const resolvedTempDir = resolve(tempDir);
  const skillDir = resolve(resolvedTempDir, dirName);
  if (skillDir !== resolvedTempDir && !skillDir.startsWith(resolvedTempDir + sep)) {
    throw new Error("Git skill directory must be inside the preview temp directory");
  }
  if (!is_valid_skill_dir(skillDir)) {
    throw new Error(`Valid skill directory not found: ${dirName}`);
  }
  return skillDir;
}

function gitSourceRef(repoUrl: string, subpath: string | null): string {
  return subpath ? `${repoUrl}#${subpath.replace(/\\/g, "/")}` : repoUrl;
}

function installGitSkillSelection(
  tempDir: string,
  selection: GitInstallSelection,
  repoMeta: { repoUrl: string; revision: string | null; branch: string | null },
): "installed" | "updated" | "skipped" {
  if (selection.selected === false) {
    return "skipped";
  }

  const skillDir = resolveGitPreviewSkillDir(tempDir, selection.dir_name);
  const subpath = relative(tempDir, skillDir) || null;
  const sourceRef = gitSourceRef(repoMeta.repoUrl, subpath);
  const installName = resolveLocalSkillName(skillDir, selection.name || null);
  const existing = db.getSkillBySourceRef("git", sourceRef);
  const activeId = getActiveScenarioId();

  if (existing) {
    const stagedPath = join(skillsDir(), `.${basename(existing.central_path)}.staged-${randomUUID()}`);
    const result = installSkillDirToDestination(skillDir, installName, stagedPath);
    const backupPath = `${existing.central_path}.backup-${randomUUID()}`;
    if (existsSync(existing.central_path)) {
      renameSync(existing.central_path, backupPath);
    }
    try {
      renameSync(stagedPath, existing.central_path);
    } catch (error) {
      if (existsSync(backupPath)) {
        try { renameSync(backupPath, existing.central_path); } catch { /* ignore */ }
      }
      throw error;
    }
    try { rmSync(backupPath, { recursive: true, force: true }); } catch { /* ignore */ }

    db.updateSkillAfterReinstall(
      existing.id, result.name, result.description ?? null,
      "git", sourceRef, repoMeta.revision, repoMeta.revision, repoMeta.repoUrl, subpath, repoMeta.branch,
      result.content_hash, "up_to_date",
    );
    if (activeId) {
      try { addSkillToScenarioAndSync(existing.id, activeId); } catch { /* ignore */ }
    }
    return "updated";
  }

  const result = installFromLocal(skillDir, installName);
  const existingByCentralPath = db.getSkillByCentralPath(result.central_path);
  if (existingByCentralPath) {
    db.updateSkillAfterReinstall(
      existingByCentralPath.id, result.name, result.description ?? null,
      "git", sourceRef, repoMeta.revision, repoMeta.revision, repoMeta.repoUrl, subpath, repoMeta.branch,
      result.content_hash, "up_to_date",
    );
    if (activeId) {
      try { addSkillToScenarioAndSync(existingByCentralPath.id, activeId); } catch { /* ignore */ }
    }
    return "updated";
  }

  const now = Date.now();
  const id = randomUUID();
  db.insertSkill({
    id,
    name: result.name,
    description: result.description ?? null,
    source_type: "git",
    source_ref: sourceRef,
    source_ref_resolved: repoMeta.repoUrl,
    source_subpath: subpath,
    source_branch: repoMeta.branch,
    source_revision: repoMeta.revision,
    remote_revision: repoMeta.revision,
    central_path: result.central_path,
    content_hash: result.content_hash,
    enabled: true,
    created_at: now,
    updated_at: now,
    status: "ok",
    update_status: "up_to_date",
    last_checked_at: now,
    last_check_error: null,
  });

  if (activeId) {
    try { addSkillToScenarioAndSync(id, activeId); } catch { /* ignore */ }
  }

  return "installed";
}

function confirmGitInstall(tempDir: string, selections: GitInstallSelection[]): GitInstallResult {
  if (!Array.isArray(selections) || selections.length === 0) {
    throw new Error("Select at least one skill to install");
  }
  if (!isSafeGitPreviewTempDir(tempDir)) {
    throw new Error("Invalid Git preview temp directory");
  }

  let installed = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    const repoMeta = readGitRepoMetadata(tempDir);
    for (const selection of selections) {
      try {
        const outcome = installGitSkillSelection(tempDir, selection, repoMeta);
        if (outcome === "installed") installed++;
        if (outcome === "updated") updated++;
        if (outcome === "skipped") skipped++;
      } catch (error) {
        errors.push(`${selection.dir_name || "unknown"}: ${String(error)}`);
      }
    }
  } finally {
    cleanupGitPreviewTempDir(tempDir);
  }

  return { installed, updated, skipped, errors };
}

function cleanupGitPreviewTempDir(tempDir: string): boolean {
  if (!tempDir || !isSafeGitPreviewTempDir(tempDir)) {
    return false;
  }
  try {
    rmSync(tempDir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

// -- Register all handlers --

export function registerSkillManagerHandlers(): void {
  // Skills
  registerSkillIpcHandler("skills:getManagedSkills", () => {
    return getAllSkills().map(managedSkillToDto);
  });

  registerSkillIpcHandler("skills:getSkillsForScenario", (scenarioId: string) => {
    const skills = getSkillsForScenarioDb(scenarioId);
    return skills.map(managedSkillToDto);
  });

  registerSkillIpcHandler("skills:getSkillDocument", (skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");

    const candidates = ["SKILL.md", "skill.md", "CLAUDE.md", "claude.md", "README.md", "readme.md"];

    for (const name of candidates) {
      const path = join(skill.central_path, name);
      if (existsSync(path)) {
        return {
          skill_id: skillId,
          filename: name,
          content: readFileSync(path, "utf-8"),
          central_path: skill.central_path,
        } as SkillDocument;
      }
    }

    throw new Error("No documentation file found");
  });

  registerSkillIpcHandler("skills:deleteManagedSkill", (skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");

    // Remove targets
    const targets = db.getTargetsForSkill(skillId) as Array<{ target_path: string }>;
    for (const t of targets) {
      try { removeTarget(t.target_path); } catch { /* ignore */ }
    }

    // Remove from central repo
    try { rmSync(skill.central_path, { recursive: true, force: true }); } catch { /* ignore */ }

    deleteSkill(skillId);
  });

  registerSkillIpcHandler("skills:deleteManagedSkills", (skillIds: string[]) => {
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const skillId of skillIds) {
      try {
        const skill = getSkillById(skillId);
        if (!skill) {
          failed.push(skillId);
          continue;
        }

        const targets = db.getTargetsForSkill(skillId) as Array<{ target_path: string }>;
        for (const t of targets) {
          try { removeTarget(t.target_path); } catch { /* ignore */ }
        }
        try { rmSync(skill.central_path, { recursive: true, force: true }); } catch { /* ignore */ }

        deleteSkill(skillId);
        deleted.push(skillId);
      } catch {
        failed.push(skillId);
      }
    }

    return { deleted: deleted.length, failed } as BatchDeleteSkillsResult;
  });

  // Install
  registerSkillIpcHandler("skills:installLocal", (sourcePath: string, name?: string) => {
    const result = installFromLocal(sourcePath, name || null);
    const now = Date.now();

    // Check if already exists
    const existing = db.getSkillByCentralPath(result.central_path) as ReturnType<typeof getAllSkills>[number] | undefined;
    if (existing) {
      // Update existing
      db.updateSkillAfterReinstall(
        existing.id, result.name, result.description ?? null,
        "local", sourcePath, null, null, null, null, null,
        result.content_hash, "local_only",
      );
      const activeId = getActiveScenarioId();
      if (activeId) {
        try { addSkillToScenarioAndSync(existing.id, activeId); } catch { /* ignore */ }
      }
      return existing.id;
    }

    const id = randomUUID();
    db.insertSkill({
      id,
      name: result.name,
      description: result.description ?? null,
      source_type: "local",
      source_ref: sourcePath,
      source_ref_resolved: null,
      source_subpath: null,
      source_branch: null,
      source_revision: null,
      remote_revision: null,
      central_path: result.central_path,
      content_hash: result.content_hash,
      enabled: true,
      created_at: now,
      updated_at: now,
      status: "ok",
      update_status: "local_only",
      last_checked_at: now,
      last_check_error: null,
    });

    const activeId = getActiveScenarioId();
    if (activeId) {
      try { addSkillToScenarioAndSync(id, activeId); } catch { /* ignore */ }
    }

    return id;
  });

  registerSkillIpcHandler("skills:batchImportFolder", (folderPath: string) => {

    if (!statSync(folderPath).isDirectory()) {
      throw new Error("Selected path is not a directory");
    }

    const entries = readdirSync(folderPath, { withFileTypes: true });
    const skillDirs = entries
      .filter((e: { isDirectory: () => boolean; name: string }) => e.isDirectory())
      .map((e: { name: string }) => join(folderPath, e.name))
      .filter(is_valid_skill_dir);

    if (skillDirs.length === 0) {
      return { imported: 0, skipped: 0, errors: [] } as BatchImportResult;
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const activeId = getActiveScenarioId();
    const {
      insertSkill,
      getSkillByCentralPath,
    } = db;

    for (const dir of skillDirs) {
      try {
        const name = inferSkillName(dir);
        const prospectiveCentral = join(skillsDir(), name);

        const existing = db.getSkillByCentralPath(prospectiveCentral) as ReturnType<typeof getAllSkills>[number] | undefined;
        if (existing) {
          if (activeId) {
            try { addSkillToScenarioAndSync(existing.id, activeId); } catch { /* ignore */ }
          }
          skipped++;
          continue;
        }

        const result = installFromLocal(dir, name);
        const now = Date.now();
        const id = randomUUID();

        db.insertSkill({
          id,
          name: result.name,
          description: result.description ?? null,
          source_type: "local",
          source_ref: dir,
          source_ref_resolved: null,
          source_subpath: null,
          source_branch: null,
          source_revision: null,
          remote_revision: null,
          central_path: result.central_path,
          content_hash: result.content_hash,
          enabled: true,
          created_at: now,
          updated_at: now,
          status: "ok",
          update_status: "local_only",
          last_checked_at: now,
          last_check_error: null,
        });

        if (activeId) {
          try { addSkillToScenarioAndSync(id, activeId); } catch { /* ignore */ }
        }
        imported++;
      } catch (e) {
        errors.push(`${inferSkillName(dir)}: ${String(e)}`);
      }
    }

    return { imported, skipped, errors } as BatchImportResult;
  });

  // Tags
  registerSkillIpcHandler("skills:getAllTags", () => {
    return db.getAllTags() as string[];
  });

  registerSkillIpcHandler("skills:setSkillTags", (skillId: string, tags: string[]) => {
    db.setTagsForSkill(skillId, tags);
  });

  // Scenarios
  registerSkillIpcHandler("skills:getScenarios", () => {
    return getAllScenarioDtos();
  });

  registerSkillIpcHandler("skills:getActiveScenario", () => {
    return getActiveScenarioDto();
  });

  registerSkillIpcHandler("skills:createScenario", (name: string, description?: string, icon?: string) => {
    return createScenario(name, description || null, icon || null);
  });

  registerSkillIpcHandler("skills:updateScenario", (id: string, name: string, description?: string, icon?: string) => {
    updateScenarioInfo(id, name, description || null, icon || null);
  });

  registerSkillIpcHandler("skills:deleteScenario", (id: string) => {
    deleteScenarioAndCleanup(id);
  });

  registerSkillIpcHandler("skills:applyScenarioToDefault", (id: string) => {
    applyScenarioToDefault(id);
  });

  registerSkillIpcHandler("skills:addSkillToScenario", (skillId: string, scenarioId: string) => {
    addSkillToScenarioAndSync(skillId, scenarioId);
  });

  registerSkillIpcHandler("skills:removeSkillFromScenario", (skillId: string, scenarioId: string) => {
    removeSkillFromScenarioAndSync(skillId, scenarioId);
  });

  registerSkillIpcHandler("skills:reorderScenarios", (ids: string[]) => {
    reorderScenarioList(ids);
  });

  registerSkillIpcHandler("skills:getScenarioSkillOrder", (scenarioId: string) => {
    return db.getSkillIdsForScenario(scenarioId) as string[];
  });

  registerSkillIpcHandler("skills:reorderScenarioSkills", (scenarioId: string, skillIds: string[]) => {
    db.reorderScenarioSkills(scenarioId, skillIds);
  });

  // Sync
  registerSkillIpcHandler("skills:syncSkillToTool", (skillId: string, tool: string) => {
    const adapter = findAdapterWithStore(tool);
    if (!adapter) throw new Error(`Unknown tool: ${tool}`);

    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");

    const source = skill.central_path;
    const target = join(adapterSkillsDir(adapter), targetDirName(source, skill.name));
    const configuredMode = db.getSetting("sync_mode") || null;
    const mode = syncModeForTool(tool, configuredMode);
    const actualMode = syncSkill(source, target, mode);
    db.insertTarget({
      id: randomUUID(),
      skill_id: skillId,
      tool,
      target_path: target,
      mode: actualMode,
      status: "ok",
      synced_at: Date.now(),
      last_error: null,
    });
  });

  registerSkillIpcHandler("skills:unsyncSkillFromTool", (skillId: string, tool: string) => {
    const targets = db.getTargetsForSkill(skillId) as Array<{ target_path: string; tool: string }>;
    const target = targets.find((t) => t.tool === tool);
    if (target) {
      try { removeTarget(target.target_path); } catch { /* ignore */ }
    }
    db.deleteTarget(skillId, tool);
  });

  registerSkillIpcHandler("skills:getSkillToolToggles", (skillId: string, scenarioId: string) => {
    const skillIds = db.getSkillIdsForScenario(scenarioId) as string[];
    if (!skillIds.includes(skillId)) {
      throw new Error("Skill is not enabled in this scenario");
    }

    let disabled: string[] = [];
    try {
      const raw = db.getSetting("disabled_tools");
      if (raw) disabled = JSON.parse(raw);
    } catch { /* ignore */ }

    const adapters = allToolAdapters();
    const defaultEnabledKeys = adapters
      .filter((a) => !disabled.includes(a.key))
      .map((a) => a.key);

    db.ensureScenarioSkillToolDefaults(scenarioId, skillId, defaultEnabledKeys);

    const toggles = db.getScenarioSkillToolToggles(scenarioId, skillId) as Array<{ tool: string; enabled: boolean }>;
    const enabledMap = new Map(toggles.map((t) => [t.tool, t.enabled]));
    return adapters.map((adapter) => {
      const globallyEnabled = !disabled.includes(adapter.key);
      const available = isInstalled(adapter) && globallyEnabled;
      return {
        tool: adapter.key,
        display_name: adapter.display_name,
        installed: isInstalled(adapter),
        globally_enabled: globallyEnabled,
        enabled: available ? (enabledMap.get(adapter.key) ?? false) : false,
      } as SkillToolToggle;
    });
  });

  registerSkillIpcHandler("skills:setSkillToolToggle", (skillId: string, scenarioId: string, tool: string, enabled: boolean) => {
    const skillIds = db.getSkillIdsForScenario(scenarioId) as string[];
    if (!skillIds.includes(skillId)) {
      throw new Error("Skill is not enabled in this scenario");
    }

    const adapter = findAdapterWithStore(tool);
    if (!adapter) throw new Error(`Unknown tool: ${tool}`);

    let disabled: string[] = [];
    try {
      const raw = db.getSetting("disabled_tools");
      if (raw) disabled = JSON.parse(raw);
    } catch { /* ignore */ }

    if (enabled) {
      if (!isInstalled(adapter)) throw new Error(`${adapter.display_name} is not installed`);
      if (disabled.includes(tool)) throw new Error(`${adapter.display_name} is disabled`);
    }

    db.setScenarioSkillToolEnabled(scenarioId, skillId, tool, enabled);

    // Apply to active scenario
    const activeId = getActiveScenarioId();
    if (activeId === scenarioId) {
      if (enabled) {
        const skill = getSkillById(skillId);
        if (skill) {
          const source = skill.central_path;
          const target = join(adapterSkillsDir(adapter), targetDirName(source, skill.name));
          const configuredMode = db.getSetting("sync_mode") || null;
          const mode = syncModeForTool(tool, configuredMode);
          const actualMode = syncSkill(source, target, mode);
          db.insertTarget({
            id: randomUUID(),
            skill_id: skillId,
            tool,
            target_path: target,
            mode: actualMode,
            status: "ok",
            synced_at: Date.now(),
            last_error: null,
          });
        }
      } else {
        const targets = db.getTargetsForSkill(skillId) as Array<{ target_path: string; tool: string }>;
        const tg = targets.find((t) => t.tool === tool);
        if (tg) {
          try { removeTarget(tg.target_path); } catch { /* ignore */ }
        }
        db.deleteTarget(skillId, tool);
      }
    }
  });

  // Tools
  registerSkillIpcHandler("skills:getTools", () => {
    let disabled: string[] = [];
    let customToolsRaw: string | null = null;
    let customPaths: Record<string, string> = {};
    try {
      const raw = db.getSetting("disabled_tools");
      if (raw) disabled = JSON.parse(raw);
      customToolsRaw = db.getSetting("custom_tools") || null;
      const pathsRaw = db.getSetting("custom_tool_paths");
      if (pathsRaw) customPaths = JSON.parse(pathsRaw);
    } catch { /* ignore */ }

    const adapters = allToolAdapters();

    return adapters.map((a) => ({
      key: a.key,
      display_name: a.display_name,
      installed: isInstalled(a),
      skills_dir: adapterSkillsDir(a),
      enabled: !disabled.includes(a.key),
      is_custom: a.is_custom,
      has_path_override: customPaths[a.key] !== undefined,
      project_relative_skills_dir: a.is_custom ? a.relative_skills_dir : null,
    })) as ToolInfo[];
  });

  registerSkillIpcHandler("skills:setToolEnabled", (tool: string, enabled: boolean) => {
    let disabled: string[] = [];
    try {
      const raw = db.getSetting("disabled_tools");
      if (raw) disabled = JSON.parse(raw);
    } catch { /* ignore */ }

    if (enabled) {
      disabled = disabled.filter((t) => t !== tool);
    } else {
      if (!disabled.includes(tool)) disabled.push(tool);
    }

    db.setSetting("disabled_tools", JSON.stringify(disabled));
  });

  // Scan
  registerSkillIpcHandler("skills:scanLocalSkills", () => {
    const allTargets = getAllTargets();
    const managedPaths = allTargets.map((t) => t.target_path);
    const managedSkills = getAllSkills();
    const adapters = allToolAdapters();

    const plan = scanLocalSkillsFn(managedPaths);

    // Mark imported skills
    for (const rec of plan.discovered) {
      rec.imported_skill_id = matchImportedSkillId(rec, managedSkills);
    }

    const groups = groupDiscovered(plan.discovered);

    return {
      tools_scanned: plan.tools_scanned,
      skills_found: plan.skills_found,
      groups,
    } as ScanResult;
  });

  // Marketplace
  registerSkillIpcHandler("skills:fetchLeaderboard", async (board: string) => {
    return await fetchLeaderboard(board);
  });

  registerSkillIpcHandler("skills:searchSkillssh", async (query: string, limit?: number) => {
    return await searchSkillssh(query, limit);
  });

  registerSkillIpcHandler("skills:installSkillssh", (source: string, skillId: string) => {
    return installSkillsshSkill(source, skillId);
  });

  registerSkillIpcHandler("skills:previewGitInstall", (repoUrl: string) => {
    return previewGitInstall(repoUrl);
  });

  registerSkillIpcHandler("skills:confirmGitInstall", (tempDir: string, selections: GitInstallSelection[]) => {
    return confirmGitInstall(tempDir, selections);
  });

  registerSkillIpcHandler("skills:cleanupGitPreview", (tempDir: string) => {
    return cleanupGitPreviewTempDir(tempDir);
  });

  // Check update
  registerSkillIpcHandler("skills:checkSkillUpdate", (skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");

    if (skill.source_type === "local" || skill.source_type === "import") {
      const sourcePath = skill.source_ref;
      if (!sourcePath) {
        db.updateSkillCheckState(skillId, null, "local_only", null);
        return managedSkillById(skillId);
      }
      if (!existsSync(sourcePath)) {
        db.updateSkillCheckState(skillId, null, "source_missing", "Original source path no longer exists");
        return managedSkillById(skillId);
      }

      try {
        const liveHash = hashLocalSource(sourcePath);
        const status = skill.content_hash === liveHash ? "up_to_date" : "update_available";
        db.updateSkillCheckState(skillId, null, status, null);
      } catch (e) {
        db.updateSkillCheckState(skillId, null, "error", String(e));
      }
    } else {
      // Git/skillssh - check remote revision
      db.updateSkillCheckState(skillId, skill.remote_revision, "unknown", null);
    }

    return managedSkillById(skillId);
  });

  // Reimport local skill
  registerSkillIpcHandler("skills:reimportLocalSkill", (skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");

    if (skill.source_type !== "local" && skill.source_type !== "import") {
      throw new Error("Only local skills can be reimported");
    }

    const sourcePath = skill.source_ref;
    if (!sourcePath) throw new Error("Local skill is missing its original source path");
    if (!existsSync(sourcePath)) throw new Error("Original source path no longer exists");

    // Reinstall
    const stagedPath = skill.central_path.replace(
      new RegExp(`${skill.name}$`),
      `.${skill.name}.staged-${randomUUID()}`,
    );

    const result = installSkillDirToDestination(sourcePath, skill.name, stagedPath);

    // Swap
    const backupPath = skill.central_path + `.backup-${randomUUID()}`;
    if (existsSync(skill.central_path)) {
      renameSync(skill.central_path, backupPath);
    }
    try {
      renameSync(stagedPath, skill.central_path);
    } catch (e) {
      if (existsSync(backupPath)) {
        try { renameSync(backupPath, skill.central_path); } catch { /* ignore */ }
      }
      throw e;
    }
    try { rmSync(backupPath, { recursive: true, force: true }); } catch { /* ignore */ }

    db.updateSkillAfterInstall(
      skillId, skill.name, result.description ?? null,
      null, null, result.content_hash, "local_only",
    );

    // Resync copy targets
    const targets = db.getTargetsForSkill(skillId) as Array<{ target_path: string; mode: string }>;
    for (const t of targets) {
      if (t.mode !== "copy") continue;
      syncSkill(skill.central_path, t.target_path, "copy");
    }

    return managedSkillById(skillId);
  });

  // Update
  registerSkillIpcHandler("skills:updateSkill", (skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");

    if (skill.source_type === "local" || skill.source_type === "import") {
      return reimportLocalSkill(skillId);
    }

    // Git/skillssh update not fully implemented in this port
    throw new Error("Git-based skill updates require git clone support (not yet ported)");
  });

  registerSkillIpcHandler("skills:batchUpdateSkills", (skillIds: string[]) => {
    let refreshed = 0;
    let unchanged = 0;
    const failed: string[] = [];

    for (const skillId of skillIds) {
      let skillRecord: ReturnType<typeof getSkillById> | null = null;
      try {
        skillRecord = getSkillById(skillId);
        if (!skillRecord) {
          failed.push(`${skillId}: Skill not found`);
          continue;
        }

        if (skillRecord.source_type === "local" || skillRecord.source_type === "import") {
          const sourcePath = skillRecord.source_ref;
          if (!sourcePath) {
            failed.push(`${skillRecord.name}: Missing source path`);
            continue;
          }
          if (!existsSync(sourcePath)) {
            failed.push(`${skillRecord.name}: Original source path no longer exists`);
            continue;
          }

          // Reimport
          const stagedPath = skillRecord.central_path.replace(
            new RegExp(`${skillRecord.name}$`),
            `.${skillRecord.name}.staged-${randomUUID()}`,
          );
          const result = installSkillDirToDestination(sourcePath, skillRecord.name, stagedPath);
          const backupPath = skillRecord.central_path + `.backup-${randomUUID()}`;
          if (existsSync(skillRecord.central_path)) {
            renameSync(skillRecord.central_path, backupPath);
          }
          try {
            renameSync(stagedPath, skillRecord.central_path);
          } catch (e) {
            if (existsSync(backupPath)) {
              try { renameSync(backupPath, skillRecord.central_path); } catch { /* ignore */ }
            }
            throw e;
          }
          try { rmSync(backupPath, { recursive: true, force: true }); } catch { /* ignore */ }

          db.updateSkillAfterInstall(
            skillId, skillRecord.name, result.description ?? null,
            null, null, result.content_hash, "local_only",
          );

          refreshed++;
        } else {
          unchanged++;
        }
      } catch (e) {
        failed.push(`${skillRecord?.name || skillId}: ${String(e)}`);
      }
    }

    return { refreshed, unchanged, failed } as BatchUpdateSkillsResult;
  });

  // Relink local source
  registerSkillIpcHandler("skills:relinkLocalSkillSource", (skillId: string, sourcePath: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");
    if (skill.source_type !== "local" && skill.source_type !== "import") {
      throw new Error("Only local skills can relink source paths");
    }
    if (!existsSync(sourcePath)) throw new Error("Selected source path does not exist");
    if (!is_valid_skill_dir(sourcePath)) throw new Error("Selected source path is not a valid skill directory");

    // Perform reimport from new source
    const stagedPath = skill.central_path.replace(
      new RegExp(`${skill.name}$`),
      `.${skill.name}.staged-${randomUUID()}`,
    );
    const result = installSkillDirToDestination(sourcePath, skill.name, stagedPath);
    const backupPath = skill.central_path + `.backup-${randomUUID()}`;
    if (existsSync(skill.central_path)) {
      renameSync(skill.central_path, backupPath);
    }
    try {
      renameSync(stagedPath, skill.central_path);
    } catch (e) {
      if (existsSync(backupPath)) {
        try { renameSync(backupPath, skill.central_path); } catch { /* ignore */ }
      }
      throw e;
    }
    try { rmSync(backupPath, { recursive: true, force: true }); } catch { /* ignore */ }

    db.updateSkillSourceMetadata(
      skillId, sourcePath, null, null, null,
    );

    return managedSkillById(skillId);
  });

  // Detach local source
  registerSkillIpcHandler("skills:detachLocalSkillSource", (skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");
    if (skill.source_type !== "local" && skill.source_type !== "import") {
      throw new Error("Only local skills can detach source paths");
    }
    db.updateSkillAfterReinstall(
      skillId, skill.name, skill.description,
      skill.source_type, null, null, null, null, null, null,
      skill.content_hash, "local_only",
    );

    return managedSkillById(skillId);
  });
}

