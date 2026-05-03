// Source: CV from skills-manager Rust commands/scenarios.rs
// Adapted for Electron TypeScript backend

import { join, basename } from "path";
import { randomUUID } from "crypto";
import type { Scenario, SkillRecord } from "./types.js";
import {
  getAllScenarios,
  getScenarioById,
  insertScenario,
  updateScenario,
  deleteScenario,
  reorderScenarios,
  addSkillToScenario,
  removeSkillFromScenario,
  getSkillIdsForScenario,
  getScenariosForSkill,
  countSkillsForScenario,
  getActiveScenarioId,
  setActiveScenario,
  clearActiveScenario,
  getSkillsForScenario,
  getSetting,
  getAllTargets,
  getTargetsForSkill,
  insertTarget,
  deleteTarget,
  ensureScenarioSkillToolDefaults,
  getEnabledToolsForScenarioSkill,
} from "./db.js";
import { enabledInstalledAdapters, findAdapterWithStore, isInstalled, skillsDir, type ToolAdapter } from "./tool-adapters.js";
import {
  syncSkill,
  removeTarget,
  targetDirName,
  syncModeForTool,
  isTargetCurrent,
  type SyncMode,
} from "./sync-engine.js";

// ── Scenario DTO ──

export function toScenarioDto(record: ReturnType<typeof getAllScenarios>[number], skillCount: number): Scenario {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    icon: record.icon,
    sort_order: record.sort_order,
    skill_count: skillCount,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

export function getAllScenarioDtos(): Scenario[] {
  const scenarios = getAllScenarios();
  return scenarios.map((s) => {
    const count = countSkillsForScenario(s.id);
    return toScenarioDto(s, count);
  });
}

export function getActiveScenarioDto(): Scenario | null {
  const activeId = getActiveScenarioId();
  if (!activeId) return null;

  const s = getScenarioById(activeId);
  if (!s) return null;

  const count = countSkillsForScenario(s.id);
  return toScenarioDto(s, count);
}

export function ensureDefaultScenario(): Scenario {
  const activeId = getActiveScenarioId();
  if (activeId) {
    const active = getScenarioById(activeId);
    if (active) {
      syncScenarioSkills(active.id);
      return toScenarioDto(active, countSkillsForScenario(active.id));
    }
    clearActiveScenario();
  }

  const existing = getAllScenarios()[0];
  if (existing) {
    setActiveScenario(existing.id);
    syncScenarioSkills(existing.id);
    return toScenarioDto(existing, countSkillsForScenario(existing.id));
  }

  const now = Date.now();
  const id = randomUUID();
  insertScenario({
    id,
    name: "默认",
    description: "默认技能场景",
    icon: "sparkles",
    sort_order: 0,
    created_at: now,
    updated_at: now,
  });
  setActiveScenario(id);

  return {
    id,
    name: "默认",
    description: "默认技能场景",
    icon: "sparkles",
    sort_order: 0,
    skill_count: 0,
    created_at: now,
    updated_at: now,
  };
}

// ── Scenario mutations ──

export function createScenario(
  name: string,
  description?: string | null,
  icon?: string | null,
): Scenario {
  const now = Date.now();
  const id = randomUUID();
  const previousActiveId = getActiveScenarioId();

  insertScenario({
    id,
    name,
    description: description || null,
    icon: icon || null,
    sort_order: 999,
    created_at: now,
    updated_at: now,
  });

  if (previousActiveId) {
    unsyncScenarioSkills(previousActiveId);
  }
  setActiveScenario(id);

  return {
    id,
    name,
    description: description || null,
    icon: icon || null,
    sort_order: 999,
    skill_count: 0,
    created_at: now,
    updated_at: now,
  };
}

export function updateScenarioInfo(
  id: string,
  name: string,
  description?: string | null,
  icon?: string | null,
): void {
  updateScenario(id, name, description || null, icon || null);
}

export function deleteScenarioAndCleanup(id: string): void {
  const wasActive = getActiveScenarioId() === id;

  if (wasActive) {
    unsyncScenarioSkills(id);
  }

  deleteScenario(id);

  if (wasActive) {
    const remaining = getAllScenarios();
    if (remaining.length > 0) {
      setActiveScenario(remaining[0].id);
      syncScenarioSkills(remaining[0].id);
    } else {
      clearActiveScenario();
    }
  }
}

export function reorderScenarioList(ids: string[]): void {
  reorderScenarios(ids);
}

// ── Apply scenario to default ──

export function applyScenarioToDefault(id: string): void {
  const scenario = getScenarioById(id);
  if (!scenario) throw new Error("Scenario not found");

  const desiredTargets = collectScenarioSyncTargets(id);

  // Remove only targets that are not also needed by the new scenario
  const oldId = getActiveScenarioId();
  if (oldId && oldId !== id) {
    unsyncObsoleteScenarioTargets(oldId, desiredTargets);
  }

  // Mark this scenario as active
  setActiveScenario(id);

  // Sync missing or stale targets
  syncDesiredTargets(desiredTargets);
}

// ── Add / remove skill from scenario ──

export function addSkillToScenarioAndSync(skillId: string, scenarioId: string): void {
  addSkillToScenario(scenarioId, skillId);
  syncSkillToActiveScenario(scenarioId, skillId);
}

export function removeSkillFromScenarioAndSync(skillId: string, scenarioId: string): void {
  removeSkillFromScenario(scenarioId, skillId);

  const activeId = getActiveScenarioId();
  if (activeId === scenarioId) {
    const targets = getTargetsForSkill(skillId);
    for (const target of targets) {
      try { removeTarget(target.target_path); } catch { /* ignore */ }
      deleteTarget(skillId, target.tool);
    }
  }
}

export function reorderScenarioSkills(scenarioId: string, skillIds: string[]): void {
  const { reorderScenarioSkills: dbReorder } = require("./db.js");
  dbReorder(scenarioId, skillIds);
}

// ── Internal: Scenario sync helpers ──

interface ScenarioSyncTarget {
  skill_id: string;
  tool: string;
  source: string;
  target: string;
  mode: SyncMode;
}

export function syncScenarioSkills(scenarioId: string): void {
  const desiredTargets = collectScenarioSyncTargets(scenarioId);
  syncDesiredTargets(desiredTargets);
}

function collectScenarioSyncTargets(scenarioId: string): ScenarioSyncTarget[] {
  const skills = getSkillsForScenario(scenarioId);
  const configuredMode = getSetting("sync_mode") || null;
  const targets: ScenarioSyncTarget[] = [];

  for (const skill of skills) {
    const source = skill.central_path;
    const targetName = targetDirName(source, skill.name);
    const adapters = enabledInstalledAdaptersForScenarioSkill(scenarioId, skill.id);

    for (const adapter of adapters) {
      const target = join(skillsDir(adapter), targetName);
      const mode = syncModeForTool(adapter.key, configuredMode);
      targets.push({
        skill_id: skill.id,
        tool: adapter.key,
        source,
        target,
        mode,
      });
    }
  }

  return targets;
}

function syncDesiredTargets(desiredTargets: ScenarioSyncTarget[]): void {
  const existingTargets = new Map<string, { target_path: string; mode: string; status: string }>();
  for (const t of getAllTargets()) {
    existingTargets.set(`${t.skill_id}:${t.tool}`, {
      target_path: t.target_path,
      mode: t.mode,
      status: t.status,
    });
  }

  for (const desired of desiredTargets) {
    const key = `${desired.skill_id}:${desired.tool}`;
    const existing = existingTargets.get(key);

    if (existing) {
      if (existing.target_path !== desired.target) {
        try { removeTarget(existing.target_path); } catch { /* ignore */ }
        deleteTarget(desired.skill_id, desired.tool);
      } else if (
        existing.mode === desired.mode &&
        existing.status === "ok" &&
        isTargetCurrent(desired.source, desired.target, desired.mode)
      ) {
        continue;
      }
    }

    try {
      const actualMode = syncSkill(desired.source, desired.target, desired.mode);
      insertTarget({
        id: randomUUID(),
        skill_id: desired.skill_id,
        tool: desired.tool,
        target_path: desired.target,
        mode: actualMode,
        status: "ok",
        synced_at: Date.now(),
        last_error: null,
      });
    } catch (e) {
      // Log warning but don't fail
      console.warn(`Failed to sync skill ${desired.skill_id} to ${desired.target}:`, e);
    }
  }
}

function unsyncObsoleteScenarioTargets(
  oldScenarioId: string,
  desiredTargets: ScenarioSyncTarget[],
): void {
  const desiredPaths = new Map<string, string>();
  for (const dt of desiredTargets) {
    desiredPaths.set(`${dt.skill_id}:${dt.tool}`, dt.target);
  }

  const oldSkillIds = getSkillIdsForScenario(oldScenarioId);
  for (const skillId of oldSkillIds) {
    const targets = getTargetsForSkill(skillId);
    for (const target of targets) {
      const key = `${skillId}:${target.tool}`;
      if (desiredPaths.get(key) === target.target_path) continue;

      try { removeTarget(target.target_path); } catch { /* ignore */ }
      deleteTarget(skillId, target.tool);
    }
  }
}

function unsyncScenarioSkills(scenarioId: string): void {
  const skillIds = getSkillIdsForScenario(scenarioId);

  for (const skillId of skillIds) {
    const targets = getTargetsForSkill(skillId);
    for (const target of targets) {
      try { removeTarget(target.target_path); } catch { /* ignore */ }
      deleteTarget(skillId, target.tool);
    }
  }
}

// ── Internal: Skill sync to active scenario ──

export function syncSkillToActiveScenario(scenarioId: string, skillId: string): void {
  const activeId = getActiveScenarioId();
  if (activeId !== scenarioId) return;

  const adapters = enabledInstalledAdaptersForScenarioSkill(scenarioId, skillId);
  const configuredMode = getSetting("sync_mode") || null;
  const skills = getSkillsForScenario(scenarioId);
  const skill = skills.find((s) => s.id === skillId);
  if (!skill) return;

  const source = skill.central_path;
  const targetName = targetDirName(source, skill.name);
  const oldTargets = getTargetsForSkill(skillId);

  for (const adapter of adapters) {
    // Remove stale target from previous sync if name changed
    const old = oldTargets.find((t) => t.tool === adapter.key);
    if (old) {
      const oldPath = old.target_path;
      const newPath = join(skillsDir(adapter), targetName);
      if (oldPath !== newPath) {
        try { removeTarget(oldPath); } catch { /* ignore */ }
        deleteTarget(skillId, adapter.key);
      }
    }

    const target = join(skillsDir(adapter), targetName);
    const mode = syncModeForTool(adapter.key, configuredMode);

    try {
      const actualMode = syncSkill(source, target, mode);
      insertTarget({
        id: randomUUID(),
        skill_id: skillId,
        tool: adapter.key,
        target_path: target,
        mode: actualMode,
        status: "ok",
        synced_at: Date.now(),
        last_error: null,
      });
    } catch (e) {
      console.warn(`Failed to sync skill ${skillId} to ${target}:`, e);
    }
  }
}

// ── Internal: Adapters for scenario skill ──

function enabledInstalledAdaptersForScenarioSkill(
  scenarioId: string,
  skillId: string,
): ToolAdapter[] {
  const adapters = enabledInstalledAdapters();
  const adapterKeys = adapters.map((a) => a.key);

  ensureScenarioSkillToolDefaults(scenarioId, skillId, adapterKeys);

  const enabledTools = getEnabledToolsForScenarioSkill(scenarioId, skillId);
  const enabledSet = new Set(enabledTools);

  return adapters.filter((adapter) => enabledSet.has(adapter.key));
}
