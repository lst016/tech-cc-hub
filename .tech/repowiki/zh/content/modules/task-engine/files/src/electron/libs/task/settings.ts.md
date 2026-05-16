# src/electron/libs/task/settings.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：98

## 文件职责

源码文件。依赖：../config-store.js、./workflow.js、./types.js

## 关键符号

- `createDefaultTaskSettings@6 - `
- `loadTaskSettings@26 - `
- `saveTaskSettings@32 - `
- `applyTaskSettingsToWorkflow@43 - `
- `normalizeTaskSettings@61 - `
- `intValue@81 - `
- `textValue@86 - `
- `isRecord@90 - `
- `isReasoningMode@94 - `
- `CONFIG_KEY@4 - `
- `workflow@8 - `
- `rootConfig@28 - `
- `raw@29 - `
- `rootConfig@34 - `
- `current@35 - `
- `next@36 - `

## 依赖输入

- `../config-store.js`
- `./workflow.js`
- `./types.js`

## 对外暴露

- `createDefaultTaskSettings`
- `loadTaskSettings`
- `saveTaskSettings`
- `applyTaskSettingsToWorkflow`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { loadGlobalRuntimeConfig, saveGlobalRuntimeConfig } from "../config-store.js";
import { createDefaultTaskWorkflowConfig, type TaskWorkflowConfig } from "./workflow.js";
import type { TaskWorkflowSettings } from "./types.js";

const CONFIG_KEY = "tasks";

export function createDefaultTaskSettings(userDataPath?: string): TaskWorkflowSettings {
  const workflow = createDefaultTaskWorkflowConfig(userDataPath);
  return {
    pollingIntervalMs: workflow.polling.intervalMs,
    maxConcurrentAgents: workflow.agent.maxConcurrentAgents,
    maxAutoRetries: workflow.agent.maxAutoRetries,
    maxRetryBackoffMs: workflow.agent.maxRetryBackoffMs,
    stallTimeoutMs: workflow.agent.stallTimeoutMs,
    defaultDriverId: "claude",
    defaultReasoningMode: "high",
    maxCostUsd: undefined,
    writeBackEnabled: true,
    promptTemplate: workflow.promptTemplate,
    tbCliCommand: "",
    tbFetchArgsTemplate: "",
    tbUpdateArgsTemplate: "",
    tbCommentArgsTemplate: "",
  };
}

export function loadTaskSettings(userDataPath?: string): TaskWorkflowSettings {
  const rootConfig = loadGlobalRuntimeConfig();
  const raw = isRecord(rootConfig[CONFIG_KEY]) ? rootConfig[CONFIG_KEY] : {};
  return normalizeTaskSettings(raw, createDefaultTaskSettings(userDataPath));
}

export function saveTaskSettings(settings: Partial<TaskWorkflowSettings>, userDataPath?: string): TaskWorkflowSettings {
  const rootConfig = loadGlobalRuntimeConfig();
  const current = loadTaskSettings(userDataPath);
  const next = normalizeTaskSettings({ ...current, ...settings }, current);
  saveGlobalRuntimeConfig({
    ...rootConfig,
    [CONFIG_KEY]: next,
  });
  return next;
}

export function applyTaskSettingsToWorkflow(workflow: TaskWorkflowConfig, settings: TaskWorkflowSettings): TaskWorkflowConfig {
  return {
    ...workflow,
    polling: {
      ...workflow.polling,
      intervalMs: settings.pollingIntervalMs,
    },
    agent: {
      ...workflow.agent,
      maxConcurrentAgents: settings.maxConcurrentAgents,
      maxAutoRetries: settings.maxAutoRetries,
      maxRetryBackoffMs: settings.maxRetryBackoffMs,
      stallTimeoutMs: settings.stallTimeoutMs,
    },
    promptTemplate: settings.promptTemplate?.trim() || workflow.promptTemplate,
  };
}

function normalizeTaskSettings(raw: unknown, defaults: TaskWorkflowSettings): TaskWorkflowSettings {
  const value = isRecord(raw) ? raw : {};
  return {
    pollingIntervalMs: intValue(value.pollingIntervalMs, defaults.pollingIntervalMs, 5000),
    maxConcurrentAgents: intValue(value.maxConcurrentAgents, defaults.maxConcurrentAgents, 1),
    maxAutoRetries: intValue(value.maxAutoRetries, defaults.maxAutoRetries, 0),
    maxRetryBackoffMs: intValue(value.maxRetryBackoffMs, defaults.maxRetryBackoffMs, 1000),
    stallTimeoutMs: intValue(value.stallTimeoutMs, defaults.stallTimeoutMs, 30000),
    defaultDriverId: "claude",
    defaultReasoningMode: isReasoningMode(value.defaultReasoningMode) ? value.defaultReasoningMode : defaults.defaultReasoningMode,
    maxCostUsd: undefined,
    writeBackEnabled: typeof value.writeBackEnabled === "boolean" ? value.writeBackEnabled : defaults.writeBackEnabled,
    promptTemplate: textValue(value.promptTemplate) ?? defaults.promptTemplate,
    tbCliCommand: textValue(value.tbCliCommand) ?? defaults.tbCliCommand,
    tbFetchArgsTemplate: textValue(value.tbFetchArgsTemplate) ?? defaults.tbFetchArgsTemplate,
    tbUpdateArgsTemplate: textValue(value.tbUpdateArgsTemplate) ?? defaults.tbUpdateArgsTemplate,
    tbCommentArgsTemplate: textValue(value.tbCommentArgsTemplate) ?? defaults.tbCommentArgsTemplate,
  };
}

function intValue(value: unknown, fallback: number, min: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= min ? Math.floor(parsed) : fallback;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReasoningMode(value: unknown): value is Task
... (truncated)
```
