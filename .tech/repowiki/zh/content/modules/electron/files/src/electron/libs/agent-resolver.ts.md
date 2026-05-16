# src/electron/libs/agent-resolver.ts

> 模块：`electron` · 语言：`typescript` · 行数：452

## 文件职责

解析Agent运行时上下文，发现和选择Agent配置文件/Profile

## 关键符号

- `resolveAgentRuntimeContext@0 - 核心函数，根据cwd、surface和agentId解析完整的运行时上下文，包括选中的profile、提示词来源、技能列表和允许的工具`
- `discoverAgentProfiles@0 - 扫描文件系统发现用户和项目级别的Agent profiles`
- `BUILT_IN_SYSTEM_PROFILES@0 - 内置的系统维护Agent配置`
- `mergeAllowedTools@0 - 合并多个profile的allowedTools配置`

## 依赖输入

- `fs`
- `os`
- `path`
- `../../shared/prompt-ledger.js`
- `./system-prompt-presets.js`

## 对外暴露

- `AgentRunSurface`
- `AgentScope`
- `ResolvedAgentProfile`
- `ResolvedAgentRuntimeContext`
- `resolveAgentRuntimeContext`
- `getUserClaudeRoot`
- `getSystemAgentProfiles`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
    allowedTools: ["Read", "Edit", "MultiEdit", "Write", "Bash", "Glob", "Search", "update_plan"],
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
  )
... (truncated)
```
