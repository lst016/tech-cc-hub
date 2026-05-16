import {
  existsSync,
  readFileSync,
  readdirSync,
} from "fs";
import { homedir } from "os";
import { basename, dirname, extname, isAbsolute, join } from "path";
import type { PromptLedgerSource } from "../../shared/prompt-ledger.js";
import { DEFAULT_RESTRICTED_ALLOWED_TOOLS } from "../../shared/claude-agent-teams.js";
import { buildTechCCHubSystemPromptSources } from "./system-prompt-presets.js";

export type AgentRunSurface = "development" | "maintenance";

export type AgentScope = "system" | "user" | "project";

type AgentProfileManifest = {
  id?: string;
  name?: string;
  description?: string;
  prompt?: string;
  promptFile?: string;
  skills?: string[];
  allowedTools?: string[];
  enabled?: boolean;
  autoApply?: boolean;
  runSurface?: AgentRunSurface | "both";
  visibility?: "internal" | "user";
};

type AgentContextDocument = {
  scope: AgentScope;
  path: string;
  label: string;
  content: string;
};

export type ResolvedAgentProfile = {
  id: string;
  scope: AgentScope;
  sourcePath?: string;
  name: string;
  description?: string;
  prompt: string;
  skills: string[];
  allowedTools?: string[];
  autoApply: boolean;
  runSurface: AgentRunSurface | "both";
  visibility: "internal" | "user";
};

export type ResolvedAgentRuntimeContext = {
  surface: AgentRunSurface;
  selectedAgentId?: string;
  settingSources: Array<"user" | "project">;
  systemPromptAppend?: string;
  promptSources: PromptLedgerSource[];
  skills: string[];
  allowedTools?: string[];
  enforceAllowedTools: boolean;
  appliedProfiles: ResolvedAgentProfile[];
};

const USER_CLAUDE_ROOT = join(homedir(), ".claude");
const DEFAULT_SYSTEM_MAINTENANCE_ID = "system-maintenance";

const BUILT_IN_SYSTEM_PROFILES: ResolvedAgentProfile[] = [
  {
    id: DEFAULT_SYSTEM_MAINTENANCE_ID,
    scope: "system",
    name: "软件维护 Agent",
    description: "仅用于软件自身维护、巡检、资产治理和版本整理。",
    prompt: [
      "你是应用内置的系统维护 Agent。",
      "你的职责只包括软件自维护、内置资产治理、技能版本管理、配置巡检和修复。",
      "不要把自己当成普通开发助手，不要接管用户项目开发任务。",
      "除非明确被路由到维护面，否则不要读取或修改用户项目代码。",
      "优先通过应用内受控能力完成工作，避免随意扩大修改范围。",
    ].join("\n"),
    skills: [],
    allowedTools: [...DEFAULT_RESTRICTED_ALLOWED_TOOLS],
    autoApply: true,
    runSurface: "maintenance",
    visibility: "internal",
  },
];

export function resolveAgentRuntimeContext(options: {
  cwd?: string;
  surface?: AgentRunSurface;
  agentId?: string;
  userClaudeRoot?: string;
}): ResolvedAgentRuntimeContext {
  const surface = options.surface ?? "development";
  const projectRoot = options.cwd?.trim() ? options.cwd.trim() : undefined;
  const requestedAgentId = normalizeAgentId(options.agentId);
  const userClaudeRoot = options.userClaudeRoot?.trim() || USER_CLAUDE_ROOT;

  if (surface === "maintenance") {
    const selectedProfile = pickProfileById(
      BUILT_IN_SYSTEM_PROFILES,
      requestedAgentId ?? DEFAULT_SYSTEM_MAINTENANCE_ID,
      "maintenance",
    ) ?? BUILT_IN_SYSTEM_PROFILES[0];

    return {
      surface,
      selectedAgentId: selectedProfile?.id,
      settingSources: [],
      systemPromptAppend: buildPromptAppend([], [selectedProfile]),
      promptSources: buildPromptLedgerSources([], selectedProfile ? [selectedProfile] : []),
      skills: selectedProfile?.skills ?? [],
      allowedTools: selectedProfile?.allowedTools,
      enforceAllowedTools: true,
      appliedProfiles: selectedProfile ? [selectedProfile] : [],
    };
  }

  const userLayer = discoverAgentLayer("user", userClaudeRoot, {
    entryDocs: [
      join(userClaudeRoot, "CLAUDE.md"),
      join(userClaudeRoot, "AGENTS.md"),
    ],
    settingsFiles: [
      join(userClaudeRoot, "settings.json"),
      join(userClaudeRoot, "settings.local.json"),
    ],
  });
  const projectLayer = projectRoot
    ? discoverAgentLayer("project", join(projectRoot, ".claude"), {
      entryDocs: [
        join(projectRoot, "AGENTS.md"),
        join(projectRoot, "CLAUDE.md"),
        join(projectRoot, ".claude", "AGENTS.md"),
        join(projectRoot, ".claude", "CLAUDE.md"),
      ],
      settingsFiles: [
        join(projectRoot, ".claude", "settings.json"),
        join(projectRoot, ".claude", "settings.local.json"),
      ],
    })
    : null;

  const selectedProfiles = requestedAgentId
    ? [
      pickProfileById(projectLayer?.profiles ?? [], requestedAgentId, "development"),
      pickProfileById(userLayer.profiles, requestedAgentId, "development"),
    ].filter((profile): profile is ResolvedAgentProfile => Boolean(profile))
    : [
      ...pickAutoProfiles(userLayer.profiles, "development"),
      ...pickAutoProfiles(projectLayer?.profiles ?? [], "development"),
    ];

  const appliedProfiles = dedupeProfiles(selectedProfiles);
  const skills = Array.from(
    new Set(appliedProfiles.flatMap((profile) => profile.skills).map((skill) => skill.trim()).filter(Boolean)),
  );
  const allowedTools = mergeAllowedTools(appliedProfiles);
  const entryDocs = [
    ...userLayer.entryDocs,
    ...(projectLayer?.entryDocs ?? []),
    ...userLayer.settingsDocs,
    ...(projectLayer?.settingsDocs ?? []),
  ];

  return {
    surface,
    selectedAgentId: requestedAgentId,
    // API routing is owned by tech-cc-hub settings. We scan user/project
    // CLAUDE/AGENTS/settings files into the prompt ledger below, but do not
    // let Claude Code load raw settings.json because those files can override
    // ANTHROPIC_* env and silently route a run to a different provider.
    settingSources: [],
    systemPromptAppend: buildPromptAppend(
      entryDocs,
      appliedProfiles,
    ),
    promptSources: buildPromptLedgerSources(entryDocs, appliedProfiles, skills),
    skills,
    allowedTools,
    enforceAllowedTools: false,
    appliedProfiles,
  };
}

function buildPromptLedgerSources(
  entryDocs: AgentContextDocument[],
  profiles: ResolvedAgentProfile[],
  skills: string[] = [],
): PromptLedgerSource[] {
  const sources: PromptLedgerSource[] = [{
    id: "system-preset",
    label: "Claude Code 系统预设",
    sourceKind: "system",
    chars: 0,
    sample: "SDK 内置系统提示，当前只能记录存在性，无法本地展开全文。",
  }, ...buildTechCCHubSystemPromptSources()];

  for (const doc of entryDocs) {
    sources.push({
      id: `${doc.scope}-entry-${doc.path}`,
      label: `${scopeLabel(doc.scope)}入口：${doc.label}`,
      sourceKind: doc.scope === "project" ? "project" : "system",
      text: doc.content,
      sourcePath: doc.path,
    });
  }

  for (const profile of profiles) {
    sources.push({
      id: `${profile.scope}-agent-${profile.id}`,
      label: `${scopeLabel(profile.scope)}Agent：${profile.name}`,
      sourceKind: profile.scope === "project" ? "project" : "system",
      text: [profile.description, profile.prompt].filter(Boolean).join("\n"),
      sourcePath: profile.sourcePath,
    });
  }

  if (skills.length > 0) {
    sources.push({
      id: "configured-skills",
      label: "已配置 skills",
      sourceKind: "skill",
      chars: skills.join("\n").length,
      sample: skills.join(", "),
    });
  }

  return sources;
}

function discoverAgentLayer(
  scope: AgentScope,
  claudeRoot: string,
  options: { entryDocs: string[]; settingsFiles: string[] },
): {
  entryDocs: AgentContextDocument[];
  settingsDocs: AgentContextDocument[];
  profiles: ResolvedAgentProfile[];
} {
  const entryDocs = options.entryDocs
    .filter((path) => existsSync(path))
    .map((path) => ({
      scope,
      path,
      label: basename(path),
      content: safeReadText(path),
    }))
    .filter((doc) => doc.content.trim().length > 0);
  const settingsDocs = options.settingsFiles
    .filter((path) => existsSync(path))
    .map((path) => ({
      scope,
      path,
      label: basename(path),
      content: buildClaudeSettingsSummary(path),
    }))
    .filter((doc) => doc.content.trim().length > 0);

  const profiles = discoverAgentProfiles(scope, claudeRoot);
  return { entryDocs, settingsDocs, profiles };
}

function discoverAgentProfiles(scope: AgentScope, claudeRoot: string): ResolvedAgentProfile[] {
  const agentsDir = join(claudeRoot, "agents");
  if (!existsSync(agentsDir)) {
    return [];
  }

  return readdirSync(agentsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .flatMap((entry) => {
      const fullPath = join(agentsDir, entry.name);
      const extension = extname(entry.name).toLowerCase();

      try {
        if (extension === ".json") {
          const parsed = JSON.parse(safeReadText(fullPath)) as AgentProfileManifest;
          const normalized = normalizeAgentProfileManifest(scope, fullPath, parsed, claudeRoot);
          return normalized ? [normalized] : [];
        }

        if (extension === ".md") {
          const content = safeReadText(fullPath).trim();
          if (!content) {
            return [];
          }

          return [{
            id: normalizeAgentId(basename(entry.name, extension)) ?? basename(entry.name, extension),
            scope,
            sourcePath: fullPath,
            name: basename(entry.name, extension),
            prompt: content,
            skills: [],
            autoApply: basename(entry.name, extension).toLowerCase() === "default",
            runSurface: "both",
            visibility: "user",
          } satisfies ResolvedAgentProfile];
        }
      } catch (error) {
        console.warn("[agent-resolver] Failed to load profile:", fullPath, error);
      }

      return [];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeAgentProfileManifest(
  scope: AgentScope,
  manifestPath: string,
  manifest: AgentProfileManifest,
  claudeRoot: string,
): ResolvedAgentProfile | null {
  if (manifest.enabled === false) {
    return null;
  }

  const id = normalizeAgentId(manifest.id ?? basename(manifestPath, extname(manifestPath)));
  if (!id) {
    return null;
  }

  const promptSections = [
    typeof manifest.prompt === "string" ? manifest.prompt.trim() : "",
    manifest.promptFile ? safeReadRelativeText(manifest.promptFile, manifestPath, claudeRoot) : "",
  ].filter(Boolean);

  if (promptSections.length === 0) {
    return null;
  }

  const runSurface = manifest.runSurface === "maintenance" || manifest.runSurface === "development"
    ? manifest.runSurface
    : "both";
  const visibility = manifest.visibility === "internal" ? "internal" : "user";

  return {
    id,
    scope,
    sourcePath: manifestPath,
    name: manifest.name?.trim() || id,
    description: manifest.description?.trim() || undefined,
    prompt: promptSections.join("\n\n").trim(),
    skills: Array.isArray(manifest.skills) ? manifest.skills.map((skill) => skill.trim()).filter(Boolean) : [],
    allowedTools: Array.isArray(manifest.allowedTools)
      ? manifest.allowedTools.map((tool) => tool.trim()).filter(Boolean)
      : undefined,
    autoApply: manifest.autoApply === true || id === "default",
    runSurface,
    visibility,
  };
}

function pickAutoProfiles(
  profiles: ResolvedAgentProfile[],
  surface: AgentRunSurface,
): ResolvedAgentProfile[] {
  return profiles.filter((profile) => profile.autoApply && matchesSurface(profile, surface));
}

function pickProfileById(
  profiles: ResolvedAgentProfile[],
  agentId: string,
  surface: AgentRunSurface,
): ResolvedAgentProfile | undefined {
  return profiles.find((profile) => profile.id === agentId && matchesSurface(profile, surface));
}

function matchesSurface(profile: ResolvedAgentProfile, surface: AgentRunSurface): boolean {
  return profile.runSurface === "both" || profile.runSurface === surface;
}

function dedupeProfiles(profiles: ResolvedAgentProfile[]): ResolvedAgentProfile[] {
  const seen = new Set<string>();
  const result: ResolvedAgentProfile[] = [];

  for (const profile of profiles) {
    const key = `${profile.scope}:${profile.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(profile);
  }

  return result;
}

function mergeAllowedTools(profiles: ResolvedAgentProfile[]): string[] | undefined {
  const merged = Array.from(
    new Set(
      profiles
        .flatMap((profile) => profile.allowedTools ?? [])
        .map((tool) => tool.trim())
        .filter(Boolean),
    ),
  );

  return merged.length > 0 ? merged : undefined;
}

function buildPromptAppend(
  entryDocs: AgentContextDocument[],
  profiles: ResolvedAgentProfile[],
): string | undefined {
  const sections: string[] = [];

  if (entryDocs.length > 0) {
    sections.push("以下是当前会话生效的入口规则文档：");
    for (const doc of entryDocs) {
      sections.push(
        [
          `[${scopeLabel(doc.scope)}入口] ${doc.label}`,
          doc.content.trim(),
        ].join("\n"),
      );
    }
  }

  if (profiles.length > 0) {
    sections.push("以下是当前会话自动加载的 agent 配置：");
    for (const profile of profiles) {
      sections.push(
        [
          `[${scopeLabel(profile.scope)} Agent] ${profile.name} (${profile.id})`,
          profile.description?.trim() || "",
          profile.prompt.trim(),
        ].filter(Boolean).join("\n"),
      );
    }
  }

  const joined = sections.filter(Boolean).join("\n\n");
  return joined.trim() || undefined;
}

function scopeLabel(scope: AgentScope): string {
  if (scope === "project") {
    return "项目级";
  }
  if (scope === "user") {
    return "用户级";
  }
  return "系统级";
}

function safeReadText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function buildClaudeSettingsSummary(path: string): string {
  const raw = safeReadText(path).trim();
  if (!raw) {
    return "";
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      "Claude settings file found, but tech-cc-hub could not parse it as JSON.",
      `Parse error: ${message}`,
      "Raw contents were not injected to avoid leaking secrets.",
    ].join("\n");
  }

  if (!isRecord(parsed)) {
    return "Claude settings file found, but it is not a JSON object.";
  }

  const lines = [
    "Claude settings summary (sanitized).",
    "tech-cc-hub keeps API/model routing in app settings; env/api credentials in this file are treated as informational and are not injected as raw values.",
    `Top-level keys: ${Object.keys(parsed).sort().join(", ") || "(none)"}`,
  ];

  appendSimpleSetting(lines, parsed, "model");
  appendSimpleSetting(lines, parsed, "outputStyle");
  appendSimpleSetting(lines, parsed, "teammateMode");
  appendSimpleSetting(lines, parsed, "todoFeatureEnabled");
  appendStringArraySetting(lines, parsed, "allowedTools");
  appendStringArraySetting(lines, parsed, "disallowedTools");
  appendEnvKeySummary(lines, parsed);
  appendEnabledPluginSummary(lines, parsed);
  appendMcpServerSummary(lines, parsed);
  appendPermissionSummary(lines, parsed);
  appendHookSummary(lines, parsed);

  return lines.join("\n");
}

function appendSimpleSetting(lines: string[], settings: Record<string, unknown>, key: string): void {
  const value = settings[key];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    lines.push(`${key}: ${String(value)}`);
  }
}

function appendStringArraySetting(lines: string[], settings: Record<string, unknown>, key: string): void {
  const value = settings[key];
  if (!Array.isArray(value)) {
    return;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length > 0) {
    lines.push(`${key}: ${items.join(", ")}`);
  }
}

function appendEnvKeySummary(lines: string[], settings: Record<string, unknown>): void {
  if (!isRecord(settings.env)) {
    return;
  }

  const keys = Object.keys(settings.env).sort();
  if (keys.length > 0) {
    lines.push(`env keys: ${keys.join(", ")} (values redacted)`);
  }
}

function appendEnabledPluginSummary(lines: string[], settings: Record<string, unknown>): void {
  if (!isRecord(settings.enabledPlugins)) {
    return;
  }

  const enabled: string[] = [];
  const disabled: string[] = [];
  for (const [pluginId, value] of Object.entries(settings.enabledPlugins).sort(([left], [right]) => left.localeCompare(right))) {
    if (value === false) {
      disabled.push(pluginId);
    } else if (value === true) {
      enabled.push(pluginId);
    }
  }

  if (enabled.length > 0) {
    lines.push(`enabledPlugins: ${enabled.join(", ")}`);
  }
  if (disabled.length > 0) {
    lines.push(`disabledPlugins: ${disabled.join(", ")}`);
  }
}

function appendMcpServerSummary(lines: string[], settings: Record<string, unknown>): void {
  if (!isRecord(settings.mcpServers)) {
    return;
  }

  const summaries = Object.entries(settings.mcpServers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => summarizeMcpServer(name, value));
  if (summaries.length > 0) {
    lines.push("mcpServers:");
    lines.push(...summaries.map((summary) => `- ${summary}`));
  }
}

function summarizeMcpServer(name: string, value: unknown): string {
  if (!isRecord(value)) {
    return `${name}: invalid non-object config`;
  }

  const parts = [name];
  const type = typeof value.type === "string" ? value.type : value.url ? "http" : "stdio";
  parts.push(`type=${type}`);
  if (typeof value.command === "string" && value.command.trim()) {
    parts.push(`command=${value.command.trim()}`);
  }
  if (typeof value.url === "string" && value.url.trim()) {
    parts.push(`url=${redactUrl(value.url.trim())}`);
  }
  if (Array.isArray(value.args)) {
    parts.push(`args=${value.args.length}`);
  }
  if (isRecord(value.env)) {
    parts.push(`envKeys=${Object.keys(value.env).sort().join("|") || "none"}`);
  }
  if (isRecord(value.headers)) {
    parts.push(`headerKeys=${Object.keys(value.headers).sort().join("|") || "none"}`);
  }
  if (value.enabled === false) {
    parts.push("enabled=false");
  }

  return parts.join(" ");
}

function appendPermissionSummary(lines: string[], settings: Record<string, unknown>): void {
  if (!isRecord(settings.permissions)) {
    return;
  }

  const permissions = settings.permissions;
  const details: string[] = [];
  appendPermissionList(details, permissions, "allow");
  appendPermissionList(details, permissions, "ask");
  appendPermissionList(details, permissions, "deny");
  if (typeof permissions.defaultMode === "string") {
    details.push(`defaultMode=${permissions.defaultMode}`);
  }

  if (details.length > 0) {
    lines.push(`permissions: ${details.join("; ")}`);
  }
}

function appendPermissionList(details: string[], permissions: Record<string, unknown>, key: string): void {
  const value = permissions[key];
  if (!Array.isArray(value)) {
    return;
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length > 0) {
    details.push(`${key}=${items.join(", ")}`);
  }
}

function appendHookSummary(lines: string[], settings: Record<string, unknown>): void {
  if (!isRecord(settings.hooks)) {
    return;
  }

  const summaries = Object.entries(settings.hooks)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([eventName, value]) => {
      const count = Array.isArray(value) ? value.length : 1;
      return `${eventName}:${count}`;
    });
  if (summaries.length > 0) {
    lines.push(`hooks: ${summaries.join(", ")} (commands and secrets omitted)`);
  }
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.replace(/:\/\/[^/@\s]+@/, "://");
  }
}

function safeReadRelativeText(targetPath: string, manifestPath: string, claudeRoot: string): string {
  const resolvedPath = isAbsolute(targetPath)
    ? targetPath
    : join(claudeRoot, targetPath);
  if (!existsSync(resolvedPath)) {
    const manifestRelativePath = join(dirname(manifestPath), targetPath);
    if (!existsSync(manifestRelativePath)) {
      return "";
    }
    return safeReadText(manifestRelativePath);
  }
  return safeReadText(resolvedPath);
}

function normalizeAgentId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return normalized || undefined;
}

export function getUserClaudeRoot(): string {
  return USER_CLAUDE_ROOT;
}

export function getSystemAgentProfiles(): ResolvedAgentProfile[] {
  return [...BUILT_IN_SYSTEM_PROFILES];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
