import test from "node:test";
import assert from "node:assert/strict";

import { buildRunnerReuseKey, canReuseRunner } from "../../src/electron/libs/runner/runner-reuse.js";
import {
  mergeRuntimeEfficiencyProfile,
  normalizeRuntimeEfficiencyProfileState,
  resolveRuntimeEfficiencyProfile,
  runtimeEfficiencyProfileToState,
} from "../../src/electron/libs/runtime-efficiency.js";

const BASE_BUILTIN_MCP_SERVERS = [
  "tech-cc-hub-admin",
  "tech-cc-hub-plan",
  "tech-cc-hub-knowledge",
] as const;

const VISUAL_BUILTIN_MCP_SERVERS = [
  ...BASE_BUILTIN_MCP_SERVERS,
  "tech-cc-hub-browser",
  "tech-cc-hub-design",
] as const;

const FIGMA_BUILTIN_MCP_SERVERS = [
  ...VISUAL_BUILTIN_MCP_SERVERS,
  "tech-cc-hub-figma",
] as const;

const AUTOMATION_BUILTIN_MCP_SERVERS = [
  ...BASE_BUILTIN_MCP_SERVERS,
  "tech-cc-hub-cron",
] as const;

const IDE_BUILTIN_MCP_SERVERS = [
  ...BASE_BUILTIN_MCP_SERVERS,
  "tech-cc-hub-idea",
] as const;

test("runtime efficiency keeps plain prompts on a small built-in MCP surface", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "解释一下这个函数为什么会重复读文件",
  });

  assert.equal(profile.id, "standard");
  assert.deepEqual(profile.builtinMcpServers, BASE_BUILTIN_MCP_SERVERS);
  assert.equal(profile.includeBrowserPrompt, false);
  assert.equal(profile.includeDesignPrompt, false);
  assert.equal(profile.includeClaudeCompatPrompt, false);
  assert.equal(profile.includeProjectMemoryPrompt, false);
  assert.equal(profile.includePartialMessages, false);
  assert.equal(profile.includeHookEvents, false);
  assert.equal(profile.enableAgentTeams, false);
});

test("runtime efficiency enables visual tools for image attachments", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "照着截图修一下页面",
    attachments: [{
      id: "image-1",
      kind: "image",
      data: "tech-cc-hub://prompt-attachments/session/image.png",
      mimeType: "image/png",
      name: "reference.png",
    }],
  });

  assert.equal(profile.id, "visual");
  assert.deepEqual(profile.builtinMcpServers, VISUAL_BUILTIN_MCP_SERVERS);
  assert.equal(profile.includeBrowserPrompt, true);
  assert.equal(profile.includeDesignPrompt, true);
  assert.equal(profile.includeProjectMemoryPrompt, false);
  assert.equal(profile.enableAgentTeams, false);
});

test("runtime efficiency adds Figma tools only for Figma visual tasks", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "Use this Figma design: https://www.figma.com/design/abc123/File?node-id=1-2",
  });

  assert.equal(profile.id, "visual");
  assert.deepEqual(profile.builtinMcpServers, FIGMA_BUILTIN_MCP_SERVERS);
  assert.equal(profile.includeBrowserPrompt, true);
  assert.equal(profile.includeDesignPrompt, true);
});

test("runtime efficiency does not re-enable project memory from legacy sticky state", () => {
  const normalized = normalizeRuntimeEfficiencyProfileState({
    builtinMcpServers: ["tech-cc-hub-admin", "tech-cc-hub-plan", "tech-cc-hub-knowledge"],
  });

  assert.equal(normalized?.includeProjectMemoryPrompt, false);
});

test("runtime efficiency keeps design tools out of automation turns", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "每天下午提醒我检查构建状态",
  });

  assert.equal(profile.id, "automation");
  assert.deepEqual(profile.builtinMcpServers, AUTOMATION_BUILTIN_MCP_SERVERS);
  assert.equal(profile.includeBrowserPrompt, false);
  assert.equal(profile.includeDesignPrompt, false);
  assert.equal(profile.includeClaudeCompatPrompt, true);
  assert.equal(profile.enableAgentTeams, false);
});

test("runtime efficiency keeps visual tools out of IDE turns", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "debug this Java Spring Maven build in IntelliJ IDEA",
  });

  assert.equal(profile.id, "ide");
  assert.deepEqual(profile.builtinMcpServers, IDE_BUILTIN_MCP_SERVERS);
  assert.equal(profile.includeBrowserPrompt, false);
  assert.equal(profile.includeDesignPrompt, false);
  assert.equal(profile.includeClaudeCompatPrompt, true);
});

test("runtime efficiency enables Agent Teams visibility for parallel team prompts", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "用 Agent Teams 做跨层并行开发，API、数据层、测试分给不同 teammate",
  });

  assert.equal(profile.id, "team");
  assert.equal(profile.includeClaudeCompatPrompt, true);
  assert.equal(profile.includeHookEvents, true);
  assert.equal(profile.agentProgressSummaries, true);
  assert.equal(profile.forwardSubagentText, true);
  assert.equal(profile.enableAgentTeams, true);
  assert.deepEqual(profile.builtinMcpServers, BASE_BUILTIN_MCP_SERVERS);
  assert.equal(profile.includeBrowserPrompt, false);
});

test("runtime efficiency keeps visual tools when Agent Teams work includes UI", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "用 Agent Teams 分工修 UI 截图还原，leader 负责 review",
  });

  assert.equal(profile.id, "team");
  assert.equal(profile.includeBrowserPrompt, true);
  assert.equal(profile.includeDesignPrompt, true);
  assert.equal(profile.enableAgentTeams, true);
  assert.deepEqual(profile.builtinMcpServers, VISUAL_BUILTIN_MCP_SERVERS);
});

test("runtime efficiency keeps ordinary broad research off Agent Teams", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "帮我开源社区找下有没有 web端显示ps的开源项目 我想内置在我们的app里面通过我们自带的浏览器插件做标注切图 多找下",
  });

  assert.equal(profile.id, "visual");
  assert.equal(profile.includeBrowserPrompt, true);
  assert.equal(profile.includeDesignPrompt, true);
  assert.equal(profile.enableAgentTeams, false);
});

test("runtime efficiency enables Agent Teams for explicit ultracode workflow runs", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "ultracode: 帮我并行调研 PSD web viewer 方案",
  });

  assert.equal(profile.id, "team");
  assert.equal(profile.enableAgentTeams, true);
  assert.equal(profile.includeClaudeCompatPrompt, true);
  assert.equal(profile.includeHookEvents, true);
});

test("runtime efficiency enables Agent Teams for forced workflow mode", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "帮我并行调研 PSD web viewer 方案",
    runtime: { workflowMode: "force" },
  });

  assert.equal(profile.id, "team");
  assert.equal(profile.enableAgentTeams, true);
});

test("runtime efficiency sticky state keeps visual tools for later plain prompts", () => {
  const visual = resolveRuntimeEfficiencyProfile({
    prompt: "fix UI from screenshot",
    attachments: [{
      id: "image-1",
      kind: "image",
      data: "tech-cc-hub://prompt-attachments/session/image.png",
      mimeType: "image/png",
      name: "reference.png",
    }],
  });
  const plain = resolveRuntimeEfficiencyProfile({
    prompt: "continue fixing",
  });

  const merged = mergeRuntimeEfficiencyProfile(plain, runtimeEfficiencyProfileToState(visual));

  assert.equal(merged.id, "standard");
  assert.deepEqual(merged.builtinMcpServers, VISUAL_BUILTIN_MCP_SERVERS);
  assert.equal(merged.includeBrowserPrompt, true);
  assert.equal(merged.includeDesignPrompt, true);
  assert.equal(merged.includePartialMessages, true);
  assert.equal(merged.includeClaudeCompatPrompt, true);
});

test("runtime efficiency does not keep non-stateful tools from previous turns", () => {
  const automation = resolveRuntimeEfficiencyProfile({
    prompt: "schedule a reminder every day to check the build",
  });
  const plain = resolveRuntimeEfficiencyProfile({
    prompt: "continue the implementation",
  });

  const merged = mergeRuntimeEfficiencyProfile(plain, runtimeEfficiencyProfileToState(automation));

  assert.deepEqual(merged.builtinMcpServers, BASE_BUILTIN_MCP_SERVERS);
  assert.equal(merged.includeBrowserPrompt, false);
  assert.equal(merged.includeDesignPrompt, false);
  assert.equal(merged.includeClaudeCompatPrompt, false);
});

test("runtime efficiency drops stale all-server state from old plain turns", () => {
  const plain = resolveRuntimeEfficiencyProfile({
    prompt: "continue the implementation",
  });
  const merged = mergeRuntimeEfficiencyProfile(plain, {
    builtinMcpServers: [
      "tech-cc-hub-admin",
      "tech-cc-hub-plan",
      "tech-cc-hub-knowledge",
      "tech-cc-hub-browser",
      "tech-cc-hub-design",
      "tech-cc-hub-figma",
      "tech-cc-hub-cron",
      "tech-cc-hub-idea",
    ],
    includeBrowserPrompt: false,
    includeDesignPrompt: false,
    includeProjectMemoryPrompt: false,
    includeClaudeCompatPrompt: false,
    includePartialMessages: false,
    includeHookEvents: false,
    agentProgressSummaries: false,
    forwardSubagentText: false,
    enableAgentTeams: true,
  });

  assert.deepEqual(merged.builtinMcpServers, BASE_BUILTIN_MCP_SERVERS);
  assert.equal(merged.includeBrowserPrompt, false);
  assert.equal(merged.includeDesignPrompt, false);
  assert.equal(merged.includeClaudeCompatPrompt, false);
  assert.equal(merged.enableAgentTeams, false);
});

test("runtime efficiency enables image generation tool for image generation prompts", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "画一张极简科技风登录页背景",
  });

  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-image"));
  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-admin"));
});

test("runtime efficiency recognizes generic Chinese draw requests as image generation", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "画图 画一只小猪",
  });

  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-image"));
});

test("runtime efficiency recognizes Chinese draw requests without a quantity", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "hi 画只猪",
  });

  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-image"));
});

test("runtime efficiency recognizes natural Chinese image generation requests", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "来给我生成一只小猪的图",
  });

  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-image"));
});

test("runtime efficiency loads image generation tool for $imagegen trigger", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "$imagegen a logo for my app",
  });

  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-image"));
});

test("runtime efficiency does not load image generation tool for plain screenshot analysis", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "照着截图修一下页面",
    attachments: [{
      id: "image-1",
      kind: "image",
      data: "tech-cc-hub://prompt-attachments/session/image.png",
      mimeType: "image/png",
      name: "reference.png",
    }],
  });

  assert.equal(profile.builtinMcpServers.includes("tech-cc-hub-image"), false);
  assert.equal(profile.id, "visual");
});

test("runtime efficiency keeps image generation tool in maintenance profile", () => {
  const profile = resolveRuntimeEfficiencyProfile({
    prompt: "anything",
    runSurface: "maintenance",
  });

  assert.ok(profile.builtinMcpServers.includes("tech-cc-hub-image"));
});

test("runner reuse key stays stable across normal coding prompts", () => {
  const first = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "解释这个函数",
  });
  const second = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "继续修复这个问题",
  });

  assert.equal(first, second);
});

test("runner reuse key changes when the same model switches API profile", () => {
  const gateway = buildRunnerReuseKey({
    model: "gpt-5.6-terra",
    runtime: { model: "gpt-5.6-terra", configProfileId: "boke-gateway" },
    prompt: "hello",
  });
  const codex = buildRunnerReuseKey({
    model: "gpt-5.6-terra",
    runtime: { model: "gpt-5.6-terra", configProfileId: "codex-oauth" },
    prompt: "hello",
  });

  assert.equal(canReuseRunner(gateway, codex), false);
  assert.equal(canReuseRunner(codex, gateway), false);
});

test("runner reuse allows compatible turns to expand the tool surface in-place", () => {
  const coding = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "解释这个函数",
  });
  const visual = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "照着截图修页面",
    attachments: [{
      id: "image-1",
      kind: "image",
      data: "tech-cc-hub://prompt-attachments/session/image.png",
      mimeType: "image/png",
      name: "reference.png",
    }],
  });

  assert.notEqual(coding, visual);
  assert.equal(canReuseRunner(coding, visual), true);
  assert.equal(canReuseRunner(visual, coding), true);
});

test("runner reuse changes when SDK workflow mode changes", () => {
  const autoWorkflow = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "继续修复这个问题",
    runtime: { workflowMode: "auto" },
  });
  const disabledWorkflow = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "继续修复这个问题",
    runtime: { workflowMode: "off" },
  });

  assert.notEqual(autoWorkflow, disabledWorkflow);
  assert.equal(canReuseRunner(autoWorkflow, disabledWorkflow), false);
  assert.equal(canReuseRunner(disabledWorkflow, autoWorkflow), false);
});

test("runner reuse never crosses interactive and unattended permission policies", () => {
  const interactive = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "continue",
    toolPermissionPolicy: "interactive",
  });
  const unattended = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "scheduled continuation",
    toolPermissionPolicy: "unattended-auto-approve",
  });

  assert.equal(canReuseRunner(interactive, unattended), false);
  assert.equal(canReuseRunner(unattended, interactive), false);
});

test("runner reuse changes when Agent Teams env eligibility changes", () => {
  const standard = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "继续修复这个问题",
  });
  const ultracode = buildRunnerReuseKey({
    cwd: "D:\\tool\\tech-cc-hub",
    model: "gpt-5.5",
    prompt: "ultracode: 继续修复这个问题",
  });

  assert.notEqual(standard, ultracode);
  assert.equal(canReuseRunner(standard, ultracode), false);
  assert.equal(canReuseRunner(ultracode, standard), false);
});
