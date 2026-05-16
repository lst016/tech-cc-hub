# src/electron/libs/runner-reuse.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：119

## 文件职责

Runner复用逻辑模块，通过生成和比对复用键来确定是否可复用现有runner实例以提升效率

## 关键符号

- `buildRunnerReuseKey@0 - 根据输入参数构建runner复用键，包含cwd、model、allowedTools、runSurface等关键字段`
- `canReuseRunner@0 - 判断现有runner是否可复用于新请求，比较所有关键参数`
- `buildRunnerReuseDescriptor@0 - 构建runner复用描述符，包含运行时效率配置文件和内置MCP服务器列表`
- `normalizeKeyPart@0 - 规范化键值部分，处理空值和空白字符`
- `parseRunnerReuseKey@0 - 解析复用键为描述符对象`
- `isBuiltinMcpServerName@0 - 判断是否为内置MCP服务器名称`

## 依赖输入

- `../../shared/builtin-mcp-registry.js`
- `../types.js`
- `./runtime-efficiency.js`

## 对外暴露

- `RunnerReuseKeyInput`
- `buildRunnerReuseKey`
- `canReuseRunner`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { BuiltinMcpServerName } from "../../shared/builtin-mcp-registry.js";
import type { AgentRunSurface, PromptAttachment, RuntimeOverrides } from "../types.js";
import { resolveRuntimeEfficiencyProfile } from "./runtime-efficiency.js";

export type RunnerReuseKeyInput = {
  cwd?: string;
  model?: string;
  allowedTools?: string;
  runSurface?: AgentRunSurface;
  agentId?: string;
  runtime?: RuntimeOverrides;
  prompt: string;
  attachments?: readonly PromptAttachment[];
};

type RunnerReuseDescriptor = {
  cwd: string;
  model: string;
  permissionMode: string;
  reasoningMode: string;
  outputFormat: string;
  runSurface: AgentRunSurface;
  agentId: string;
  allowedTools: string;
  runtimeProfile: string;
  builtinMcpServers: BuiltinMcpServerName[];
};

export function buildRunnerReuseKey(input: RunnerReuseKeyInput): string {
  return JSON.stringify(buildRunnerReuseDescriptor(input));
}

export function canReuseRunner(existingKey: string | undefined, requestedKey: string): boolean {
  const existing = parseRunnerReuseKey(existingKey);
  const requested = parseRunnerReuseKey(requestedKey);
  if (!existing || !requested) {
    return false;
  }

  return (
    existing.cwd === requested.cwd &&
    existing.model === requested.model &&
    existing.permissionMode === requested.permissionMode &&
    existing.reasoningMode === requested.reasoningMode &&
    existing.outputFormat === requested.outputFormat &&
    existing.runSurface === requested.runSurface &&
    existing.agentId === requested.agentId &&
    existing.allowedTools === requested.allowedTools
  );
}

function buildRunnerReuseDescriptor(input: RunnerReuseKeyInput): RunnerReuseDescriptor {
  const runSurface = input.runtime?.runSurface ?? input.runSurface ?? "development";
  const agentId = input.runtime?.agentId ?? input.agentId;
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: input.prompt,
    attachments: input.attachments,
    runtime: input.runtime,
    runSurface,
  });

  return {
    cwd: normalizeKeyPart(input.cwd),
    model: normalizeKeyPart(input.model),
    permissionMode: input.runtime?.permissionMode ?? "bypassPermissions",
    reasoningMode: input.runtime?.reasoningMode ?? "",
    outputFormat: input.runtime?.outputFormat ?? "",
    runSurface,
    agentId: normalizeKeyPart(agentId),
    allowedTools: normalizeKeyPart(input.allowedTools),
    runtimeProfile: profile.id,
    builtinMcpServers: [...profile.builtinMcpServers],
  };
}

function normalizeKeyPart(value: string | undefined): string {
  return value?.trim() ?? "";
}

function parseRunnerReuseKey(value: string | undefined): RunnerReuseDescriptor | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<RunnerReuseDescriptor>;
    if (!Array.isArray(parsed.builtinMcpServers)) {
      return null;
    }

    return {
      cwd: typeof parsed.cwd === "string" ? parsed.cwd : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
      permissionMode: typeof parsed.permissionMode === "string" ? parsed.permissionMode : "",
      reasoningMode: typeof parsed.reasoningMode === "string" ? parsed.reasoningMode : "",
      outputFormat: typeof parsed.outputFormat === "string" ? parsed.outputFormat : "",
      runSurface: parsed.runSurface === "maintenance" ? "maintenance" : "development",
      agentId: typeof parsed.agentId === "string" ? parsed.agentId : "",
      allowedTools: typeof parsed.allowedTools === "string" ? parsed.allowedTools : "",
      runtimeProfile: typeof parsed.runtimeProfile === "string" ? parsed.runtimeProfile : "",
      builtinMcpServers: parsed.builtinMcpServers.filter(isBuiltinMcpServerName),
    };
  } catch {
    return null;
  }
}

function isBuiltinMcpServerName(value: unknown): value is BuiltinMcpServerName {
  return (
    value === "tech-cc-hub-browser" ||
    value === "tech-cc-hub-admin" ||
    value === "tech-cc-hub-design" ||
    value === "tech-cc-hub-figma" ||
    value === "tech-cc-hub-cron" ||
    value === "tech-cc-hub-idea" ||
    value === "tech-cc-hub-plan"
  );
}

```
