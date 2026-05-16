# src/electron/libs/skill-manager/index.ts

> 模块：`electron` · 语言：`typescript` · 行数：88

## 文件职责

skill-manager模块的统一导出入口，重导出所有子模块的公开API

## 关键符号

- `模块导出@0 - 从db.js导出数据库操作、从central-repo.js导出中央仓库、从tool-adapters.js导出工具适配器、从sync-engine.js导出同步引擎、从installer.js导出安装器、从scanner.js导出扫描器、从scenarios.js导出场景管理、从marketplace.js导出市场API`

## 对外暴露

- `getDb`
- `getAllSkills`
- `getSkillById`
- `getSkillByCentralPath`
- `insertSkill`
- `updateSkillAfterInstall`
- `updateSkillAfterReinstall`
- `updateSkillSourceMetadata`
- `deleteSkill`
- `getAllScenarios`
- `getActiveScenarioId`
- `getAllTargets`
- `getTargetsForSkill`
- `insertTarget`
- `deleteTarget`
- `getTagsMap`
- `getAllTags`
- `setTagsForSkill`
- `getScenariosForSkill`
- `getSkillsForScenarioDb`
- `getSkillIdsForScenario`
- `getSetting`
- `setSetting`
- `ensureScenarioSkillToolDefaults`
- `getScenarioSkillToolToggles`
- `setScenarioSkillToolEnabled`
- `addSkillToScenario`
- `ensureCentralRepo`
- `centralSkillsDir`
- `defaultToolAdapters`
- `allToolAdapters`
- `enabledInstalledAdapters`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from skills-manager
// Module index for skill-manager - unified exports

export * from "./types.js";
export {
  getDb,
  getAllSkills,
  getSkillById,
  getSkillByCentralPath,
  insertSkill,
  updateSkillAfterInstall,
  updateSkillAfterReinstall,
  updateSkillSourceMetadata,
  deleteSkill,
  getAllScenarios,
  getActiveScenarioId,
  getAllTargets,
  getTargetsForSkill,
  insertTarget,
  deleteTarget,
  getTagsMap,
  getAllTags,
  setTagsForSkill,
  getScenariosForSkill,
  getSkillsForScenario as getSkillsForScenarioDb,
  getSkillIdsForScenario,
  getSetting,
  setSetting,
  ensureScenarioSkillToolDefaults,
  getScenarioSkillToolToggles,
  setScenarioSkillToolEnabled,
  addSkillToScenario,
} from "./db.js";
export {
  ensureCentralRepo,
  skillsDir as centralSkillsDir,
} from "./central-repo.js";
export {
  defaultToolAdapters,
  allToolAdapters,
  enabledInstalledAdapters,
  findAdapter,
  findAdapterWithStore,
  isInstalled,
  hasPathOverride,
  skillsDir as toolSkillsDir,
  allScanDirs,
  additionalExistingScanDirs,
  customToolPaths,
  customTools,
} from "./tool-adapters.js";
export {
  inferSkillName,
  is_valid_skill_dir,
  parseSkillMd,
  syncSkill,
  removeTarget,
  targetDirName,
  syncModeForTool,
  isTargetCurrent,
} from "./sync-engine.js";
export {
  installFromLocal,
  installSkillDirToDestination,
} from "./installer.js";
export {
  scanLocalSkills,
  groupDiscovered,
  matchImportedSkillId,
} from "./scanner.js";
export {
  getAllScenarioDtos,
  getActiveScenarioDto,
  createScenario,
  updateScenarioInfo,
  deleteScenarioAndCleanup,
  applyScenarioToDefault,
  ensureDefaultScenario,
  addSkillToScenarioAndSync,
  removeSkillFromScenarioAndSync,
  reorderScenarioList,
  toScenarioDto,
} from "./scenarios.js";
export {
  fetchLeaderboard,
  searchSkillssh,
} from "./marketplace.js";

```
