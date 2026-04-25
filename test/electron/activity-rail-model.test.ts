import test from "node:test";
import assert from "node:assert/strict";

import { buildActivityRailModel } from "../../src/shared/activity-rail-model.js";
import {
  buildPromptLedgerMessage,
  derivePromptNodeScope,
  type PromptLedgerSegment,
} from "../../src/shared/prompt-ledger.js";

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

test("derivePromptNodeScope returns exact matches for node ids and tool names", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-tool-input",
      bucketId: "history-tool-input",
      label: "历史工具输入",
      sourceKind: "tool",
      segmentKind: "history_tool_input",
      chars: 120,
      tokenEstimate: 40,
      ratio: 1,
      sample: "Read ActivityRail",
      text: "Read ActivityRail",
      round: 2,
      nodeId: "tool-read",
      messageId: "assistant-read",
      toolName: "Read",
      risks: ["tool_payload"],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "tool-read",
    title: "Read",
    toolName: "Read",
    round: 2,
    nodeKind: "tool",
  });

  assert.equal(scope.mode, "exact");
  assert.deepEqual(scope.matchedIds, ["seg-tool-input"]);
  assert.equal(scope.tokenEstimate, 40);
  assert.match(scope.detail, /直接关联/);
});

test("derivePromptNodeScope falls back to same round when direct node match is missing", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-round-history",
      bucketId: "history-user-prompt",
      label: "历史用户输入",
      sourceKind: "history",
      segmentKind: "history_user_prompt",
      chars: 90,
      tokenEstimate: 30,
      ratio: 1,
      sample: "上一轮需求",
      text: "上一轮需求",
      round: 3,
      nodeId: "prompt-3-a",
      messageId: "prompt-3-a",
      risks: [],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "assistant-3-no-direct",
    title: "分析输出",
    round: 3,
    nodeKind: "result",
  });

  assert.equal(scope.mode, "round");
  assert.deepEqual(scope.matchedIds, ["seg-round-history"]);
  assert.match(scope.detail, /同轮/);
});

test("derivePromptNodeScope matches current prompt and attachments for user input node", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-current",
      bucketId: "current-prompt",
      label: "当前用户输入",
      sourceKind: "current",
      segmentKind: "current_prompt",
      chars: 60,
      tokenEstimate: 20,
      ratio: 0.5,
      sample: "继续优化",
      text: "继续优化",
      risks: [],
    },
    {
      id: "seg-attachment",
      bucketId: "current-attachments",
      label: "当前附件",
      sourceKind: "attachment",
      segmentKind: "attachment",
      chars: 300,
      tokenEstimate: 100,
      ratio: 0.5,
      sample: "screen.png(image)",
      risks: [],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "prompt-4-current",
    title: "发送用户输入",
    round: 4,
    nodeKind: "context",
  });

  assert.equal(scope.mode, "exact");
  assert.deepEqual(scope.matchedIds, ["seg-current", "seg-attachment"]);
  assert.equal(scope.tokenEstimate, 120);
});

test("derivePromptNodeScope reports empty when no node or round segment matches", () => {
  const segments: PromptLedgerSegment[] = [
    {
      id: "seg-other-round",
      bucketId: "history",
      label: "历史",
      sourceKind: "history",
      segmentKind: "history_user_prompt",
      chars: 60,
      tokenEstimate: 20,
      ratio: 1,
      sample: "其他轮次",
      text: "其他轮次",
      round: 1,
      risks: [],
    },
  ];

  const scope = derivePromptNodeScope(segments, {
    id: "tool-edit-round-8",
    title: "Edit",
    toolName: "Edit",
    round: 8,
    nodeKind: "tool",
  });

  assert.equal(scope.mode, "empty");
  assert.deepEqual(scope.matchedIds, []);
  assert.equal(scope.tokenEstimate, 0);
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
