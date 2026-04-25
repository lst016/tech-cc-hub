import { app } from "electron";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  realpathSync,
  statSync,
} from "fs";
import { basename, dirname, join } from "path";
import { homedir } from "os";

export type ApiType = "anthropic";

export type ApiModelConfig = {
  name: string;
  contextWindow?: number;
  compressionThresholdPercent?: number;
};

export type ApiConfig = {
  id: string;
  name: string;
  apiKey: string;
  baseURL: string;
  model: string;
  expertModel?: string;
  imageModel?: string;
  analysisModel?: string;
  models?: ApiModelConfig[];
  enabled: boolean;
  apiType?: ApiType;
};

export type ApiConfigSettings = {
  profiles: ApiConfig[];
};

export type SkillSourceType = "manual" | "git";

export type SkillKind = "single" | "bundle";

export type InstalledSkillRecord = {
  id: string;
  name: string;
  kind: SkillKind;
  path: string;
  sourceType: SkillSourceType;
  installedAt?: number;
  syncEnabled?: boolean;
  remoteUrl?: string;
  remoteSubpath?: string;
  branch?: string;
  lastPulledAt?: number;
  lastCheckedAt?: number;
  checkEveryHours?: number;
  lastKnownCommit?: string;
  lastError?: string;
};

export type SkillInventory = {
  rootPath: string;
  skills: InstalledSkillRecord[];
};

type SkillLockEntry = {
  sourceUrl?: string;
  skillPath?: string;
  installedAt?: string;
  updatedAt?: string;
};

type SkillLockIndexEntry = {
  name: string;
  actualPath: string;
  remoteUrl?: string;
  remoteSubpath?: string;
  installedAt?: number;
  updatedAt?: number;
};

type SkillLockIndex = {
  byResolvedPath: Map<string, SkillLockIndexEntry>;
  byName: Map<string, SkillLockIndexEntry>;
};

type DiscoveredInstalledSkill = InstalledSkillRecord & {
  resolvedPath: string;
};

export type SkillSyncRequest = {
  skillIds?: string[];
  force?: boolean;
};

export type SkillSyncResult = {
  skillId: string;
  skillName: string;
  status: "updated" | "checked" | "skipped" | "error";
  message?: string;
  previousCommit?: string;
  latestCommit?: string;
  checkedAt: number;
};

export type SkillSyncResponse = {
  results: SkillSyncResult[];
};

export type GlobalRuntimeConfig = Record<string, unknown>;

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_MODEL_CONFIG: ApiModelConfig = {
  name: DEFAULT_MODEL,
  compressionThresholdPercent: 70,
};
const CONFIG_FILE_NAME = "api-config.json";
const GLOBAL_CONFIG_FILE_NAME = "agent-runtime.json";
const SKILL_INVENTORY_FILE_NAME = "skill-inventory.json";
const LEGACY_SKILL_REGISTRY_FILE_NAME = "skill-registry.json";
const DEFAULT_SKILL_PATH = join(homedir(), ".claude", "skills");
const DEFAULT_SKILL_LOCK_PATHS = [
  join(homedir(), ".agents", ".skill-lock.json"),
  join(homedir(), ".skill-global", ".skill-lock.json"),
];

function getConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, CONFIG_FILE_NAME);
}

function getGlobalConfigPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, GLOBAL_CONFIG_FILE_NAME);
}

export function getDefaultSkillPath(): string {
  return DEFAULT_SKILL_PATH;
}

function getSkillInventoryPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, SKILL_INVENTORY_FILE_NAME);
}

function getLegacySkillRegistryPath(): string {
  const userDataPath = app.getPath("userData");
  return join(userDataPath, LEGACY_SKILL_REGISTRY_FILE_NAME);
}

function createDefaultSettings(): ApiConfigSettings {
  return {
    profiles: [
      {
        id: crypto.randomUUID(),
        name: "默认配置",
        apiKey: "",
        baseURL: "https://api.anthropic.com",
        model: DEFAULT_MODEL,
        expertModel: DEFAULT_MODEL,
        imageModel: undefined,
        analysisModel: DEFAULT_MODEL,
        models: [DEFAULT_MODEL_CONFIG],
        enabled: true,
        apiType: "anthropic",
      },
    ],
  };
}

export function loadApiConfigSettings(): ApiConfigSettings {
  try {
    const configPath = getConfigPath();
    if (!existsSync(configPath)) {
      return createDefaultSettings();
    }
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as ApiConfig | ApiConfigSettings;
    return normalizeApiSettings(parsed);
  } catch (error) {
    console.error("[config-store] Failed to load API config:", error);
    return createDefaultSettings();
  }
}

export function saveApiConfigSettings(settings: ApiConfigSettings): void {
  try {
    const configPath = getConfigPath();
    const userDataPath = app.getPath("userData");

    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }

    const normalized = normalizeApiSettings(settings);
    if (normalized.profiles.length === 0) {
      throw new Error("Invalid config: at least one valid profile is required");
    }

    writeFileSync(configPath, JSON.stringify(normalized, null, 2), "utf8");
    console.info("[config-store] API config saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save API config:", error);
    throw error;
  }
}

function createDefaultSkillInventory(): SkillInventory {
  return {
    rootPath: DEFAULT_SKILL_PATH,
    skills: [],
  };
}

export function loadSkillInventory(): SkillInventory {
  try {
    const inventoryPath = getSkillInventoryPath();
    if (existsSync(inventoryPath)) {
      const raw = readFileSync(inventoryPath, "utf8");
      const parsed = JSON.parse(raw);
      return reconcileSkillInventory(normalizeSkillInventory(parsed));
    }

    const legacyPath = getLegacySkillRegistryPath();
    if (existsSync(legacyPath)) {
      const raw = readFileSync(legacyPath, "utf8");
      const parsed = JSON.parse(raw);
      return reconcileSkillInventory(migrateLegacySkillRegistry(parsed));
    }

    return reconcileSkillInventory(createDefaultSkillInventory());
  } catch (error) {
    console.error("[config-store] Failed to load skill inventory:", error);
    return reconcileSkillInventory(createDefaultSkillInventory());
  }
}

export function saveSkillInventory(inventory: unknown): void {
  try {
    const inventoryPath = getSkillInventoryPath();
    const userDataPath = app.getPath("userData");

    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }

    const normalized = normalizeSkillInventory(inventory);
    writeFileSync(inventoryPath, JSON.stringify(normalized, null, 2), "utf8");
    console.info("[config-store] Skill inventory saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save skill inventory:", error);
    throw error;
  }
}

export function deleteApiConfig(): void {
  try {
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      unlinkSync(configPath);
      console.info("[config-store] API config deleted");
    }
  } catch (error) {
    console.error("[config-store] Failed to delete API config:", error);
  }
}

export function loadGlobalRuntimeConfig(): GlobalRuntimeConfig {
  try {
    const configPath = getGlobalConfigPath();
    if (!existsSync(configPath)) {
      return {};
    }

    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      console.error("[config-store] Invalid global runtime config format, expecting object:", configPath);
      return {};
    }

    return parsed as GlobalRuntimeConfig;
  } catch (error) {
    console.error("[config-store] Failed to load global runtime config:", error);
    return {};
  }
}

export function saveGlobalRuntimeConfig(config: GlobalRuntimeConfig): void {
  try {
    const configPath = getGlobalConfigPath();
    const userDataPath = app.getPath("userData");

    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true });
    }

    if (typeof config !== "object" || config === null || Array.isArray(config)) {
      throw new Error("Invalid global runtime config: expected an object");
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    console.info("[config-store] Global runtime config saved successfully");
  } catch (error) {
    console.error("[config-store] Failed to save global runtime config:", error);
    throw error;
  }
}

function normalizeApiConfig(config: ApiConfig | null | undefined): ApiConfig | null {
  if (!config?.baseURL || !config.name) {
    return null;
  }

  const dedupedModels = dedupeModelConfigs([
    config.model,
    config.expertModel,
    config.imageModel,
    config.analysisModel,
    ...(config.models ?? []),
  ]);
  const dedupedModelNames = dedupedModels.map((item) => item.name);
  const selectedModel = config.model?.trim() || dedupedModelNames[0];
  if (!selectedModel) {
    return null;
  }

  if (!dedupedModelNames.includes(selectedModel)) {
    dedupedModels.unshift({
      name: selectedModel,
      compressionThresholdPercent: 70,
    });
  }

  return {
    id: config.id?.trim() || crypto.randomUUID(),
    name: config.name.trim(),
    apiKey: config.apiKey.trim(),
    baseURL: config.baseURL.trim(),
    model: selectedModel,
    expertModel: normalizeRoleModel(config.expertModel, selectedModel),
    imageModel: normalizeOptionalModel(config.imageModel, dedupedModelNames),
    analysisModel: normalizeRoleModel(config.analysisModel, selectedModel),
    models: dedupedModels,
    enabled: Boolean(config.enabled),
    apiType: config.apiType ?? "anthropic",
  };
}

function normalizeApiSettings(input: ApiConfig | ApiConfigSettings | null | undefined): ApiConfigSettings {
  const rawProfiles = Array.isArray((input as ApiConfigSettings | undefined)?.profiles)
    ? (input as ApiConfigSettings).profiles
    : input
      ? [input as ApiConfig]
      : [];

  const profiles = rawProfiles
    .map((profile) => normalizeApiConfig(profile))
    .filter((profile): profile is ApiConfig => Boolean(profile));

  if (profiles.length === 0) {
    return { profiles: [] };
  }

  let hasEnabled = false;
  const normalizedProfiles = profiles.map((profile) => {
    if (profile.enabled && !hasEnabled) {
      hasEnabled = true;
      return profile;
    }
    return { ...profile, enabled: false };
  });

  if (!hasEnabled) {
    normalizedProfiles[0] = { ...normalizedProfiles[0], enabled: true };
  }

  return { profiles: normalizedProfiles };
}

function normalizeSkillInventory(input: unknown): SkillInventory {
  const rootPath = typeof (input as SkillInventory | undefined)?.rootPath === "string"
    ? ((input as SkillInventory).rootPath || "").trim()
    : DEFAULT_SKILL_PATH;
  const rawSkills = Array.isArray((input as SkillInventory | undefined)?.skills)
    ? (input as SkillInventory).skills
    : [];

  const skills = rawSkills
    .map((skill) => normalizeInstalledSkill(skill))
    .filter((skill): skill is InstalledSkillRecord => Boolean(skill))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    rootPath: rootPath || DEFAULT_SKILL_PATH,
    skills,
  };
}

function normalizeInstalledSkill(input: unknown): InstalledSkillRecord | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const skill = input as Partial<InstalledSkillRecord>;
  const path = typeof skill.path === "string" ? skill.path.trim() : "";
  const name = typeof skill.name === "string" ? skill.name.trim() : "";
  const kind: SkillKind = skill.kind === "bundle" ? "bundle" : "single";
  const sourceType: SkillSourceType = skill.sourceType === "git" ? "git" : "manual";

  return {
    id: typeof skill.id === "string" && skill.id.trim() ? skill.id.trim() : crypto.randomUUID(),
    name: name || basename(path) || "未命名 Skill",
    kind,
    path,
    sourceType,
    installedAt: normalizePositiveIntegerOrUndefined(skill.installedAt),
    syncEnabled: sourceType === "git",
    remoteUrl: sourceType === "git" && typeof skill.remoteUrl === "string" ? skill.remoteUrl.trim() : undefined,
    remoteSubpath: sourceType === "git" && typeof skill.remoteSubpath === "string"
      ? normalizeRepoSubpath(skill.remoteSubpath)
      : undefined,
    branch: sourceType === "git" && typeof skill.branch === "string" ? skill.branch.trim() : undefined,
    lastPulledAt: normalizePositiveIntegerOrUndefined(skill.lastPulledAt),
    lastCheckedAt: normalizePositiveIntegerOrUndefined(skill.lastCheckedAt),
    checkEveryHours: sourceType === "git" && typeof skill.checkEveryHours === "number" && Number.isFinite(skill.checkEveryHours)
      ? Math.max(1, Math.floor(skill.checkEveryHours))
      : undefined,
    lastKnownCommit: typeof skill.lastKnownCommit === "string" ? skill.lastKnownCommit.trim() : undefined,
    lastError: typeof skill.lastError === "string" ? skill.lastError : undefined,
  };
}

function migrateLegacySkillRegistry(input: unknown): SkillInventory {
  const defaultInventory = createDefaultSkillInventory();
  const rawSources = Array.isArray((input as { sources?: unknown[] } | undefined)?.sources)
    ? ((input as { sources: unknown[] }).sources ?? [])
    : [];

  const localRoot = rawSources
    .map((source) => source as Record<string, unknown>)
    .find((source) => source?.kind === "local" && typeof source.path === "string");

  const rootPath = typeof localRoot?.path === "string" && localRoot.path.trim()
    ? localRoot.path.trim()
    : defaultInventory.rootPath;

  const skills = rawSources
    .map((source) => migrateLegacySourceToSkill(source))
    .filter((skill): skill is InstalledSkillRecord => Boolean(skill));

  return {
    rootPath,
    skills,
  };
}

function migrateLegacySourceToSkill(input: unknown): InstalledSkillRecord | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const legacy = input as Record<string, unknown>;
  if (legacy.kind !== "remote") {
    return null;
  }

  const rawPath = typeof legacy.path === "string" ? legacy.path.trim() : "";
  if (!rawPath) {
    return null;
  }

  const kind: SkillKind = legacy.scope === "bundle" ? "bundle" : "single";
  const path = resolveHomePath(rawPath);
  return {
    id: typeof legacy.id === "string" && legacy.id.trim() ? legacy.id.trim() : crypto.randomUUID(),
    name: typeof legacy.name === "string" && legacy.name.trim() ? legacy.name.trim() : basename(path),
    kind,
    path,
    sourceType: "git",
    installedAt: undefined,
    syncEnabled: true,
    remoteUrl: typeof legacy.gitUrl === "string" ? legacy.gitUrl.trim() : undefined,
    remoteSubpath: undefined,
    branch: typeof legacy.branch === "string" ? legacy.branch.trim() : undefined,
    lastPulledAt: normalizePositiveIntegerOrUndefined(legacy.lastPulledAt),
    lastCheckedAt: normalizePositiveIntegerOrUndefined(legacy.lastCheckedAt),
    checkEveryHours: typeof legacy.checkEveryHours === "number" && Number.isFinite(legacy.checkEveryHours)
      ? Math.max(1, Math.floor(legacy.checkEveryHours))
      : undefined,
    lastKnownCommit: typeof legacy.lastKnownCommit === "string" ? legacy.lastKnownCommit.trim() : undefined,
    lastError: typeof legacy.lastError === "string" ? legacy.lastError : undefined,
  };
}

function reconcileSkillInventory(inventory: SkillInventory): SkillInventory {
  const rootPath = inventory.rootPath.trim() || DEFAULT_SKILL_PATH;
  const normalizedRoot = resolveHomePath(rootPath);
  const lockIndex = loadSkillLockIndex();
  const existingByPath = new Map(
    inventory.skills.map((skill) => [normalizePathKey(skill.path), skill]),
  );
  const discoveredSkills = discoverInstalledSkills(normalizedRoot)
    .map((discovered) => {
      const existing = existingByPath.get(normalizePathKey(discovered.path));
      const locked = findLockedSkill(discovered, lockIndex);
      const sourceType: SkillSourceType = shouldAdoptLockedSourceMetadata(existing, locked)
        || existing?.sourceType === "git"
        ? "git"
        : discovered.sourceType;
      return {
        ...discovered,
        id: existing?.id ?? discovered.id,
        sourceType,
        syncEnabled: sourceType === "git",
        remoteUrl: sourceType === "git"
          ? existing?.remoteUrl?.trim() || locked?.remoteUrl
          : undefined,
        remoteSubpath: sourceType === "git"
          ? existing?.remoteSubpath?.trim() || locked?.remoteSubpath
          : undefined,
        branch: existing?.branch,
        lastPulledAt: existing?.lastPulledAt ?? locked?.updatedAt,
        lastCheckedAt: existing?.lastCheckedAt,
        checkEveryHours: existing?.checkEveryHours,
        lastKnownCommit: existing?.lastKnownCommit,
        lastError: existing?.lastError,
        installedAt: existing?.installedAt ?? locked?.installedAt ?? discovered.installedAt,
      } satisfies InstalledSkillRecord;
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    rootPath,
    skills: discoveredSkills,
  };
}

function discoverInstalledSkills(rootPath: string): InstalledSkillRecord[] {
  if (!existsSync(rootPath)) {
    return [];
  }

  return readdirSync(rootPath, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(rootPath, entry.name);

      try {
        const stats = statSync(fullPath);
        if (!stats.isDirectory()) {
          return [];
        }

        const kind = detectSkillKind(fullPath);
        if (!kind) {
          return [];
        }

        return [{
          id: crypto.randomUUID(),
          name: entry.name,
          kind,
          path: fullPath,
          resolvedPath: resolveRealPath(fullPath),
          sourceType: "manual" as const,
          installedAt: normalizePositiveIntegerOrUndefined(Math.floor(stats.birthtimeMs)),
          syncEnabled: false,
        } satisfies DiscoveredInstalledSkill];
      } catch {
        return [];
      }
    })
    .map((discovered) => {
      const { resolvedPath, ...skill } = discovered;
      void resolvedPath;
      return skill;
    });
}

function detectSkillKind(path: string): SkillKind | null {
  if (existsSync(join(path, "SKILL.md"))) {
    return "single";
  }

  if (existsSync(join(path, "skills"))) {
    return "bundle";
  }

  return null;
}

function resolveHomePath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") {
    return homedir();
  }

  const homePathMatch = /^~[\\/](.*)$/.exec(trimmed);
  if (!homePathMatch) {
    return trimmed;
  }

  const tail = homePathMatch[1];
  return tail
    ? join(homedir(), ...tail.split(/[/\\]/).filter(Boolean))
    : homedir();
}

function normalizePathKey(path: string): string {
  return resolveHomePath(path).replace(/[\\/]+/g, "/").toLowerCase();
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function normalizeRepoSubpath(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }

  const normalized = path.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
  return normalized || undefined;
}

function resolveRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function loadSkillLockIndex(): SkillLockIndex {
  const byResolvedPath = new Map<string, SkillLockIndexEntry>();
  const byName = new Map<string, SkillLockIndexEntry>();

  for (const lockPath of DEFAULT_SKILL_LOCK_PATHS) {
    if (!existsSync(lockPath)) {
      continue;
    }

    try {
      const raw = readFileSync(lockPath, "utf8");
      const parsed = JSON.parse(raw) as { skills?: Record<string, unknown> };
      const rawSkills = parsed.skills ?? {};

      for (const [skillName, entry] of Object.entries(rawSkills)) {
        const normalized = normalizeSkillLockEntry(skillName, entry, lockPath);
        if (!normalized) {
          continue;
        }

        byResolvedPath.set(normalizePathKey(resolveRealPath(normalized.actualPath)), normalized);
        if (!byName.has(normalizeNameKey(normalized.name))) {
          byName.set(normalizeNameKey(normalized.name), normalized);
        }
      }
    } catch (error) {
      console.warn("[config-store] Failed to load skill lock:", lockPath, error);
    }
  }

  return { byResolvedPath, byName };
}

function normalizeSkillLockEntry(
  skillName: string,
  input: unknown,
  lockPath: string,
): SkillLockIndexEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const entry = input as SkillLockEntry;
  const repoSubpath = normalizeRepoSubpath(typeof entry.skillPath === "string" ? dirname(entry.skillPath) : undefined);
  if (!repoSubpath) {
    return null;
  }

  return {
    name: skillName,
    actualPath: join(dirname(lockPath), ...repoSubpath.split("/").filter(Boolean)),
    remoteUrl: typeof entry.sourceUrl === "string" ? entry.sourceUrl.trim() || undefined : undefined,
    remoteSubpath: repoSubpath,
    installedAt: normalizeTimestampString(entry.installedAt),
    updatedAt: normalizeTimestampString(entry.updatedAt),
  };
}

function findLockedSkill(
  discovered: InstalledSkillRecord,
  index: SkillLockIndex,
): SkillLockIndexEntry | undefined {
  const byPath = index.byResolvedPath.get(normalizePathKey(resolveRealPath(discovered.path)));
  if (byPath) {
    return byPath;
  }

  return index.byName.get(normalizeNameKey(discovered.name));
}

function shouldAdoptLockedSourceMetadata(
  existing: InstalledSkillRecord | undefined,
  locked: SkillLockIndexEntry | undefined,
): boolean {
  if (!locked) {
    return false;
  }

  if (!existing) {
    return true;
  }

  if (existing.sourceType === "git") {
    return true;
  }

  return isDefaultManualSkill(existing);
}

function isDefaultManualSkill(skill: InstalledSkillRecord): boolean {
  return skill.sourceType !== "git"
    && !skill.remoteUrl
    && !skill.remoteSubpath
    && !skill.branch
    && !skill.lastKnownCommit
    && !skill.lastPulledAt
    && !skill.lastCheckedAt;
}

function normalizeTimestampString(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function normalizePositiveIntegerOrUndefined(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizeModelConfig(input: string | ApiModelConfig | null | undefined): ApiModelConfig | null {
  if (typeof input === "string") {
    const name = input.trim();
    if (!name) {
      return null;
    }
    return {
      name,
      compressionThresholdPercent: 70,
    };
  }

  if (!input) {
    return null;
  }

  const name = input.name?.trim();
  if (!name) {
    return null;
  }

  return {
    name,
    contextWindow: normalizePositiveInteger(input.contextWindow),
    compressionThresholdPercent: normalizePercent(input.compressionThresholdPercent) ?? 70,
  };
}

function dedupeModelConfigs(inputs: Array<string | ApiModelConfig | null | undefined>): ApiModelConfig[] {
  const deduped = new Map<string, ApiModelConfig>();

  for (const input of inputs) {
    const model = normalizeModelConfig(input);
    if (!model) {
      continue;
    }

    const previous = deduped.get(model.name);
    deduped.set(model.name, {
      name: model.name,
      contextWindow: model.contextWindow ?? previous?.contextWindow,
      compressionThresholdPercent: model.compressionThresholdPercent ?? previous?.compressionThresholdPercent ?? 70,
    });
  }

  return Array.from(deduped.values());
}

function normalizePositiveInteger(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : undefined;
}

function normalizePercent(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const normalized = Math.floor(value);
  if (normalized < 1 || normalized > 100) {
    return undefined;
  }

  return normalized;
}

function normalizeRoleModel(value: string | undefined, fallbackModel: string): string {
  const normalized = value?.trim();
  return normalized || fallbackModel;
}

function normalizeOptionalModel(value: string | undefined, availableModels: string[]): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  return availableModels.includes(normalized) ? normalized : undefined;
}
