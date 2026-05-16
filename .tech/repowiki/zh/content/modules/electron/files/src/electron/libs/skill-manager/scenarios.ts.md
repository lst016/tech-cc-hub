# src/electron/libs/skill-manager/scenarios.ts

> 模块：`electron` · 语言：`typescript` · 行数：421

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `toScenarioDto@42`
- `getAllScenarioDtos@55`
- `getActiveScenarioDto@63`
- `ensureDefaultScenario@74`
- `createScenario@119`
- `updateScenarioInfo@155`
- `deleteScenarioAndCleanup@164`
- `reorderScenarioList@184`
- `applyScenarioToDefault@190`
- `addSkillToScenarioAndSync@211`
- `removeSkillFromScenarioAndSync@216`
- `reorderScenarioSkills@229`
- `syncScenarioSkills@244`
- `collectScenarioSyncTargets@249`
- `syncDesiredTargets@275`
- `unsyncObsoleteScenarioTargets@321`
- `unsyncScenarioSkills@343`
- `syncSkillToActiveScenario@357`
- `enabledInstalledAdaptersForScenarioSkill@406`
- `scenarios@57`
- `count@59`
- `activeId@65`
- `s@67`
- `count@70`
- `activeId@76`
- `active@78`
- `existing@85`
- `now@92`
- `id@94`
- `now@125`
- `id@126`
- `previousActiveId@127`
- `wasActive@166`
- `remaining@175`
- `scenario@192`
- `desiredTargets@194`
- `oldId@198`
- `activeId@219`
- `targets@222`
- `desiredTargets@246`

## 依赖输入

- `path`
- `crypto`
- `./types.js`
- `./db.js`
- `./tool-adapters.js`
- `./sync-engine.js`

## 对外暴露

- `toScenarioDto`
- `getAllScenarioDtos`
- `getActiveScenarioDto`
- `ensureDefaultScenario`
- `createScenario`
- `updateScenarioInfo`
- `deleteScenarioAndCleanup`
- `reorderScenarioList`
- `applyScenarioToDefault`
- `addSkillToScenarioAndSync`
- `removeSkillFromScenarioAndSync`
- `reorderScenarioSkills`
- `syncScenarioSkills`
- `syncSkillToActiveScenario`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

export function reorderScenarioList(ids:
... (truncated)
```
