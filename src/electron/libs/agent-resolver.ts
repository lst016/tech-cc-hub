import {
  existsSync,
  readFileSync,
  readdirSync,
} from "fs";
import { homedir } from "os";
import { basename, dirname, extname, isAbsolute, join } from "path";
import type { PromptLedgerSource } from "../../shared/prompt-ledger.js";
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
    allowedTools: ["Read", "Edit", "MultiEdit", "Write", "Bash", "Glob", "Search", "TodoWrite"],
    autoApply: true,
    runSurface: "maintenance",
    visibility: "internal",
  },
];

export function resolveAgentRuntimeContext(options: {
  cwd?: string;
  surface?: AgentRunSurface;
  agentId?: string;
}): ResolvedAgentRuntimeContext {
  const surface = options.surface ?? "development";
  const projectRoot = options.cwd?.trim() ? options.cwd.trim() : undefined;
  const requestedAgentId = normalizeAgentId(options.agentId);

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

  const userLayer = discoverAgentLayer("user", USER_CLAUDE_ROOT, {
    entryDocs: [join(USER_CLAUDE_ROOT, "AGENTS.md")],
  });
  const projectLayer = projectRoot
    ? discoverAgentLayer("project", join(projectRoot, ".claude"), {
      entryDocs: [
        join(projectRoot, "AGENTS.md"),
        join(projectRoot, "CLAUDE.md"),
        join(projectRoot, ".claude", "AGENTS.md"),
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
  ];

  return {
    surface,
    selectedAgentId: requestedAgentId,
    // API routing is owned by tech-cc-hub settings. We already inject user/project
    // AGENTS/CLAUDE docs into systemPromptAppend below, so do not let Claude Code
    // load user/project settings.json here; those files can override ANTHROPIC_*
    // env and silently route a run to a different provider.
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
  entryDocs: Array<{ scope: AgentScope; path: string; label: string; content: string }>,
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
  options: { entryDocs: string[] },
): {
  entryDocs: Array<{ scope: AgentScope; path: string; label: string; content: string }>;
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

  const profiles = discoverAgentProfiles(scope, claudeRoot);
  return { entryDocs, profiles };
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
  entryDocs: Array<{ scope: AgentScope; path: string; label: string; content: string }>,
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
