import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");
const decisionPanelSource = readFileSync("src/ui/components/DecisionPanel.tsx", "utf8");
const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
const processGroupSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");
const workflowAgentCardSource = readFileSync("src/ui/components/workflow/WorkflowAgentCard.tsx", "utf8");

test("EventCard renders user-visible Claude Agent SDK lifecycle events", () => {
  for (const subtype of [
    "api_retry",
    "permission_denied",
    "informational",
    "local_command_output",
    "mirror_error",
    "notification",
    "session_state_changed",
    "worker_shutting_down",
    "command_lifecycle",
  ]) {
    assert.match(eventCardSource, new RegExp(`subtype === ["']${subtype}["']`));
  }
  assert.match(eventCardSource, /sdkMessage\.type === "rate_limit_event"/);
  assert.match(eventCardSource, /prevent_continuation/);
  assert.match(eventCardSource, /requires_action/);
  assert.match(eventCardSource, /systemMsg\.plugins\.map/);
  assert.match(eventCardSource, /plugin\.version/);
});

test("EventCard hides empty background task snapshots", () => {
  assert.match(eventCardSource, /if \(tasks\.length === 0\) return null;/);
});

test("EventCard exposes structured Agent, Bash, and Notebook output fields", () => {
  for (const field of [
    "resolvedModel",
    "modelsUsed",
    "totalTokens",
    "totalDurationMs",
    "totalToolUseCount",
    "toolStats",
    "timedOutAfterMs",
    "old_source",
    "new_source",
  ]) {
    assert.match(eventCardSource, new RegExp(field));
  }
  assert.match(eventCardSource, /structuredResult=\{sdkMessage\.tool_use_result\}/);
  assert.match(eventCardSource, /timestamp=\{sdkMessage\.timestamp\}/);
  assert.match(processGroupSource, /collectStructuredProcessResults/);
  assert.match(processGroupSource, /StructuredProcessResultCard/);
  assert.match(processGroupSource, /timedOutAfterMs/);
  assert.match(processGroupSource, /old_source/);
});

test("EventCard keeps peer display names tied to the stable peer id", () => {
  assert.match(eventCardSource, /`协作消息 · \$\{origin\.name\} · \$\{origin\.from\}`/);
});

test("EventCard renders deferred tool identity and input instead of hiding the result", () => {
  assert.match(eventCardSource, /terminalReason === "tool_deferred"/);
  assert.match(eventCardSource, /deferred\.name/);
  assert.match(eventCardSource, /deferred\.id/);
  assert.match(eventCardSource, /JSON\.stringify\(deferred\.input/);
});

test("permission approval separates one-time allow from suggested persistent updates", () => {
  for (const field of ["title", "displayName", "description", "decisionReason", "blockedPath", "matchedAskRule", "agentId"]) {
    assert.match(decisionPanelSource, new RegExp(`request\\.${field}`));
  }
  assert.match(decisionPanelSource, /updatedPermissions: persistentRuleSuggestions/);
  assert.match(decisionPanelSource, /update\.type === "addRules"/);
  assert.match(decisionPanelSource, /update\.destination !== "userSettings"/);
  assert.match(decisionPanelSource, /Persistent permission changes/);
  assert.match(decisionPanelSource, /update\.destination/);
  assert.match(decisionPanelSource, /update\.rules/);
  assert.match(decisionPanelSource, /update\.directories/);
  assert.match(decisionPanelSource, /update\.mode/);
  assert.match(decisionPanelSource, /sanitizePermissionText/);
  assert.match(decisionPanelSource, /requestTitle \|\|/);
  assert.match(decisionPanelSource, />\s*始终允许\s*</);
  assert.match(decisionPanelSource, />\s*允许一次\s*</);
  assert.match(decisionPanelSource, /request\.toolName === "AskUserQuestion"/);
});

test("composer renders pending permission decisions for every tool type", () => {
  assert.match(promptInputSource, /\{permissionRequest && onPermissionResult && \(/);
  assert.doesNotMatch(
    promptInputSource,
    /permissionRequest\?\.toolName === "AskUserQuestion" && onPermissionResult/,
  );
  assert.match(promptInputSource, /<DecisionPanel\s+request=\{permissionRequest\}/);
});

test("workflow agent cards expose nested hierarchy and accurate terminal states", () => {
  assert.match(workflowAgentCardSource, /data-workflow-agent-parent-id=\{agent\.parentAgentId\}/);
  assert.match(workflowAgentCardSource, /data-workflow-agent-depth=\{agent\.depth \?\? 1\}/);
  assert.match(workflowAgentCardSource, /if \(status === "completed"\) return "已完成"/);
  assert.match(workflowAgentCardSource, /if \(status === "stopped"\) return "已停止"/);
});
