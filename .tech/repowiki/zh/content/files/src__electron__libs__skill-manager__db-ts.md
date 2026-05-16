# src/electron/libs/skill-manager/db.ts

> 模块：`electron` · 语言：`typescript` · 行数：426

## 文件职责

Skill和Scenario的SQLite数据库管理，使用better-sqlite3实现CRUD操作和迁移

## 运行信号

- `create table: skills`
- `create table: scenarios`
- `create table: scenario_skills`
- `create table: scenario_skill_tools`
- `create table: skill_targets`
- `create table: skill_tags`
- `create table: settings`

## 关键符号

- `getDb@0 - 获取或创建SQLite数据库单例，确保WAL模式和外键启用`
- `migrate@0 - 执行数据库迁移，创建skills、scenarios、scenario_skills、skill_targets、skill_tags、settings等表及索引`
- `getAllSkills@0 - 获取所有技能记录，按名称排序`
- `insertSkill@0 - 插入新技能记录`
- `updateSkillAfterInstall@0 - 技能安装后更新状态和元数据`
- `getAllScenarios@0 - 获取所有场景配置`
- `addSkillToScenario@0 - 将技能添加到场景`
- `reorderScenarios@0 - 重新排序场景列表`

## 依赖输入

- `better-sqlite3`
- `electron`
- `path`
- `fs`
- `./types.js`

## 对外暴露

- `getDb`
- `getAllSkills`
- `getSkillById`
- `getSkillByCentralPath`
- `getSkillBySourceRef`
- `insertSkill`
- `deleteSkill`
- `updateSkillAfterInstall`
- `updateSkillAfterReinstall`
- `updateSkillCheckState`
- `updateSkillUpdateStatus`
- `updateSkillSourceMetadata`
- `getAllScenarios`
- `getScenarioById`
- `insertScenario`
- `updateScenario`
- `deleteScenario`
- `reorderScenarios`
- `addSkillToScenario`
- `removeSkillFromScenario`
- `getSkillIdsForScenario`
- `getScenariosForSkill`
- `countSkillsForScenario`
- `reorderScenarioSkills`
- `ensureScenarioSkillToolDefaults`
- `setScenarioSkillToolEnabled`
- `getEnabledToolsForScenarioSkill`
- `getScenarioSkillToolToggles`
- `getAllTargets`
- `getTargetsForSkill`
- `insertTarget`
- `deleteTarget`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  c
... (truncated)
```
