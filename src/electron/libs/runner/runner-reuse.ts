import type { BuiltinMcpServerName } from "../../../shared/builtin-mcp-registry.js";
import type { AgentRunSurface, PromptAttachment, RuntimeOverrides } from "../../types.js";
import { resolveRuntimeEfficiencyProfile } from "../runtime-efficiency.js";

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
  workflowMode: string;
  outputFormat: string;
  runSurface: AgentRunSurface;
  agentId: string;
  allowedTools: string;
  runtimeProfile: string;
  builtinMcpServers: BuiltinMcpServerName[];
  agentTeamsEnabled: boolean;
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
    existing.workflowMode === requested.workflowMode &&
    existing.outputFormat === requested.outputFormat &&
    existing.runSurface === requested.runSurface &&
    existing.agentId === requested.agentId &&
    existing.allowedTools === requested.allowedTools &&
    existing.agentTeamsEnabled === requested.agentTeamsEnabled
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
    workflowMode: input.runtime?.workflowMode ?? "auto",
    outputFormat: input.runtime?.outputFormat ?? "",
    runSurface,
    agentId: normalizeKeyPart(agentId),
    allowedTools: normalizeKeyPart(input.allowedTools),
    runtimeProfile: profile.id,
    builtinMcpServers: [...profile.builtinMcpServers],
    agentTeamsEnabled: profile.enableAgentTeams,
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
      workflowMode: typeof parsed.workflowMode === "string" ? parsed.workflowMode : "auto",
      outputFormat: typeof parsed.outputFormat === "string" ? parsed.outputFormat : "",
      runSurface: parsed.runSurface === "maintenance" ? "maintenance" : "development",
      agentId: typeof parsed.agentId === "string" ? parsed.agentId : "",
      allowedTools: typeof parsed.allowedTools === "string" ? parsed.allowedTools : "",
      runtimeProfile: typeof parsed.runtimeProfile === "string" ? parsed.runtimeProfile : "",
      builtinMcpServers: parsed.builtinMcpServers.filter(isBuiltinMcpServerName),
      agentTeamsEnabled: parsed.agentTeamsEnabled === true,
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
