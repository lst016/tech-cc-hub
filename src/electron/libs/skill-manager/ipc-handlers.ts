// Source: CV from skills-manager Tauri commands (skills.rs, scenarios.rs, sync.rs, scan.rs, browse.rs, tools.rs)
// Adapted for Electron ipcMain.handle pattern

import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { ipcMain, app } from "electron";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import { join, relative } from "path";
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
import { installFromLocal, installSkillDirToDestination, hashLocalSource } from "./installer.js";
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
  SkillTarget,
} from "./types.js";

// ── Init ──

let initialized = false;

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

// ── Helpers ──

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

// ── Register all handlers ──

export function registerSkillManagerHandlers(): void {
  initSkillManager();

  // Skills
  ipcMain.handle("skills:getManagedSkills", () => {
    return getAllSkills().map(managedSkillToDto);
  });

  ipcMain.handle("skills:getSkillsForScenario", (_event: any, scenarioId: string) => {
    const skills = getSkillsForScenarioDb(scenarioId);
    return skills.map(managedSkillToDto);
  });

  ipcMain.handle("skills:getSkillDocument", (_event: any, skillId: string) => {
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

  ipcMain.handle("skills:deleteManagedSkill", (_event: any, skillId: string) => {
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

  ipcMain.handle("skills:deleteManagedSkills", (_event: any, skillIds: string[]) => {
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
  ipcMain.handle("skills:installLocal", (_event: any, sourcePath: string, name?: string) => {
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

  ipcMain.handle("skills:batchImportFolder", (_event: any, folderPath: string) => {

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
  ipcMain.handle("skills:getAllTags", () => {
    return db.getAllTags() as string[];
  });

  ipcMain.handle("skills:setSkillTags", (_event: any, skillId: string, tags: string[]) => {
    db.setTagsForSkill(skillId, tags);
  });

  // Scenarios
  ipcMain.handle("skills:getScenarios", () => {
    return getAllScenarioDtos();
  });

  ipcMain.handle("skills:getActiveScenario", () => {
    return getActiveScenarioDto();
  });

  ipcMain.handle("skills:createScenario", (_event: any, name: string, description?: string, icon?: string) => {
    return createScenario(name, description || null, icon || null);
  });

  ipcMain.handle("skills:updateScenario", (_event: any, id: string, name: string, description?: string, icon?: string) => {
    updateScenarioInfo(id, name, description || null, icon || null);
  });

  ipcMain.handle("skills:deleteScenario", (_event: any, id: string) => {
    deleteScenarioAndCleanup(id);
  });

  ipcMain.handle("skills:applyScenarioToDefault", (_event: any, id: string) => {
    applyScenarioToDefault(id);
  });

  ipcMain.handle("skills:addSkillToScenario", (_event: any, skillId: string, scenarioId: string) => {
    addSkillToScenarioAndSync(skillId, scenarioId);
  });

  ipcMain.handle("skills:removeSkillFromScenario", (_event: any, skillId: string, scenarioId: string) => {
    removeSkillFromScenarioAndSync(skillId, scenarioId);
  });

  ipcMain.handle("skills:reorderScenarios", (_event: any, ids: string[]) => {
    reorderScenarioList(ids);
  });

  ipcMain.handle("skills:getScenarioSkillOrder", (_event: any, scenarioId: string) => {
    return db.getSkillIdsForScenario(scenarioId) as string[];
  });

  ipcMain.handle("skills:reorderScenarioSkills", (_event: any, scenarioId: string, skillIds: string[]) => {
    db.reorderScenarioSkills(scenarioId, skillIds);
  });

  // Sync
  ipcMain.handle("skills:syncSkillToTool", (_event: any, skillId: string, tool: string) => {
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

  ipcMain.handle("skills:unsyncSkillFromTool", (_event: any, skillId: string, tool: string) => {
    const targets = db.getTargetsForSkill(skillId) as Array<{ target_path: string; tool: string }>;
    const target = targets.find((t) => t.tool === tool);
    if (target) {
      try { removeTarget(target.target_path); } catch { /* ignore */ }
    }
    db.deleteTarget(skillId, tool);
  });

  ipcMain.handle("skills:getSkillToolToggles", (_event: any, skillId: string, scenarioId: string) => {
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

  ipcMain.handle("skills:setSkillToolToggle", (_event: any, skillId: string, scenarioId: string, tool: string, enabled: boolean) => {
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
  ipcMain.handle("skills:getTools", () => {
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

  ipcMain.handle("skills:setToolEnabled", (_event: any, tool: string, enabled: boolean) => {
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
  ipcMain.handle("skills:scanLocalSkills", () => {
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
  ipcMain.handle("skills:fetchLeaderboard", async (_event: any, board: string) => {
    return await fetchLeaderboard(board);
  });

  ipcMain.handle("skills:searchSkillssh", async (_event: any, query: string, limit?: number) => {
    return await searchSkillssh(query, limit);
  });

  ipcMain.handle("skills:installSkillssh", (_event: any, source: string, skillId: string) => {
    return installSkillsshSkill(source, skillId);
  });

  // Check update
  ipcMain.handle("skills:checkSkillUpdate", (_event: any, skillId: string) => {
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
  ipcMain.handle("skills:reimportLocalSkill", (_event: any, skillId: string) => {
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
  ipcMain.handle("skills:updateSkill", (_event: any, skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) throw new Error("Skill not found");

    if (skill.source_type === "local" || skill.source_type === "import") {
      return reimportLocalSkill(skillId);
    }

    // Git/skillssh update not fully implemented in this port
    throw new Error("Git-based skill updates require git clone support (not yet ported)");
  });

  ipcMain.handle("skills:batchUpdateSkills", (_event: any, skillIds: string[]) => {
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
  ipcMain.handle("skills:relinkLocalSkillSource", (_event: any, skillId: string, sourcePath: string) => {
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
  ipcMain.handle("skills:detachLocalSkillSource", (_event: any, skillId: string) => {
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
