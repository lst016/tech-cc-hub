# src/electron/libs/skill-manager/ipc-handlers.ts

> 模块：`electron` · 语言：`typescript` · 行数：1311

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `registerSkillIpcHandler@91`
- `handleSkillManagerInvoke@96`
- `initSkillManager@105`
- `managedSkillToDto@121`
- `managedSkillById@166`
- `reimportLocalSkill@172`
- `findSkillDir@218`
- `installSkillsshSkill@256`
- `normalizeGitRepoUrl@336`
- `cloneGitRepo@347`
- `extractProcessErrorMessage@363`
- `readGitRepoMetadata@370`
- `discoverGitSkillDirs@400`
- `previewGitInstall@438`
- `isSafeGitPreviewTempDir@460`
- `resolveGitPreviewSkillDir@467`
- `gitSourceRef@485`
- `installGitSkillSelection@489`
- `confirmGitInstall@578`
- `cleanupGitPreviewTempDir@610`
- `registerSkillManagerHandlers@624`
- `initialized@85`
- `skillIpcHandlers@89`
- `handler@99`
- `allTargets@123`
- `tagsMap@124`
- `scenario_ids@137`
- `tags@139`
- `skill@168`
- `skill@174`
- `sourcePath@180`
- `stagedPath@184`
- `result@189`
- `backupPath@190`
- `targets@209`
- `directCandidates@220`
- `queue@228`
- `ignored@230`
- `dir@232`
- `tail@234`

## 依赖输入

- `crypto`
- `child_process`
- `electron`
- `fs`
- `path`
- `os`
- `./db.js`
- `./central-repo.js`
- `./tool-adapters.js`
- `./installer.js`
- `./sync-engine.js`
- `./scenarios.js`
- `./scanner.js`
- `./marketplace.js`
- `./types.js`

## 对外暴露

- `handleSkillManagerInvoke`
- `initSkillManager`
- `registerSkillManagerHandlers`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
  ipcMain.handle(channel, (_event: any, ...args: any[]) => handler(...args));
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
    remote_revision: skill.r
... (truncated)
```
