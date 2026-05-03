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
