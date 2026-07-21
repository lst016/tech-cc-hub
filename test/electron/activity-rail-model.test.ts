import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ACTIVITY_RAIL_MESSAGE_LIMIT,
  buildActivityRailModel,
  limitActivityRailSessionMessages,
} from "../../src/shared/activity-rail-model.js";
import { buildPromptLedgerMessage } from "../../src/shared/prompt-ledger.js";

test("buildActivityRailModel accepts freeform string tool input", () => {
  const model = buildActivityRailModel({
    id: "string-tool-input-session",
    title: "String tool input",
    status: "completed",
    messages: [
      {
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-apply-patch",
              name: "apply_patch",
              input: "*** Begin Patch\n*** Update File: src/ui/App.tsx\n@@\n-old\n+new\n*** End Patch",
            },
          ],
        },
      } as never,
      {
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-apply-patch",
              content: "Success. Updated the following files.",
              is_error: false,
            },
          ],
        },
      } as never,
    ],
  }, [], "");

  assert.ok(model.timeline.some((item) => item.id === "tool-apply-patch"));
  assert.ok(model.timeline.some((item) => item.detail.includes("*** Begin Patch")));
});

test("buildPromptLedgerMessage separates prompt sources for optimization", () => {
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    model: "GLM-5.1-FP8",
    cwd: "D:/workspace/ligu",
    prompt: "继续修复 OMG 报表",
    attachments: [{ name: "需求截图.png", kind: "image", chars: 4096 }],
    promptSources: [
      { id: "system-preset", label: "Claude Code preset", sourceKind: "system", chars: 0, sample: "SDK preset" },
      { id: "project-agents", label: "项目 AGENTS.md", sourceKind: "project", text: "项目规则：中文 UI" },
      { id: "skill-doc", label: "feishu skill", sourceKind: "skill", text: "飞书表格读取规则" },
    ],
    memorySources: [
      { id: "summary", label: "滚动摘要", sourceKind: "memory", text: "已读取总报表配置并定位 OMG 字段" },
    ],
    historyMessages: [
      {
        type: "assistant",
        uuid: "assistant-history-tool",
        message: {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "tool-history-edit",
              name: "Edit",
              input: { file_path: "src/ui/components/ActivityRail.tsx", old_string: "old".repeat(100), new_string: "new" },
            },
          ],
        },
      } as never,
      {
        type: "user",
        message: {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "tool-read", content: "long tool output".repeat(100), is_error: false },
          ],
        },
      } as never,
    ],
  });

  assert.equal(ledger.type, "prompt_ledger");
  assert.equal(ledger.phase, "continue");
  assert.equal(ledger.model, "GLM-5.1-FP8");
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "project-agents")?.sourceKind, "project");
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "skill-doc")?.sourceKind, "skill");
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "current-prompt")?.chars, "继续修复 OMG 报表".length);
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "current-attachments")?.chars, 4096);
  assert.equal(ledger.buckets.find((bucket) => bucket.id === "summary")?.sourceKind, "memory");
  assert.ok((ledger.buckets.find((bucket) => bucket.id === "history-tool-output")?.chars ?? 0) > 1000);
  assert.ok((ledger.buckets.find((bucket) => bucket.id === "history-tool-input")?.chars ?? 0) > 300);
  assert.ok(ledger.segments.some((segment) => segment.segmentKind === "history_tool_input" && segment.toolName === "Edit"));
  assert.ok(ledger.segments.some((segment) => segment.segmentKind === "history_tool_output"));
  assert.ok(ledger.totalChars > 4096);
});

test("buildActivityRailModel exposes prompt analysis from prompt ledger", () => {
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    model: "GLM-5.1-FP8",
    cwd: "D:/workspace/ligu",
    prompt: "继续处理报表",
    promptSources: [
      { id: "system-preset", label: "Claude Code preset", sourceKind: "system", chars: 0, sample: "SDK preset" },
      { id: "project-agents", label: "项目 CLAUDE.md", sourceKind: "project", text: "项目规则".repeat(20) },
      { id: "skill-doc", label: "表格 skill", sourceKind: "skill", text: "读取表格规则".repeat(20) },
    ],
    memorySources: [
      { id: "summary", label: "本地摘要", sourceKind: "memory", text: "历史摘要".repeat(20) },
    ],
    historyMessages: [
      {
        type: "user_prompt",
        prompt: "先分析报表字段",
      },
      {
        type: "assistant",
        uuid: "assistant-history-plan",
        message: {
          role: "assistant",
          content: [
            {
              type: "text",
              text: "已检查字段来源，下一步需要对比输出口径。",
            },
          ],
        },
      } as never,
    ],
  });

  const model = buildActivityRailModel(
    {
      id: "session-prompt-analysis",
      title: "Prompt Analysis",
      status: "running",
      messages: [
        {
          type: "user_prompt",
          prompt: "先分析报表字段",
        },
        {
          type: "assistant",
          uuid: "assistant-history-plan",
          message: {
            id: "assistant-history-plan",
            model: "GLM-5.1-FP8",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "已检查字段来源，下一步需要对比输出口径。",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        ledger,
        {
          type: "user_prompt",
          prompt: "继续处理报表",
        },
      ],
    },
    [],
    "",
  );

  assert.equal(model.promptAnalysis.title, "Prompt 分析");
  assert.ok(model.promptAnalysis.totalChars > 0);
  assert.ok(model.promptAnalysis.buckets.some((bucket) => bucket.sourceKind === "project"));
  assert.ok(model.promptAnalysis.buckets.some((bucket) => bucket.sourceKind === "skill"));
  assert.ok(model.promptAnalysis.buckets.some((bucket) => bucket.sourceKind === "memory"));
  assert.ok(model.promptAnalysis.segments.some((segment) => segment.segmentKind === "current_prompt"));
  assert.ok(model.promptAnalysis.segments.some((segment) =>
    segment.segmentKind === "current_prompt" &&
    segment.round === 2 &&
    segment.nodeId?.startsWith("prompt-2-"),
  ));
  assert.ok(model.promptAnalysis.segments.some((segment) =>
    segment.segmentKind === "history_assistant_output" &&
    segment.round === 1 &&
    segment.nodeId?.startsWith("assistant-history-plan-text-"),
  ));
  assert.equal(model.promptAnalysis.ledgers.length, 1);
  assert.ok(model.analysisCards.some((card) => card.id === "prompt-hotspot"));
});

test("limitActivityRailSessionMessages keeps only the latest bounded window", () => {
  const messages = Array.from({ length: DEFAULT_ACTIVITY_RAIL_MESSAGE_LIMIT + 5 }, (_, index) => ({
    type: "user_prompt" as const,
    prompt: `prompt-${index}`,
  }));
  const session = {
    id: "session-long",
    title: "Long session",
    status: "running" as const,
    messages,
  };

  const compact = limitActivityRailSessionMessages(session);

  assert.equal(compact.messages.length, DEFAULT_ACTIVITY_RAIL_MESSAGE_LIMIT);
  assert.equal(compact.messages[0]?.prompt, "prompt-5");
  assert.equal(compact.messages.at(-1)?.prompt, `prompt-${DEFAULT_ACTIVITY_RAIL_MESSAGE_LIMIT + 4}`);
  assert.notEqual(compact, session);
  assert.equal(limitActivityRailSessionMessages({ ...session, messages: messages.slice(0, 2) }).messages.length, 2);
});

test("buildActivityRailModel uses assistant usage before final result", () => {
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    model: "gpt-5.5",
    cwd: "D:/workspace/demo",
    prompt: "继续检查卡顿原因",
  });

  const model = buildActivityRailModel(
    {
      id: "session-streaming-usage",
      title: "Streaming Usage",
      status: "running",
      messages: [
        ledger,
        {
          type: "assistant",
          uuid: "assistant-usage",
          session_id: "remote-usage",
          parent_tool_use_id: null,
          message: {
            id: "assistant-usage",
            model: "gpt-5.5",
            role: "assistant",
            type: "message",
            content: [{ type: "text", text: "正在分析 trace。" }],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 127211,
              output_tokens: 42,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "assistant",
          uuid: "assistant-small-followup",
          session_id: "remote-usage",
          parent_tool_use_id: null,
          message: {
            id: "assistant-small-followup",
            model: "gpt-5.5",
            role: "assistant",
            type: "message",
            content: [{ type: "text", text: "完成。" }],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 123,
              output_tokens: 4,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.contextSnapshot.model, "gpt-5.5");
  assert.equal(model.summary.inputLabel, "127,211 tok");
  assert.equal(model.summary.outputLabel, "4 tok");
  assert.equal(model.contextDistribution.totalTokenEstimate, ledger.totalTokenEstimate);
  assert.equal(model.contextDistribution.actualInputTokens, 127211);
  assert.equal(model.contextDistribution.unattributedInputTokens, 127211 - ledger.totalTokenEstimate);
});

test("buildActivityRailModel does not use cumulative result usage as context window usage", () => {
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    model: "DeepSeek-V4-Pro",
    cwd: "D:/workspace/demo",
    prompt: "check cumulative usage",
  });

  const model = buildActivityRailModel(
    {
      id: "session-cumulative-result-usage",
      title: "Cumulative Result Usage",
      status: "completed",
      messages: [
        ledger,
        {
          type: "assistant",
          uuid: "assistant-context-usage",
          session_id: "remote-usage",
          parent_tool_use_id: null,
          message: {
            id: "assistant-context-usage",
            model: "deepseek-v4-pro",
            role: "assistant",
            type: "message",
            content: [{ type: "text", text: "checking" }],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 117_229,
              output_tokens: 42,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "result",
          capturedAt: 2000,
          uuid: "result-cumulative-usage",
          session_id: "remote-usage",
          subtype: "success",
          duration_ms: 1200,
          duration_api_ms: 1000,
          total_cost_usd: 0,
          usage: {
            input_tokens: 6_459_879,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 6_452_736,
            output_tokens: 12_207,
          },
          result: "done",
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.summary.inputLabel, "117,229 tok");
  assert.equal(model.contextDistribution.actualInputTokens, 117_229);
  assert.equal(model.contextDistribution.unattributedInputTokens, 117_229 - ledger.totalTokenEstimate);

  const resultItem = model.timeline.find((item) => item.id === "result-cumulative-usage-result");
  assert.equal(resultItem?.metrics.inputTokens, 6_459_879);
  assert.equal(resultItem?.metrics.outputTokens, 12_207);
});

test("buildActivityRailModel avoids result usage fallback when prompt ledger is available", () => {
  const ledger = buildPromptLedgerMessage({
    phase: "continue",
    model: "MiniMax-M3",
    cwd: "D:/workspace/demo",
    prompt: "check provider usage",
  });

  const model = buildActivityRailModel(
    {
      id: "session-ledger-with-result-only-usage",
      title: "Ledger With Result Usage",
      status: "completed",
      messages: [
        ledger,
        {
          type: "result",
          capturedAt: 2000,
          uuid: "result-ledger-with-result-only-usage",
          session_id: "remote-usage",
          subtype: "success",
          duration_ms: 1200,
          duration_api_ms: 1000,
          total_cost_usd: 0,
          usage: {
            input_tokens: 2_124_559,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 9_435_499,
            output_tokens: 1_207,
          },
          result: "done",
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.contextDistribution.totalTokenEstimate, ledger.totalTokenEstimate);
  assert.equal(model.contextDistribution.actualInputTokens, undefined);
  assert.equal(model.contextDistribution.unattributedInputTokens, 0);

  const resultItem = model.timeline.find((item) => item.id === "result-ledger-with-result-only-usage-result");
  assert.equal(resultItem?.metrics.inputTokens, 2_124_559);
  assert.equal(resultItem?.metrics.outputTokens, 1_207);
});

test("buildActivityRailModel shows the latest round as completed after a successful result even if the session stays running", () => {
  const model = buildActivityRailModel(
    {
      id: "session-latest-round-complete",
      title: "Latest round complete",
      status: "running",
      messages: [
        {
          type: "user_prompt",
          prompt: "收尾这一轮",
        },
        {
          type: "result",
          subtype: "success",
          uuid: "result-latest-round",
          session_id: "remote-latest-round",
          duration_ms: 800,
          result: "done",
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.summary.statusLabel, "已完成");
  assert.equal(model.summary.statusTone, "success");
});

test("buildActivityRailModel resets latest-round completion once a new user prompt starts", () => {
  const model = buildActivityRailModel(
    {
      id: "session-new-round-running",
      title: "New round running",
      status: "running",
      messages: [
        {
          type: "user_prompt",
          prompt: "第一轮",
        },
        {
          type: "result",
          subtype: "success",
          uuid: "result-round-1",
          session_id: "remote-round-reset",
          duration_ms: 800,
          result: "done",
        } as never,
        {
          type: "user_prompt",
          prompt: "第二轮刚开始",
        },
      ],
    },
    [],
    "",
  );

  assert.equal(model.summary.statusLabel, "执行中");
  assert.equal(model.summary.statusTone, "info");
});

test("buildActivityRailModel marks repeated init events as runner reuse", () => {
  const model = buildActivityRailModel(
    {
      id: "session-runtime-reuse",
      title: "Runtime reuse",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "第一轮",
        },
        {
          type: "system",
          subtype: "init",
          uuid: "init-1",
          session_id: "remote-reused",
          model: "deepseek-v4-flash",
          permissionMode: "bypassPermissions",
        } as never,
        {
          type: "result",
          subtype: "success",
          uuid: "result-1",
          session_id: "remote-reused",
          duration_ms: 1000,
          result: "done",
        } as never,
        {
          type: "user_prompt",
          prompt: "第二轮",
        },
        {
          type: "system",
          subtype: "init",
          uuid: "init-2",
          session_id: "remote-reused",
          model: "deepseek-v4-flash",
          permissionMode: "bypassPermissions",
        } as never,
      ],
    },
    [],
    "",
  );

  const lifecycleItems = model.timeline.filter((item) => item.nodeKind === "lifecycle");
  assert.equal(lifecycleItems.find((item) => item.round === 1)?.title, "初始化执行环境");
  assert.equal(lifecycleItems.find((item) => item.round === 2)?.title, "复用执行环境");
  assert.equal(model.timeline.find((item) => item.title === "复用执行环境")?.statusLabel, "已复用");
});

test("buildActivityRailModel exposes background session semantics", () => {
  const model = buildActivityRailModel(
    {
      id: "session-background",
      title: "Background run",
      status: "running",
      executionMode: "background",
      reasoningMode: "xhigh",
      permissionMode: "plan",
      messages: [],
    },
    [{
      toolUseId: "tool-1",
      toolName: "Bash",
      input: { command: "npm run build" },
    }],
    "",
  );

  assert.equal(model.sessionSemantics.executionMode, "background");
  assert.equal(model.sessionSemantics.status, "waiting_input");
  assert.equal(model.sessionSemantics.effort, "xhigh");
  assert.equal(model.sessionSemantics.permissionMode, "plan");
});

test("buildActivityRailModel exposes task-level steps and context distribution", () => {
  const model = buildActivityRailModel(
    {
      id: "session-1",
      title: "Trace Session",
      status: "completed",
      cwd: "D:/workspace/demo",
      slashCommands: ["/debug"],
      messages: [
        {
          type: "user_prompt",
          prompt: "修复右侧执行分析面板并说明图片内容",
          attachments: [
            {
              id: "img-1",
              kind: "image",
              name: "banana.png",
              mimeType: "image/png",
              data: "data:image/png;base64,AAAA",
              size: 4096,
            },
          ],
        },
        {
          type: "assistant",
          capturedAt: 1000,
          uuid: "assistant-plan",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "1. 检查当前右栏布局\n2. 修改组件结构\n3. 运行构建验证",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "assistant",
          capturedAt: 1100,
          uuid: "assistant-read",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-read",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-read", name: "Read", input: { file_path: "src/ui/components/ActivityRail.tsx" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "user",
          capturedAt: 1400,
          uuid: "user-read",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-read", content: "file content", is_error: false },
            ],
          },
        } as never,
        {
          type: "assistant",
          capturedAt: 1500,
          uuid: "assistant-edit",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-edit",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-edit", name: "Edit", input: { file_path: "src/ui/components/ActivityRail.tsx" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "user",
          capturedAt: 2300,
          uuid: "user-edit",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-edit", content: "updated", is_error: false },
            ],
          },
        } as never,
        {
          type: "assistant",
          capturedAt: 2400,
          uuid: "assistant-build",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            id: "assistant-build",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              { type: "tool_use", id: "tool-build", name: "Bash", input: { command: "npm run build" } },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "user",
          capturedAt: 4200,
          uuid: "user-build",
          session_id: "remote-1",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: "tool-build", content: "build ok", is_error: false },
            ],
          },
        } as never,
        {
          type: "result",
          capturedAt: 4300,
          uuid: "result-1",
          session_id: "remote-1",
          subtype: "success",
          duration_ms: 3900,
          duration_api_ms: 3200,
          total_cost_usd: 0.0123,
          usage: {
            input_tokens: 5392,
            output_tokens: 120,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: 0,
          },
          result: "已完成右栏调整，并识别图片中的文字为 BANANA。",
        } as never,
      ],
    },
    [],
    "BANANA",
  );

  assert.equal(model.primarySectionTitle, "实时执行轨迹");
  assert.equal(model.detailDrawerTitle, "节点详情");
  assert.equal(model.taskSectionTitle, "任务步骤");
  assert.equal(model.contextModalTitle, "上下文分布");

  assert.equal(model.planSteps.length, 3);
  assert.deepEqual(
    model.planSteps.map((step) => step.title),
    ["检查当前右栏布局", "修改组件结构", "运行构建验证"],
  );
  assert.equal(model.planSteps[0]?.status, "completed");

  assert.equal(model.taskSteps.length, 3);
  assert.deepEqual(
    model.taskSteps.map((step) => step.title),
    ["检查当前右栏布局", "修改组件结构", "运行构建验证"],
  );
  assert.equal(model.taskSteps[0]?.status, "completed");
  assert.equal(model.taskSteps[1]?.status, "completed");
  assert.equal(model.taskSteps[2]?.status, "completed");
  assert.ok(model.taskSteps[0]?.timelineIds.includes("tool-read"));
  assert.ok(model.taskSteps[1]?.timelineIds.includes("tool-edit"));
  assert.ok(model.taskSteps[2]?.timelineIds.includes("tool-build"));

  const distributionLabels = model.contextDistribution.buckets.map((bucket) => bucket.label);
  assert.ok(distributionLabels.includes("用户提示"));
  assert.ok(distributionLabels.includes("AI 计划"));
  assert.ok(distributionLabels.includes("工具输入"));
  assert.ok(distributionLabels.includes("工具输出"));
  assert.ok(distributionLabels.includes("最终结果"));
  assert.ok(distributionLabels.includes("附件"));
  assert.ok(model.contextDistribution.totalChars > 0);

  const promptText = model.contextSnapshot.latestPrompt ?? "";
  const planText = model.taskSteps.map((step, index) => `${index + 1}. ${step.title}`).join("\n");
  const expectedSummaryContext =
    promptText.length + 4096 + planText.length + "file content".length + "updated".length + "build ok".length;

  assert.equal(model.summary.inputLabel, "5,392 tok");
  assert.equal(model.summary.contextLabel, `${expectedSummaryContext.toLocaleString("zh-CN")} 字符`);
  assert.equal(model.summary.outputLabel, "120 tok");
  assert.equal(model.summary.successCount, 4);
  assert.equal(model.summary.failureCount, 0);

  const readItem = model.timeline.find((item) => item.id === "tool-read");
  assert.ok(readItem);
  assert.equal(readItem.nodeKind, "file_read");
  assert.equal(readItem.toolName, "Read");
  assert.equal(readItem.provenance, "local");
  assert.equal(readItem.metrics.inputChars, "src/ui/components/ActivityRail.tsx".length);
  assert.equal(readItem.metrics.contextChars, promptText.length + 4096 + planText.length);
  assert.equal(readItem.metrics.outputChars, "file content".length);
  assert.equal(readItem.metrics.durationMs, 300);
  assert.equal(readItem.metrics.successCount, 1);
  assert.equal(readItem.metrics.failureCount, 0);

  const promptBucket = model.contextDistribution.buckets.find((bucket) => bucket.id === "user-prompt");
  assert.ok(promptBucket);
  assert.deepEqual(promptBucket.sourceNodeIds, ["prompt-1-1"]);

  const toolInputBucket = model.contextDistribution.buckets.find((bucket) => bucket.id === "tool-input");
  assert.ok(toolInputBucket);
  assert.ok(toolInputBucket.sourceNodeIds.includes("tool-read"));
  assert.ok(toolInputBucket.sourceNodeIds.includes("tool-edit"));
  assert.ok(toolInputBucket.sourceNodeIds.includes("tool-build"));

  assert.equal(model.taskSteps[0]?.metrics.inputChars, "src/ui/components/ActivityRail.tsx".length);
  assert.equal(model.taskSteps[0]?.metrics.contextChars, promptText.length + 4096 + planText.length);
  assert.equal(model.taskSteps[0]?.metrics.outputChars, "file content".length);
  assert.equal(model.taskSteps[0]?.metrics.durationMs, 300);
  assert.equal(model.taskSteps[0]?.metrics.successCount, 1);
  assert.equal(model.taskSteps[1]?.metrics.contextChars, promptText.length + 4096 + planText.length + "file content".length);
  assert.equal(model.taskSteps[1]?.metrics.durationMs, 800);
  assert.equal(model.taskSteps[1]?.metrics.successCount, 1);
  assert.equal(
    model.taskSteps[2]?.metrics.contextChars,
    promptText.length + 4096 + planText.length + "file content".length + "updated".length,
  );
  assert.equal(model.taskSteps[2]?.metrics.durationMs, 1800);
  assert.equal(model.taskSteps[2]?.metrics.successCount, 1);
});

test("buildActivityRailModel structures tool detail sections for drawer rendering", () => {
  const model = buildActivityRailModel(
    {
      id: "session-tool-search",
      title: "Tool Detail",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "帮我找 WebSearch",
        },
        {
          type: "assistant",
          capturedAt: 100,
          uuid: "assistant-tool-search",
          session_id: "remote-tool",
          parent_tool_use_id: null,
          message: {
            id: "assistant-tool-search",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "tool_use",
                id: "tool-search",
                name: "ToolSearch",
                input: {
                  max_results: 1,
                  query: "select:WebSearch",
                },
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
        {
          type: "user",
          capturedAt: 180,
          uuid: "user-tool-search",
          session_id: "remote-tool",
          parent_tool_use_id: null,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool-search",
                content: "{\"type\":\"tool_reference\",\"tool_name\":\"WebSearch\",\"note\":\"use web search\"}",
                is_error: false,
              },
            ],
          },
        } as never,
      ],
    },
    [],
    "",
  );

  const toolItem = model.timeline.find((item) => item.id === "tool-search");
  assert.ok(toolItem);
  assert.equal(toolItem.detailSections.length, 2);
  assert.equal(toolItem.detailSections[0]?.title, "工具输入");
  assert.deepEqual(
    toolItem.detailSections[0]?.rows,
    [
      { label: "query", value: "select:WebSearch" },
      { label: "max_results", value: "1" },
    ],
  );
  assert.equal(toolItem.detailSections[1]?.title, "工具输出");
  assert.equal(toolItem.detailSections[1]?.summary, "命中工具引用 WebSearch");
  assert.match(toolItem.detailSections[1]?.raw ?? "", /"tool_name": "WebSearch"/);
});

test("buildActivityRailModel ignores option-style assistant lists as plan", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-noise",
      title: "Noise List",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "我想要点建议",
        },
        {
          type: "assistant",
          capturedAt: 100,
          uuid: "assistant-noise",
          session_id: "remote-noise",
          parent_tool_use_id: null,
          message: {
            id: "assistant-noise",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "常见选择：1. **Node.js + Express**（TypeScript） 2. **Python + FastAPI** 3. **Rust + Axum**",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.planSteps.length, 0);
});

test("buildActivityRailModel ignores answer-mode option lists as plan", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-answer",
      title: "Answer Options",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "你推荐哪个工具？",
        },
        {
          type: "assistant",
          capturedAt: 100,
          uuid: "assistant-answer-option",
          session_id: "remote-answer-option",
          parent_tool_use_id: null,
          message: {
            id: "assistant-answer-option",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
              {
                type: "text",
                text: "我不确定你指的是哪个工具：1. **Claude Code** 可更新到最新版本 2. **gstack** 可调用 /gstack-upgrade",
              },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.planSteps.length, 0);
});

test("buildActivityRailModel keeps explicit plan when hint and actions appear", () => {
  const model = buildActivityRailModel(
    {
      id: "session-plan-valid",
      title: "Explicit Plan",
      status: "completed",
      messages: [
        {
          type: "user_prompt",
          prompt: "请给我一个执行计划",
        },
        {
          type: "assistant",
          capturedAt: 100,
          uuid: "assistant-plan-valid",
          session_id: "remote-plan-valid",
          parent_tool_use_id: null,
          message: {
            id: "assistant-plan-valid",
            model: "Qwen3-Coder-480B-A35B-Instruct",
            role: "assistant",
            type: "message",
            content: [
            {
              type: "text",
              text: "我先按以下顺序执行：\n1. 检查当前仓库结构\n2. 修复异常\n3. 验证构建通过",
            },
            ],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: 0,
              output_tokens: 0,
              cache_creation_input_tokens: null,
              cache_read_input_tokens: null,
            },
          },
        } as never,
      ],
    },
    [],
    "",
  );

  assert.equal(model.planSteps.length, 3);
  assert.equal(model.planSteps[0]?.title, "检查当前仓库结构");
  assert.equal(model.planSteps[1]?.title, "修复异常");
});

test("buildActivityRailModel surfaces SDK retry and terminal reason without live background levels", () => {
  const model = buildActivityRailModel({
    id: "sdk-compat-session",
    title: "SDK compatibility",
    status: "error",
    messages: [
      {
        type: "tool_progress",
        uuid: "retry-progress",
        tool_use_id: "tool-retry",
        tool_name: "Task",
        elapsed_time_seconds: 3,
        parent_tool_use_id: null,
        subagent_type: "researcher",
        subagent_retry: {
          agent_id: "agent-1",
          attempt: 2,
          max_retries: 4,
          retry_delay_ms: 2000,
          error_status: 429,
          error_category: "rate_limit",
        },
      } as never,
      {
        type: "system",
        subtype: "background_tasks_changed",
        uuid: "background-level",
        tasks: [{ task_id: "agent-1", task_type: "sub_agent", description: "Inspect SDK changes" }],
      } as never,
      {
        type: "result",
        subtype: "success",
        uuid: "terminal-result",
        result: "",
        terminal_reason: "budget_exhausted",
      } as never,
    ],
  }, [], "");

  assert.ok(model.timeline.some((item) => item.title.includes("正在重试") && item.attention));
  assert.equal(model.timeline.some((item) => item.id === "background-tasks-background-level"), false);
  assert.ok(model.timeline.some((item) => item.title === "预算已用尽" && item.tone === "error"));
});

test("buildActivityRailModel treats task progress as cumulative and task notification as authoritative", () => {
  const model = buildActivityRailModel({
    id: "task-metrics-session",
    title: "Task metrics",
    status: "running",
    messages: [
      { type: "system", subtype: "task_started", uuid: "task-start", task_id: "task-metrics", description: "Measure task" } as never,
      { type: "system", subtype: "task_progress", uuid: "task-progress-1", task_id: "task-metrics", description: "Measure task", usage: { duration_ms: 1000, total_tokens: 100, tool_uses: 1 } } as never,
      { type: "system", subtype: "task_progress", uuid: "task-progress-2", task_id: "task-metrics", description: "Measure task", usage: { duration_ms: 2500, total_tokens: 240, tool_uses: 3 } } as never,
      { type: "system", subtype: "task_updated", uuid: "task-paused", task_id: "task-metrics", patch: { status: "paused" } } as never,
      { type: "system", subtype: "task_updated", uuid: "task-resumed", task_id: "task-metrics", patch: { status: "running" } } as never,
      { type: "system", subtype: "task_updated", uuid: "task-completed", task_id: "task-metrics", patch: { status: "completed" } } as never,
      { type: "system", subtype: "task_notification", uuid: "task-done", task_id: "task-metrics", status: "completed", summary: "Task done", output_file: "task.txt", usage: { duration_ms: 3000, total_tokens: 300, tool_uses: 4 } } as never,
    ],
  }, [], "");

  const task = model.timeline.find((item) => item.id === "task-started-task-metrics");
  assert.ok(task);
  assert.equal(task.statusLabel, "已完成");
  assert.equal(task.metrics.durationMs, 3000);
  assert.equal(task.metrics.outputTokens, 300);
  assert.equal(task.metrics.totalCount, 1);
  assert.equal(task.metrics.status, "success");
  assert.match(task.detail, /Task done/);
  assert.equal(model.timeline.filter((item) => item.parentTaskId === "task-metrics").length, 1);
});

test("buildActivityRailModel distinguishes agents, workflows, and background commands", () => {
  const model = buildActivityRailModel({
    id: "typed-task-session",
    title: "Typed tasks",
    status: "running",
    messages: [
      {
        type: "system",
        subtype: "task_started",
        uuid: "agent-start",
        task_id: "local-agent",
        task_type: "local_agent",
        subagent_type: "debugger",
        description: "Inspect loading behavior",
        prompt: "Compare both implementations and report exact evidence.",
      } as never,
      {
        type: "system",
        subtype: "task_started",
        uuid: "workflow-start",
        task_id: "local-workflow",
        task_type: "local_workflow",
        workflow_name: "verify-loading-fix",
        description: "Verify the loading fix",
        prompt: "Run the verification workflow.",
      } as never,
      {
        type: "system",
        subtype: "task_started",
        uuid: "bash-start",
        task_id: "local-bash",
        task_type: "local_bash",
        description: "Build PC Vue client",
      } as never,
    ],
  }, [], "");

  const agent = model.timeline.find((item) => item.parentTaskId === "local-agent");
  const workflow = model.timeline.find((item) => item.parentTaskId === "local-workflow");
  const background = model.timeline.find((item) => item.parentTaskId === "local-bash");

  assert.match(agent?.title ?? "", /启动智能体 · debugger/);
  assert.equal(agent?.detail, "Compare both implementations and report exact evidence.");
  assert.match(workflow?.title ?? "", /启动工作流 · verify-loading-fix/);
  assert.match(background?.title ?? "", /启动后台任务/);
});

test("buildActivityRailModel omits live background levels and deduplicates progress nodes", () => {
  const model = buildActivityRailModel({
    id: "level-and-progress-session",
    title: "Levels",
    status: "running",
    messages: [
      { type: "system", subtype: "task_started", uuid: "edge-start", task_id: "edge-task", description: "Edge task" } as never,
      { type: "system", subtype: "background_tasks_changed", uuid: "level-one", tasks: [{ task_id: "edge-task", task_type: "sub_agent", description: "Level only" }] } as never,
      { type: "system", subtype: "background_tasks_changed", uuid: "level-empty", tasks: [] } as never,
      { type: "tool_progress", uuid: "heartbeat-one", tool_use_id: "tool-heartbeat", tool_name: "Bash", elapsed_time_seconds: 1, parent_tool_use_id: null, heartbeat: true } as never,
      { type: "tool_progress", uuid: "heartbeat-two", tool_use_id: "tool-heartbeat", tool_name: "Bash", elapsed_time_seconds: 2, parent_tool_use_id: null, heartbeat: true } as never,
      { type: "system", subtype: "control_request_progress", uuid: "control-start", request_id: "request-1", status: "started" } as never,
      { type: "system", subtype: "control_request_progress", uuid: "control-retry", request_id: "request-1", status: "api_retry", attempt: 2, max_retries: 3, retry_delay_ms: 1000 } as never,
    ],
  }, [], "");

  const edgeTask = model.timeline.find((item) => item.id === "task-started-edge-task");
  assert.equal(edgeTask?.statusLabel, "运行中");
  assert.equal(model.timeline.some((item) => item.id === "background-tasks-level-one"), false);
  assert.equal(model.timeline.some((item) => item.id === "background-tasks-level-empty"), false);
  assert.equal(model.timeline.filter((item) => item.id === "tool-progress-tool-heartbeat").length, 1);
  const controlItems = model.timeline.filter((item) => item.id === "control-request-request-1");
  assert.equal(controlItems.length, 1);
  assert.equal(controlItems[0]?.statusLabel, "重试中");
});

test("buildActivityRailModel surfaces user-visible SDK system events and defensive command lifecycle", () => {
  const model = buildActivityRailModel({
    id: "visible-events-session",
    title: "Visible events",
    status: "running",
    messages: [
      { type: "system", subtype: "api_retry", uuid: "api-retry", attempt: 1, max_retries: 3, retry_delay_ms: 1000, error_status: 429, error: "rate_limit" } as never,
      { type: "system", subtype: "permission_denied", uuid: "denied", tool_name: "Bash", tool_use_id: "bash-1", message: "Denied by rule" } as never,
      { type: "system", subtype: "informational", uuid: "blocked", content: "Stop hook blocked continuation", level: "warning", prevent_continuation: true } as never,
      { type: "system", subtype: "command_lifecycle", uuid: "command", command_id: "cmd-1", command: "npm test", status: "completed" } as never,
      { type: "system", subtype: "session_state_changed", uuid: "action", state: "requires_action" } as never,
    ],
  }, [], "");

  assert.ok(model.timeline.some((item) => item.title === "模型请求正在重试"));
  assert.ok(model.timeline.some((item) => item.title.includes("权限已拒绝")));
  assert.ok(model.timeline.some((item) => item.title === "执行已被阻止" && item.attention));
  assert.ok(model.timeline.some((item) => item.title === "命令已完成"));
  assert.ok(model.timeline.some((item) => item.title === "会话需要你的操作" && item.attention));
});
