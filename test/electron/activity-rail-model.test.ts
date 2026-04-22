import test from "node:test";
import assert from "node:assert/strict";

import { buildActivityRailModel } from "../../src/shared/activity-rail-model.js";

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
