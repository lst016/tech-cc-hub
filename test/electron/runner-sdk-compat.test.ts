import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  applyRunnerHardToolPolicy,
  buildQualityHooks,
  createPromptSource,
  resolveRunnerToolPermissionPolicy,
  type RunnerHardToolPolicyContext,
} from "../../src/electron/libs/runner/runner.js";

function createPreToolUseHook(
  overrides: Partial<Parameters<typeof buildQualityHooks>[1]> = {},
) {
  const hooks = buildQualityHooks("D:/workspace/project", {
    config: {
      id: "test",
      name: "test",
      apiKey: "test",
      baseURL: "https://example.test",
      model: "claude-sonnet-4-5",
      enabled: true,
    },
    sessionId: "session-test",
    permissionMode: "bypassPermissions",
    applyHardToolPolicy: (_toolName, input) => ({ input, fixes: [] }),
    ...overrides,
  });
  const hook = hooks.PreToolUse?.[0]?.hooks[0];
  if (!hook) throw new Error("PreToolUse hook was not registered.");
  return hook;
}

function createPreToolUseInput(toolName: string, toolInput: Record<string, unknown>) {
  return {
    hook_event_name: "PreToolUse" as const,
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: `tool-${toolName}`,
    session_id: "session-test",
    transcript_path: "D:/workspace/transcript.jsonl",
    cwd: "D:/workspace/project",
  };
}

function createPolicyContext(
  overrides: Partial<RunnerHardToolPolicyContext> = {},
): RunnerHardToolPolicyContext {
  return {
    workspaceContext: null,
    displayPrompt: "run the requested task",
    agentPrompt: "run the requested task",
    projectCwd: "D:/workspace/project",
    activeBuiltinMcpServerNames: new Set(),
    codeGraphRetrievalSeen: true,
    permissionMode: "bypassPermissions",
    requiresFigmaImplementationAnchor: false,
    figmaImplementationAnchorSeen: false,
    requiresFigmaSvgAsset: false,
    figmaContextSeen: false,
    figmaSvgAssetSeen: false,
    figmaRestAuthFailureSeen: false,
    globalRuntimeConfig: {},
    effectiveAllowedTools: null,
    sdkPluginMcpServerNames: [],
    ...overrides,
  };
}

async function firstPrompt(
  origin?: Parameters<typeof createPromptSource>[2],
) {
  for await (const message of createPromptSource("hello", [], origin)) {
    return message;
  }
  throw new Error("Prompt source did not yield a message.");
}

test("prompt source stamps UI input as human and preserves explicit channel origins", async () => {
  assert.deepEqual((await firstPrompt()).origin, { kind: "human" });
  assert.deepEqual(
    (await firstPrompt({ kind: "channel", server: "slack" })).origin,
    { kind: "channel", server: "slack" },
  );
  assert.deepEqual(
    (await firstPrompt({ kind: "auto-continuation" })).origin,
    { kind: "auto-continuation" },
  );
});

test("hard tool policy denies host-owned restrictions even in bypass mode", () => {
  const powerShell = applyRunnerHardToolPolicy(
    "Bash",
    { command: "powershell.exe -Command Get-ChildItem" },
    createPolicyContext(),
  );
  assert.match(powerShell.denyMessage ?? "", /PowerShell is disabled/);

  const cron = applyRunnerHardToolPolicy("CronCreate", {}, createPolicyContext());
  assert.match(cron.denyMessage ?? "", /SDK CronCreate\/CronDelete\/CronList are disabled/);

  const surfaceRestriction = applyRunnerHardToolPolicy(
    "Write",
    { file_path: "README.md", content: "test" },
    createPolicyContext({ effectiveAllowedTools: new Set(["Read"]) }),
  );
  assert.equal(surfaceRestriction.denyMessage, "Current run surface does not allow tool: Write");

  const credentialRead = applyRunnerHardToolPolicy(
    "Read",
    { file_path: "C:/Users/test/.ssh/id_ed25519" },
    createPolicyContext(),
  );
  assert.match(credentialRead.denyMessage ?? "", /credential files is blocked/);

  const credentialShell = applyRunnerHardToolPolicy(
    "Bash",
    { command: "printenv ANTHROPIC_API_KEY" },
    createPolicyContext(),
  );
  assert.match(credentialShell.denyMessage ?? "", /Shell access to host credentials is blocked/);
});

test("plan mode allows code inspection but rejects mutating tools", () => {
  const context = createPolicyContext({ permissionMode: "plan" });
  assert.equal(
    applyRunnerHardToolPolicy("Read", { file_path: "src/index.ts" }, context).denyMessage,
    undefined,
  );
  assert.equal(
    applyRunnerHardToolPolicy("Grep", { pattern: "TODO", path: "src" }, context).denyMessage,
    undefined,
  );
  assert.equal(
    applyRunnerHardToolPolicy("ExitPlanMode", { plan: "ready" }, context).denyMessage,
    undefined,
  );
  assert.match(
    applyRunnerHardToolPolicy("Write", { file_path: "README.md", content: "change" }, context).denyMessage ?? "",
    /plan mode/,
  );
});

test("hard tool policy routes linked-workspace inputs idempotently", () => {
  const context = createPolicyContext({
    workspaceContext: {
      primaryCwd: "D:/workspace/frontend",
      linkedCwds: ["D:/workspace/api-service"],
    },
    displayPrompt: "update the api-service README",
  });
  const first = applyRunnerHardToolPolicy("Read", { file_path: "README.md" }, context);
  assert.equal(String(first.input.file_path).replace(/\\/g, "/"), "D:/workspace/api-service/README.md");
  assert.equal(first.fixes.length, 1);

  const second = applyRunnerHardToolPolicy("Read", first.input, context);
  assert.deepEqual(second.input, first.input);
  assert.deepEqual(second.fixes, []);
});

test("bypass PreToolUse waits for AskUserQuestion and maps the UI decision", async () => {
  const calls: Array<{ toolName: string; toolUseId?: string }> = [];
  const hook = createPreToolUseHook({
    requestPermissionDecision: async (toolName, _input, _signal, toolUseId) => {
      calls.push({ toolName, toolUseId });
      return { behavior: "allow", updatedInput: { approved: true } };
    },
  });
  const output = await hook(
    createPreToolUseInput("AskUserQuestion", { questions: [] }),
    "sdk-tool-use-id",
    { signal: new AbortController().signal },
  );

  assert.deepEqual(calls, [{ toolName: "AskUserQuestion", toolUseId: "sdk-tool-use-id" }]);
  if (!("hookSpecificOutput" in output) || output.hookSpecificOutput?.hookEventName !== "PreToolUse") {
    throw new Error("Expected PreToolUse output.");
  }
  assert.equal(output.hookSpecificOutput.permissionDecision, "allow");
  assert.deepEqual(output.hookSpecificOutput.updatedInput, { approved: true });
});

test("bypass unattended runs never park on AskUserQuestion", async () => {
  let permissionCalls = 0;
  const hook = createPreToolUseHook({
    toolPermissionPolicy: "unattended-auto-approve",
    requestPermissionDecision: async () => {
      permissionCalls += 1;
      return { behavior: "allow" };
    },
  });
  const output = await hook(
    createPreToolUseInput("AskUserQuestion", { questions: [] }),
    "scheduled-question",
    { signal: new AbortController().signal },
  );

  assert.equal(permissionCalls, 0);
  if (!("hookSpecificOutput" in output) || output.hookSpecificOutput?.hookEventName !== "PreToolUse") {
    throw new Error("Expected PreToolUse output.");
  }
  assert.equal(output.hookSpecificOutput.permissionDecision, "deny");
  assert.match(output.hookSpecificOutput.permissionDecisionReason ?? "", /Unattended scheduled tasks/);
});

test("non-bypass AskUserQuestion stays with canUseTool and Skill persistence follows hard allow", async () => {
  let permissionCalls = 0;
  const discoveredSkills: string[] = [];
  const defaultHook = createPreToolUseHook({
    permissionMode: "default",
    requestPermissionDecision: async () => {
      permissionCalls += 1;
      return { behavior: "allow" };
    },
  });
  await defaultHook(
    createPreToolUseInput("AskUserQuestion", { questions: [] }),
    "ask-default",
    { signal: new AbortController().signal },
  );
  assert.equal(permissionCalls, 0);

  const allowedSkillHook = createPreToolUseHook({
    onSkillDiscovered: (skill) => discoveredSkills.push(skill),
  });
  await allowedSkillHook(
    createPreToolUseInput("Skill", { skill: " browser " }),
    "skill-allow",
    { signal: new AbortController().signal },
  );
  assert.deepEqual(discoveredSkills, ["browser"]);

  const deniedSkillHook = createPreToolUseHook({
    applyHardToolPolicy: (_toolName, input) => ({ input, fixes: [], denyMessage: "blocked" }),
    onSkillDiscovered: (skill) => discoveredSkills.push(skill),
  });
  await deniedSkillHook(
    createPreToolUseInput("Skill", { skill: "must-not-persist" }),
    "skill-deny",
    { signal: new AbortController().signal },
  );
  assert.deepEqual(discoveredSkills, ["browser"]);
});

test("PreToolUse owns bypass enforcement and automatic retries use non-human origin", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  assert.match(source, /PreToolUse:[\s\S]*applyHardToolPolicy\?\.\(toolName, normalizedInput\)/);
  assert.match(source, /permissionDecision:\s*"deny"[\s\S]*hardPolicy\.denyMessage/);
  assert.match(source, /UNFINISHED_PLAN_CONTINUATION_PROMPT, \[\], \{ kind: "auto-continuation" \}/);
  assert.doesNotMatch(source, /EMPTY_SUCCESS_RETRY_PROMPT/);
  assert.match(source, /shouldAutoContinueUnfinishedPlan\(message,/);
  assert.match(source, /!backgroundActive[\s\S]*hasUnfinishedPlan/);
  assert.match(source, /backgroundActive,[\s\S]*terminalReason,/);
  assert.match(source, /const status = backgroundActive[\s\S]*\? "running"/);
  assert.match(source, /if \(backgroundActive\) \{[\s\S]*continue;\s*\}[\s\S]*promptInput\.close\(\);\s*q\.close\(\)/);
  assert.match(source, /new RunnerBackgroundTaskLifecycle\(\)/);
  assert.match(source, /backgroundLifecycle\.observeMessage\(message\)/);
  assert.match(source, /backgroundLifecycle\.requestBackground\(\)/);
  assert.match(source, /getUnexpectedRunnerEndMessage\(backgroundLifecycle\.isActive\(\)\)/);
  assert.doesNotMatch(source, /isAuthoritativeBackgroundIdle/);
  assert.match(source, /if \(!emittedTerminalStatus && !abortRequested\)/);
  assert.match(source, /message\.type === "conversation_reset"[\s\S]*session\.planSnapshot = undefined/);
  assert.match(source, /onSessionUpdate\?\.\(\{ claudeSessionId: sdkSessionId, planSnapshot: undefined \}\)/);
  assert.match(source, /canUseTool: permissionMode === "bypassPermissions" \? undefined : async/);
  assert.match(source, /const permissionMode = normalizeReleasePermissionMode\(runtime\?\.permissionMode\)/);
});

test("runner publishes the SDK supported command metadata after initialization", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /q\.supportedCommands\(\)/);
  assert.match(source, /subtype:\s*"commands_changed"/);
  assert.match(source, /commands,\s*uuid:\s*crypto\.randomUUID\(\),\s*session_id:/);
});

test("full-access runtime disables SDK sandbox by default", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  assert.match(source, /const sdkSandboxEnabled = permissionMode !== "bypassPermissions"/);
  assert.match(
    source,
    /sandbox: buildClaudeSandboxSettings\(\{\s*enabled: sdkSandboxEnabled,\s*failIfUnavailable: false,/,
  );
  assert.doesNotMatch(
    source,
    /failIfUnavailable: toolPermissionPolicy === "unattended-auto-approve" \|\| permissionMode === "bypassPermissions"/,
  );
});

test("permission request forwards the SDK bridge metadata", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  for (const field of [
    "requestId",
    "suggestions",
    "blockedPath",
    "decisionReason",
    "title",
    "displayName",
    "description",
    "matchedAskRule",
    "agentID",
  ]) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
  assert.match(source, /payload:\s*\{[\s\S]*sessionId: session\.id,[\s\S]*\.\.\.metadata,/);
  assert.match(source, /metadata\.agentID \? \{ agentId: metadata\.agentID \} : \{\}/);
  assert.match(source, /return requestPermissionDecision\(\s*toolName,\s*effectiveInput,\s*signal,\s*toolUseID,\s*permissionMetadata,/);
  assert.match(source, /session\.pendingPermissions\.set\(toolUseId,[\s\S]*metadata: \{[\s\S]*matchedAskRule: metadata\.matchedAskRule/);

  const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  assert.match(ipcSource, /activeSession\?\.pendingPermissions\.values\(\)[\s\S]*type: "permission\.request"[\s\S]*\.\.\.pending\.metadata/);
});

test("interactive permissions prompt while unattended tasks use a bounded auto-approval policy", () => {
  assert.equal(resolveRunnerToolPermissionPolicy("interactive", "Bash", { command: "pwd" }), null);
  assert.deepEqual(
    resolveRunnerToolPermissionPolicy("unattended-auto-approve", "Read", { file_path: "README.md" }),
    { behavior: "allow", updatedInput: { file_path: "README.md" } },
  );
  assert.deepEqual(
    resolveRunnerToolPermissionPolicy("unattended-auto-approve", "AskUserQuestion", { question: "Continue?" }),
    { behavior: "deny", message: "Unattended scheduled tasks cannot answer interactive questions." },
  );
  assert.deepEqual(
    resolveRunnerToolPermissionPolicy(
      "unattended-auto-approve",
      "Bash",
      { command: "npm test" },
      { matchedAskRule: { source: "projectSettings", toolName: "Bash", ruleContent: "*" } },
    ),
    {
      behavior: "deny",
      message: "A user-configured ask rule requires human approval; the unattended task was denied.",
    },
  );
  assert.deepEqual(
    resolveRunnerToolPermissionPolicy(
      "unattended-auto-approve",
      "Read",
      { file_path: "../secret.txt" },
      { blockedPath: "../secret.txt" },
    ),
    {
      behavior: "deny",
      message: "The SDK reported a blocked path that requires human approval; the unattended task was denied.",
    },
  );
  assert.deepEqual(
    resolveRunnerToolPermissionPolicy(
      "unattended-auto-approve",
      "Bash",
      { command: "rm -rf build" },
      { decisionReason: "safety check" },
    ),
    { behavior: "allow", updatedInput: { command: "rm -rf build" } },
  );
  assert.deepEqual(
    resolveRunnerToolPermissionPolicy(
      "unattended-auto-approve",
      "mcp__tech-cc-hub-admin__set_global_runtime_config",
      { permissionMode: "bypassPermissions" },
    ),
    {
      behavior: "deny",
      message: "Host and external MCP tools require interactive approval; the unattended task was denied.",
    },
  );

  const source = readFileSync("src/electron/libs/task/executor.ts", "utf8");
  assert.match(source, /runtime: \{ model, reasoningMode, permissionMode: RELEASE_DEFAULT_PERMISSION_MODE \}/);
  assert.match(source, /subkind: "scheduled-trigger"/);
  assert.match(source, /toolPermissionPolicy: options\.manual \? "interactive" : "unattended-auto-approve"/);
});

test("all scheduled gateways stamp SDK origin and isolate unattended permission policy", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(mainSource, /promptOrigin: \{ kind: "task-notification", subkind: "scheduled-trigger" \}/);
  assert.match(mainSource, /toolPermissionPolicy: "unattended-auto-approve"/);
  assert.match(mainSource, /permissionMode: RELEASE_DEFAULT_PERMISSION_MODE/);
  assert.match(ipcSource, /toolPermissionPolicy: context\.toolPermissionPolicy/);
  assert.match(ipcSource, /if \(handle\.isClosed\(\)\) return;/);
});

test("runner preflight and explicit abort close without resurrecting a dead handle", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /const closeFailedPreflight = \(\) => \{[\s\S]*runnerClosed = true;[\s\S]*promptInput\.close\(\);[\s\S]*runnerWatchdog\.dispose\(\);/);
  assert.match(source, /API configuration not found[\s\S]*closeFailedPreflight\(\);\s*return;/);
  assert.match(source, /Requested \$\{requestedDeployment\}[\s\S]*closeFailedPreflight\(\);\s*return;/);
  assert.match(source, /abortRequested \|\| abortController\.signal\.aborted \|\| \(error as Error\)\.name === "AbortError"/);
});
