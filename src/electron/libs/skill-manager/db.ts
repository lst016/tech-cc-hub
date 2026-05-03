// Source: CV from skills-manager Rust core/skill_store.rs
// Adapted for better-sqlite3 in Electron TypeScript backend

import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import type { SkillRecord, ScenarioRecord, SkillTargetRecord } from "./types.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath("userData");
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }
    const dbPath = join(userDataPath, "skill-manager.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL DEFAULT 'import',
      source_ref TEXT,
      source_ref_resolved TEXT,
      source_subpath TEXT,
      source_branch TEXT,
      source_revision TEXT,
      remote_revision TEXT,
      central_path TEXT NOT NULL UNIQUE,
      content_hash TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',
      update_status TEXT NOT NULL DEFAULT 'unknown',
      last_checked_at INTEGER,
      last_check_error TEXT
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenario_skills (
      scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (scenario_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS scenario_skill_tools (
      scenario_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (scenario_id, skill_id, tool)
    );

    CREATE TABLE IF NOT EXISTS skill_targets (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      tool TEXT NOT NULL,
      target_path TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'symlink',
      status TEXT NOT NULL DEFAULT 'ok',
      synced_at INTEGER,
      last_error TEXT,
      UNIQUE(skill_id, tool)
    );

    CREATE TABLE IF NOT EXISTS skill_tags (
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (skill_id, tag)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scenario_skills_skill ON scenario_skills(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_targets_skill ON skill_targets(skill_id);
    CREATE INDEX IF NOT EXISTS idx_skill_tags_skill ON skill_tags(skill_id);
  `);
}

// ── Skills CRUD ──

export function getAllSkills(): SkillRecord[] {
  const database = getDb();
  return database.prepare("SELECT * FROM skills ORDER BY name").all() as SkillRecord[];
}

export function getSkillById(id: string): SkillRecord | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM skills WHERE id = ?").get(id) as SkillRecord | undefined;
}

export function getSkillByCentralPath(centralPath: string): SkillRecord | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM skills WHERE central_path = ?").get(centralPath) as SkillRecord | undefined;
}

export function getSkillBySourceRef(sourceType: string, sourceRef: string): SkillRecord | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM skills WHERE source_type = ? AND source_ref = ?").get(sourceType, sourceRef) as SkillRecord | undefined;
}

export function insertSkill(record: SkillRecord): void {
  const database = getDb();
  const params = {
    ...record,
    enabled: record.enabled ? 1 : 0,
  };
  database.prepare(`
    INSERT INTO skills (id, name, description, source_type, source_ref, source_ref_resolved,
      source_subpath, source_branch, source_revision, remote_revision, central_path,
      content_hash, enabled, created_at, updated_at, status, update_status, last_checked_at, last_check_error)
    VALUES (@id, @name, @description, @source_type, @source_ref, @source_ref_resolved,
      @source_subpath, @source_branch, @source_revision, @remote_revision, @central_path,
      @content_hash, @enabled, @created_at, @updated_at, @status, @update_status, @last_checked_at, @last_check_error)
  `).run(params as unknown as Record<string, unknown>);
}

export function deleteSkill(id: string): void {
  const database = getDb();
  database.prepare("DELETE FROM skills WHERE id = ?").run(id);
}

export function updateSkillAfterInstall(
  id: string, name: string, description: string | null,
  sourceRevision: string | null, remoteRevision: string | null,
  contentHash: string | null, updateStatus: string,
): void {
  const database = getDb();
  const now = Date.now();
  database.prepare(`
    UPDATE skills SET name = @name, description = @description,
      source_revision = @sourceRevision, remote_revision = @remoteRevision,
      content_hash = @contentHash, update_status = @updateStatus,
      last_checked_at = @now, last_check_error = NULL, updated_at = @now
    WHERE id = @id
  `).run({ id, name, description, sourceRevision, remoteRevision, contentHash, updateStatus, now });
}

export function updateSkillAfterReinstall(
  id: string, name: string, description: string | null,
  sourceType: string, sourceRef: string | null,
  sourceRevision: string | null, remoteRevision: string | null,
  sourceRefResolved: string | null, sourceSubpath: string | null,
  sourceBranch: string | null,
  contentHash: string | null, updateStatus: string,
): void {
  const database = getDb();
  const now = Date.now();
  database.prepare(`
    UPDATE skills SET name = @name, description = @description,
      source_type = @sourceType, source_ref = @sourceRef,
      source_revision = @sourceRevision, remote_revision = @remoteRevision,
      source_ref_resolved = @sourceRefResolved, source_subpath = @sourceSubpath,
      source_branch = @sourceBranch,
      content_hash = @contentHash, update_status = @updateStatus,
      last_checked_at = @now, last_check_error = NULL, updated_at = @now
    WHERE id = @id
  `).run({ id, name, description, sourceType, sourceRef, sourceRevision, remoteRevision, sourceRefResolved, sourceSubpath, sourceBranch, contentHash, updateStatus, now });
}

export function updateSkillCheckState(
  id: string, remoteRevision: string | null,
  updateStatus: string, lastCheckError: string | null,
): void {
  const database = getDb();
  database.prepare(`
    UPDATE skills SET remote_revision = COALESCE(@remoteRevision, remote_revision),
      update_status = @updateStatus, last_checked_at = @now,
      last_check_error = @lastCheckError, updated_at = @now
    WHERE id = @id
  `).run({ id, remoteRevision, updateStatus, lastCheckError, now: Date.now() });
}

export function updateSkillUpdateStatus(id: string, updateStatus: string): void {
  const database = getDb();
  database.prepare("UPDATE skills SET update_status = ?, updated_at = ? WHERE id = ?").run(updateStatus, Date.now(), id);
}

export function updateSkillSourceMetadata(
  id: string, sourceRef: string | null, sourceSubpath: string | null,
  sourceBranch: string | null, sourceRevision: string | null,
): void {
  const database = getDb();
  database.prepare(`
    UPDATE skills SET source_ref = COALESCE(@sourceRef, source_ref),
      source_subpath = COALESCE(@sourceSubpath, source_subpath),
      source_branch = COALESCE(@sourceBranch, source_branch),
      source_revision = COALESCE(@sourceRevision, source_revision),
      updated_at = @now
    WHERE id = @id
  `).run({ id, sourceRef, sourceSubpath, sourceBranch, sourceRevision, now: Date.now() });
}

// ── Scenarios CRUD ──

export function getAllScenarios(): ScenarioRecord[] {
  const database = getDb();
  return database.prepare("SELECT * FROM scenarios ORDER BY sort_order, name").all() as ScenarioRecord[];
}

export function getScenarioById(id: string): ScenarioRecord | undefined {
  const database = getDb();
  return database.prepare("SELECT * FROM scenarios WHERE id = ?").get(id) as ScenarioRecord | undefined;
}

export function insertScenario(record: ScenarioRecord): void {
  const database = getDb();
  database.prepare(`
    INSERT INTO scenarios (id, name, description, icon, sort_order, created_at, updated_at)
    VALUES (@id, @name, @description, @icon, @sort_order, @created_at, @updated_at)
  `).run(record as unknown as Record<string, unknown>);
}

export function updateScenario(id: string, name: string, description: string | null, icon: string | null): void {
  const database = getDb();
  database.prepare("UPDATE scenarios SET name = ?, description = ?, icon = ?, updated_at = ? WHERE id = ?")
    .run(name, description, icon, Date.now(), id);
}

export function deleteScenario(id: string): void {
  const database = getDb();
  database.prepare("DELETE FROM scenarios WHERE id = ?").run(id);
}

export function reorderScenarios(ids: string[]): void {
  const database = getDb();
  const stmt = database.prepare("UPDATE scenarios SET sort_order = ? WHERE id = ?");
  const tx = database.transaction(() => {
    ids.forEach((id, index) => stmt.run(index, id));
  });
  tx();
}

// ── Scenario-Skills ──

export function addSkillToScenario(scenarioId: string, skillId: string): void {
  const database = getDb();
  const maxOrder = database.prepare("SELECT MAX(sort_order) as m FROM scenario_skills WHERE scenario_id = ?").get(scenarioId) as { m: number | null };
  const nextOrder = (maxOrder?.m ?? -1) + 1;
  database.prepare("INSERT OR IGNORE INTO scenario_skills (scenario_id, skill_id, sort_order) VALUES (?, ?, ?)")
    .run(scenarioId, skillId, nextOrder);
}

export function removeSkillFromScenario(scenarioId: string, skillId: string): void {
  const database = getDb();
  database.prepare("DELETE FROM scenario_skills WHERE scenario_id = ? AND skill_id = ?").run(scenarioId, skillId);
}

export function getSkillIdsForScenario(scenarioId: string): string[] {
  const database = getDb();
  const rows = database.prepare("SELECT skill_id FROM scenario_skills WHERE scenario_id = ? ORDER BY sort_order").all(scenarioId) as Array<{ skill_id: string }>;
  return rows.map((row) => row.skill_id);
}

export function getScenariosForSkill(skillId: string): string[] {
  const database = getDb();
  const rows = database.prepare("SELECT scenario_id FROM scenario_skills WHERE skill_id = ?").all(skillId) as Array<{ scenario_id: string }>;
  return rows.map((row) => row.scenario_id);
}

export function countSkillsForScenario(scenarioId: string): number {
  const database = getDb();
  const row = database.prepare("SELECT COUNT(*) as c FROM scenario_skills WHERE scenario_id = ?").get(scenarioId) as { c: number };
  return row.c;
}

export function reorderScenarioSkills(scenarioId: string, skillIds: string[]): void {
  const database = getDb();
  const stmt = database.prepare("UPDATE scenario_skills SET sort_order = ? WHERE scenario_id = ? AND skill_id = ?");
  const tx = database.transaction(() => {
    skillIds.forEach((skillId, index) => stmt.run(index, scenarioId, skillId));
  });
  tx();
}

// ── Scenario-Skill-Tools ──

export function ensureScenarioSkillToolDefaults(scenarioId: string, skillId: string, toolKeys: string[]): void {
  const database = getDb();
  const stmt = database.prepare("INSERT OR IGNORE INTO scenario_skill_tools (scenario_id, skill_id, tool, enabled) VALUES (?, ?, ?, 1)");
  const tx = database.transaction(() => {
    for (const tool of toolKeys) {
      stmt.run(scenarioId, skillId, tool);
    }
  });
  tx();
}

export function setScenarioSkillToolEnabled(scenarioId: string, skillId: string, tool: string, enabled: boolean): void {
  const database = getDb();
  database.prepare("INSERT OR REPLACE INTO scenario_skill_tools (scenario_id, skill_id, tool, enabled) VALUES (?, ?, ?, ?)")
    .run(scenarioId, skillId, tool, enabled ? 1 : 0);
}

export function getEnabledToolsForScenarioSkill(scenarioId: string, skillId: string): string[] {
  const database = getDb();
  const rows = database.prepare("SELECT tool FROM scenario_skill_tools WHERE scenario_id = ? AND skill_id = ? AND enabled = 1").all(scenarioId, skillId) as Array<{ tool: string }>;
  return rows.map((row) => row.tool);
}

export function getScenarioSkillToolToggles(scenarioId: string, skillId: string): Array<{ tool: string; enabled: boolean }> {
  const database = getDb();
  return database.prepare("SELECT tool, enabled FROM scenario_skill_tools WHERE scenario_id = ? AND skill_id = ?").all(scenarioId, skillId) as Array<{ tool: string; enabled: boolean }>;
}

// ── Targets ──

export function getAllTargets(): SkillTargetRecord[] {
  const database = getDb();
  return database.prepare("SELECT * FROM skill_targets").all() as SkillTargetRecord[];
}

export function getTargetsForSkill(skillId: string): SkillTargetRecord[] {
  const database = getDb();
  return database.prepare("SELECT * FROM skill_targets WHERE skill_id = ?").all(skillId) as SkillTargetRecord[];
}

export function insertTarget(record: SkillTargetRecord): void {
  const database = getDb();
  database.prepare(`
    INSERT OR REPLACE INTO skill_targets (id, skill_id, tool, target_path, mode, status, synced_at, last_error)
    VALUES (@id, @skill_id, @tool, @target_path, @mode, @status, @synced_at, @last_error)
  `).run(record as unknown as Record<string, unknown>);
}

export function deleteTarget(skillId: string, tool: string): void {
  const database = getDb();
  database.prepare("DELETE FROM skill_targets WHERE skill_id = ? AND tool = ?").run(skillId, tool);
}

// ── Tags ──

export function getAllTags(): string[] {
  const database = getDb();
  const rows = database.prepare("SELECT DISTINCT tag FROM skill_tags ORDER BY tag").all() as Array<{ tag: string }>;
  return rows.map((row) => row.tag);
}

export function getTagsMap(): Record<string, string[]> {
  const database = getDb();
  const rows = database.prepare("SELECT skill_id, tag FROM skill_tags ORDER BY tag").all() as Array<{ skill_id: string; tag: string }>;
  const map: Record<string, string[]> = {};
  for (const row of rows) {
    if (!map[row.skill_id]) map[row.skill_id] = [];
    map[row.skill_id].push(row.tag);
  }
  return map;
}

export function setTagsForSkill(skillId: string, tags: string[]): void {
  const database = getDb();
  const tx = database.transaction(() => {
    database.prepare("DELETE FROM skill_tags WHERE skill_id = ?").run(skillId);
    const stmt = database.prepare("INSERT INTO skill_tags (skill_id, tag) VALUES (?, ?)");
    for (const tag of tags) {
      stmt.run(skillId, tag);
    }
  });
  tx();
}

// ── Settings ──

export function getSetting(key: string): string | undefined {
  const database = getDb();
  const row = database.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  const database = getDb();
  database.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}

// ── Active Scenario ──

export function getActiveScenarioId(): string | undefined {
  return getSetting("active_scenario_id");
}

export function setActiveScenario(id: string): void {
  setSetting("active_scenario_id", id);
}

export function clearActiveScenario(): void {
  const database = getDb();
  database.prepare("DELETE FROM settings WHERE key = 'active_scenario_id'").run();
}

// ── Scenario queries joining skills ──

export function getSkillsForScenario(scenarioId: string): SkillRecord[] {
  const database = getDb();
  return database.prepare(`
    SELECT s.* FROM skills s
    JOIN scenario_skills ss ON s.id = ss.skill_id
    WHERE ss.scenario_id = ?
    ORDER BY ss.sort_order, s.name
  `).all(scenarioId) as SkillRecord[];
}
