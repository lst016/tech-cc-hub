import {
  existsSync,
  readFileSync,
  readdirSync,
} from "fs";
import { homedir } from "os";
import { basename, dirname, extname, isAbsolute, join, relative } from "path";
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
  kind: "entry" | "rule" | "settings";
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
  settingSources: Array<"user" | "project" | "local">;
  systemPromptAppend?: string;
  promptSources: PromptLedgerSource[];
  skills: string[];
  allowedTools?: string[];
  enforceAllowedTools: boolean;
  appliedProfiles: ResolvedAgentProfile[];
  availableProfiles: ResolvedAgentProfile[];
};

export type ListedClaudeAgent = {
  id: string;
  name: string;
  description?: string;
  scope: AgentScope;
  sourcePath?: string;
};

const USER_CLAUDE_ROOT = join(homedir(), ".claude");
const DEFAULT_SYSTEM_MAINTENANCE_ID = "system-maintenance";
const AGENT_CATALOG_DESCRIPTION_COUNT_LIMIT = 20;
const AGENT_CATALOG_LONG_DESCRIPTION_LIMIT = 96;
const AGENT_CATALOG_SHORT_DESCRIPTION_LIMIT = 36;

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
      availableProfiles: selectedProfile ? [selectedProfile] : [],
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
  const availableProfiles = dedupeProfiles([
    ...userLayer.profiles,
    ...(projectLayer?.profiles ?? []),
  ]);
  const skills = Array.from(
    new Set(appliedProfiles.flatMap((profile) => profile.skills).map((skill) => skill.trim()).filter(Boolean)),
  );
  const allowedTools = mergeAllowedTools(appliedProfiles);
  const entryDocs = [
    ...userLayer.entryDocs,
    ...userLayer.ruleDocs,
    ...(projectLayer?.entryDocs ?? []),
    ...(projectLayer?.ruleDocs ?? []),
    ...userLayer.settingsDocs,
    ...(projectLayer?.settingsDocs ?? []),
  ];

  return {
    surface,
    selectedAgentId: requestedAgentId,
    // Match Claude Code's filesystem configuration discovery for normal
    // development sessions so user/project/local .claude skills, agents,
    // rules, CLAUDE.md, and settings are available through native SDK init.
    settingSources: ["user", "project", "local"],
    systemPromptAppend: buildPromptAppend(
      entryDocs,
      appliedProfiles,
      availableProfiles,
    ),
    promptSources: buildPromptLedgerSources(entryDocs, appliedProfiles, skills, availableProfiles),
    skills,
    allowedTools,
    enforceAllowedTools: false,
    appliedProfiles,
    availableProfiles,
  };
}

export function listAvailableClaudeAgents(options: {
  cwd?: string;
  userClaudeRoot?: string;
}): ListedClaudeAgent[] {
  const userClaudeRoot = options.userClaudeRoot?.trim() || USER_CLAUDE_ROOT;
  const projectRoot = options.cwd?.trim() ? options.cwd.trim() : undefined;
  const userProfiles = discoverAgentProfiles("user", userClaudeRoot);
  const projectProfiles = projectRoot
    ? discoverAgentProfiles("project", join(projectRoot, ".claude"))
    : [];

  return dedupeProfiles([...userProfiles, ...projectProfiles]).map((profile) => ({
    id: profile.id,
    name: profile.name,
    description: profile.description,
    scope: profile.scope,
    sourcePath: profile.sourcePath,
  }));
}

function buildPromptLedgerSources(
  entryDocs: AgentContextDocument[],
  profiles: ResolvedAgentProfile[],
  skills: string[] = [],
  availableProfiles: ResolvedAgentProfile[] = [],
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
      id: `${doc.scope}-${doc.kind}-${doc.path}`,
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

  const agentCatalog = buildAgentCatalog(availableProfiles);
  if (agentCatalog) {
    sources.push({
      id: "local-claude-agent-catalog",
      label: "Local Claude agent catalog",
      sourceKind: "skill",
      text: agentCatalog,
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
  ruleDocs: AgentContextDocument[];
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
      kind: "entry" as const,
    }))
    .filter((doc) => doc.content.trim().length > 0);
  const ruleDocs = discoverRuleDocuments(scope, join(claudeRoot, "rules"));
  const settingsDocs = options.settingsFiles
    .filter((path) => existsSync(path))
    .map((path) => ({
      scope,
      path,
      label: basename(path),
      content: buildClaudeSettingsSummary(path),
      kind: "settings" as const,
    }))
    .filter((doc) => doc.content.trim().length > 0);

  const profiles = discoverAgentProfiles(scope, claudeRoot);
  return { entryDocs, ruleDocs, settingsDocs, profiles };
}

function discoverRuleDocuments(scope: AgentScope, rulesRoot: string): AgentContextDocument[] {
  if (!existsSync(rulesRoot)) {
    return [];
  }

  return walkMarkdownFiles(rulesRoot)
    .map((path) => ({
      scope,
      path,
      label: `rules/${relative(rulesRoot, path).replace(/\\/g, "/")}`,
      content: safeReadText(path),
      kind: "rule" as const,
    }))
    .filter((doc) => doc.content.trim().length > 0);
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
          const parsed = parseMarkdownWithFrontmatter(safeReadText(fullPath));
          if (!parsed.body.trim()) {
            return [];
          }
          const frontmatterId = typeof parsed.frontmatter.name === "string" ? parsed.frontmatter.name.trim() : "";
          const fileId = basename(entry.name, extension);

          return [{
            id: normalizeAgentId(frontmatterId || fileId) ?? fileId,
            scope,
            sourcePath: fullPath,
            name: frontmatterId || fileId,
            description: typeof parsed.frontmatter.description === "string"
              ? parsed.frontmatter.description.trim() || undefined
              : undefined,
            prompt: parsed.body.trim(),
            skills: [],
            allowedTools: readFrontmatterStringArray(parsed.frontmatter.tools),
            autoApply: readFrontmatterBoolean(parsed.frontmatter.autoApply)
              || fileId.toLowerCase() === "default"
              || frontmatterId.toLowerCase() === "default",
            runSurface: readRunSurface(parsed.frontmatter.runSurface),
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
  availableProfiles: ResolvedAgentProfile[] = [],
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

  const agentCatalog = buildAgentCatalog(availableProfiles);
  if (agentCatalog) {
    sections.push([
      "Local Claude agents available from global/project .claude/agents:",
      "Only selected/default agents are injected in full. This catalog is a compact routing index; use the listed id/name/scope when the user asks for one of these agents.",
      agentCatalog,
    ].join("\n"));
  }

  const joined = sections.filter(Boolean).join("\n\n");
  return joined.trim() || undefined;
}

function buildAgentCatalog(profiles: ResolvedAgentProfile[]): string | undefined {
  const visibleProfiles = profiles.filter((profile) => profile.visibility !== "internal");
  if (visibleProfiles.length === 0) {
    return undefined;
  }

  const isLargeCatalog = visibleProfiles.length > AGENT_CATALOG_DESCRIPTION_COUNT_LIMIT;
  const descriptionLimit = isLargeCatalog
    ? AGENT_CATALOG_SHORT_DESCRIPTION_LIMIT
    : AGENT_CATALOG_LONG_DESCRIPTION_LIMIT;
  const entries = visibleProfiles.map((profile) => {
    const nameSuffix = profile.name && profile.name !== profile.id ? ` name=${profile.name}` : "";
    const description = profile.description
      ? ` desc=${compactCatalogText(profile.description, descriptionLimit)}`
      : "";
    const autoApply = profile.autoApply ? " autoApply=true" : "";

    return `- ${profile.id} [${profile.scope}]${nameSuffix}${description}${autoApply}`;
  });

  return [
    `${visibleProfiles.length} available agents. Source paths and full prompts are intentionally omitted from this compact catalog to keep the model context small.${isLargeCatalog ? " Descriptions are aggressively shortened because the catalog is large." : ""}`,
    ...entries,
  ].join("\n");
}

function compactCatalogText(text: string, maxLength: number): string {
  const compacted = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^Use this agent when (?:you need to|you need|the user wants to|the user asks to)\s+/i, "")
    .replace(/^Use this agent when\s+/i, "")
    .replace(/^Use when (?:you need to|you need|the user wants to|the user asks to)?\s*/i, "")
    .trim();
  if (compacted.length <= maxLength) {
    return compacted;
  }

  return `${compacted.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
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

function walkMarkdownFiles(rootPath: string): string[] {
  const files: string[] = [];
  const pending = [rootPath];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !existsSync(current)) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        files.push(fullPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function parseMarkdownWithFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n)?/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  return {
    frontmatter: parseSimpleFrontmatter(match[1]),
    body: content.slice(match[0].length),
  };
}

function parseSimpleFrontmatter(frontmatter: string): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};
  for (const line of frontmatter.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    const value = match[2].trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      parsed[key] = value
        .slice(1, -1)
        .split(",")
        .map((item) => cleanupFrontmatterScalar(item))
        .filter(Boolean);
      continue;
    }

    parsed[key] = cleanupFrontmatterScalar(value);
  }

  return parsed;
}

function cleanupFrontmatterScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function readFrontmatterStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function readFrontmatterBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return false;
  }
  return /^(true|yes|1)$/i.test(value.trim());
}

function readRunSurface(value: unknown): AgentRunSurface | "both" {
  return value === "development" || value === "maintenance" ? value : "both";
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
