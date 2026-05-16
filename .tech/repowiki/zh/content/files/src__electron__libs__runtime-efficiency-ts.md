# src/electron/libs/runtime-efficiency.ts

> 模块：`electron` · 语言：`typescript` · 行数：132

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `resolveRuntimeEfficiencyProfile@69`
- `buildProfile@112`
- `FIGMA_URL_PATTERN@57`
- `VISUAL_TASK_PATTERN@59`
- `AUTOMATION_TASK_PATTERN@60`
- `IDE_TASK_PATTERN@61`
- `runSurface@73`
- `prompt@85`
- `hasImageAttachment@87`
- `RuntimeEfficiencyProfileId@3`
- `RuntimeEfficiencyProfile@10`
- `ResolveRuntimeEfficiencyProfileInput@62`

## 依赖输入

- `../../shared/builtin-mcp-registry.js`
- `../types.js`

## 对外暴露

- `RuntimeEfficiencyProfileId`
- `RuntimeEfficiencyProfile`
- `resolveRuntimeEfficiencyProfile`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { BuiltinMcpServerName } from "../../shared/builtin-mcp-registry.js";
import type { AgentRunSurface, PromptAttachment, RuntimeOverrides } from "../types.js";

export type RuntimeEfficiencyProfileId =
  | "standard"
  | "visual"
  | "automation"
  | "ide"
  | "maintenance";

export type RuntimeEfficiencyProfile = {
  id: RuntimeEfficiencyProfileId;
  builtinMcpServers: readonly BuiltinMcpServerName[];
  includeBrowserPrompt: boolean;
  includeDesignPrompt: boolean;
  includeProjectMemoryPrompt: boolean;
  includeClaudeCompatPrompt: boolean;
  includePartialMessages: boolean;
  includeHookEvents: boolean;
  agentProgressSummaries: boolean;
  forwardSubagentText: boolean;
};

const BASE_SERVERS: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-admin",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
];

const VISUAL_SERVERS: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
];

const AUTOMATION_SERVERS: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-cron",
];

const IDE_SERVERS: readonly BuiltinMcpServerName[] = [
  ...BASE_SERVERS,
  "tech-cc-hub-idea",
];

const ALL_SERVERS: readonly BuiltinMcpServerName[] = [
  "tech-cc-hub-browser",
  "tech-cc-hub-admin",
  "tech-cc-hub-design",
  "tech-cc-hub-figma",
  "tech-cc-hub-cron",
  "tech-cc-hub-idea",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
];

const FIGMA_URL_PATTERN = /https?:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
const VISUAL_TASK_PATTERN = /<browser_annotations>|browserview|localhost|127\.0\.0\.1|screenshot|screen\s*shot|ui\b|css\b|figma|design|layout|pixel|视觉|截图|页面|网页|浏览器|样式|布局|设计|还原|对齐|按钮|组件/i;
const AUTOMATION_TASK_PATTERN = /cron|schedule|scheduled|reminder|monitor|watch|automation|定时|计划任务|提醒|监控|自动化|每(天|周|小时|分钟)/i;
const IDE_TASK_PATTERN = /intellij|idea|java|jdk|maven|gradle|spring|tomcat|pom\.xml|\.java\b|编译|启动后端|本地运行/i;

type ResolveRuntimeEfficiencyProfileInput = {
  prompt: string;
  attachments?: readonly PromptAttachment[];
  runtime?: RuntimeOverrides;
  runSurface?: AgentRunSurface;
};

export function resolveRuntimeEfficiencyProfile(
  input: ResolveRuntimeEfficiencyProfileInput,
): RuntimeEfficiencyProfile {
  const runSurface = input.runtime?.runSurface ?? input.runSurface;
  if (runSurface === "maintenance") {
    return buildProfile("maintenance", ALL_SERVERS, {
      includeBrowserPrompt: true,
      includeDesignPrompt: true,
      includeClaudeCompatPrompt: true,
      includePartialMessages: true,
      includeHookEvents: true,
      agentProgressSummaries: true,
      forwardSubagentText: true,
    });
  }

  const prompt = input.prompt.trim();
  const hasImageAttachment = (input.attachments ?? []).some((attachment) => attachment.kind === "image");
  if (hasImageAttachment || FIGMA_URL_PATTERN.test(prompt) || VISUAL_TASK_PATTERN.test(prompt)) {
    return buildProfile("visual", VISUAL_SERVERS, {
      includeBrowserPrompt: true,
      includeDesignPrompt: true,
      includeClaudeCompatPrompt: true,
      includePartialMessages: true,
      agentProgressSummaries: true,
    });
  }

  if (AUTOMATION_TASK_PATTERN.test(prompt)) {
    return buildProfile("automation", AUTOMATION_SERVERS, {
      includeClaudeCompatPrompt: true,
    });
  }

  if (IDE_TASK_PATTERN.test(prompt)) {
    return buildProfile("ide", IDE_SERVERS, {
      includeClaudeCompatPrompt: true,
    });
  }

  return buildProfile("standard", BASE_SERVERS, {});
}

function buildProfile(
  id: RuntimeEfficiencyProfileId,
  builtinMcpServers: readonly BuiltinMcpServerName[],
  overrides: Partial<Omit<RuntimeEfficiencyProfile, "id" | "builtinMcpServers">>,
): RuntimeEfficiencyProfile {
  return {
    id,
    builtinMcpServers,
    includeBrowserPrompt: false,
    includeDesignPrompt: false,
    includeProjectMemoryPrompt: true,
    includeClaudeCompatPrompt: false,
    includePartialMessages: false,
    includeHookEvents: false,
    agentProgressSummaries: false,
    forwardSubagentText: false,
    ...overrides,
  };
}

```
