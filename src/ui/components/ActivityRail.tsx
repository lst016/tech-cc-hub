import { useMemo, useState, type CSSProperties } from "react";
import type {
  SDKAssistantMessage,
  SDKResultMessage,
  SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment } from "../types";
import type { PermissionRequest, SessionView } from "../store/useAppStore";

type Tone = "neutral" | "info" | "success" | "error" | "warning";
type ObservationLayer = "工具层" | "上下文层" | "执行结果层" | "执行流程层";

type ExecutionStep = {
  id: string;
  round: number;
  layer: ObservationLayer;
  title: string;
  detail?: string;
  tone: Tone;
  statusText?: string;
};

type LayerMetric = {
  label: ObservationLayer;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  footnote: string;
  tone?: Tone;
};

type CostMetric = {
  label: string;
  level: "低" | "中" | "高";
  detail: string;
  tone: Tone;
};

type ObservationModel = {
  promptCount: number;
  slashCount: number;
  attachmentCount: number;
  toolCount: number;
  toolSuccessCount: number;
  toolErrorCount: number;
  fileOpCount: number;
  searchOpCount: number;
  execOpCount: number;
  successCount: number;
  errorCount: number;
  permissionCount: number;
  waitingCount: number;
  roundCount: number;
  stepCount: number;
  latestPrompt: string | null;
  latestAttachments: PromptAttachment[];
  latestResult: string;
  latestDurationMs?: number;
  latestApiDurationMs?: number;
  latestInputTokens?: number;
  latestOutputTokens?: number;
  latestCacheReadTokens?: number;
  latestCostUsd?: number;
  latestTtftMs?: number;
  latestModel?: string;
  latestRemoteSessionId?: string;
  latestPermissionMode?: string;
  duplicateToolCount: number;
  validationCount: number;
  layerMetrics: LayerMetric[];
  costMetrics: CostMetric[];
  steps: ExecutionStep[];
};

type ToolOutcome = {
  isError: boolean;
  detail: string;
};

function toneClasses(tone: Tone) {
  switch (tone) {
    case "info":
      return "border-info/20 bg-info-light/40 text-info";
    case "success":
      return "border-success/20 bg-success-light/40 text-success";
    case "error":
      return "border-error/20 bg-error-light text-error";
    case "warning":
      return "border-accent/20 bg-accent-subtle text-accent";
    default:
      return "border-ink-900/10 bg-surface text-ink-700";
  }
}

function metricTone(tone: Tone) {
  return `border ${toneClasses(tone)}`;
}

function truncate(value: string, max = 120) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function formatNumber(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDuration(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function formatUsd(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `$${value.toFixed(4)}`;
}

function stringifyUnknown(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function describeToolInput(name: string, input: Record<string, unknown>) {
  switch (name) {
    case "Bash":
      return String(input.command ?? "");
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
      return String(input.file_path ?? "");
    case "Glob":
    case "Grep":
      return String(input.pattern ?? "");
    case "Task":
      return String(input.description ?? "");
    case "WebFetch":
      return String(input.url ?? "");
    default:
      return Object.keys(input).length > 0 ? stringifyUnknown(input) : "";
  }
}

function isSlashPrompt(prompt: string) {
  return prompt.trim().startsWith("/");
}

function classifyToolUse(name: string, detail: string) {
  const normalizedName = name.toLowerCase();
  const normalizedDetail = detail.toLowerCase();

  const fileTools = new Set(["read", "write", "edit", "multiedit"]);
  const searchTools = new Set(["glob", "grep"]);

  if (fileTools.has(normalizedName)) return "file";
  if (searchTools.has(normalizedName)) return "search";
  if (normalizedName === "bash") {
    if (
      /test|pytest|vitest|jest|lint|build|check|verify|tsc|npm run|pnpm|bun run/.test(
        normalizedDetail
      )
    ) {
      return "validation";
    }
    return "exec";
  }
  return "other";
}

function getToolResultDetail(content: NonNullable<SDKUserMessage["message"]["content"]>[number]) {
  if (typeof content === "string") return content;
  if ("content" in content) {
    if (Array.isArray(content.content)) {
      return content.content
        .map((item) => {
          if (typeof item === "string") return item;
          if ("text" in item && typeof item.text === "string") return item.text;
          if ("source" in item && item.source && typeof item.source === "object") {
            return stringifyUnknown(item.source);
          }
          return stringifyUnknown(item);
        })
        .join(" ");
    }
    return stringifyUnknown(content.content);
  }
  return stringifyUnknown(content);
}

function buildObservationModel(
  session: SessionView | undefined,
  permissionRequests: PermissionRequest[]
): ObservationModel {
  if (!session) {
    return {
      promptCount: 0,
      slashCount: 0,
      attachmentCount: 0,
      toolCount: 0,
      toolSuccessCount: 0,
      toolErrorCount: 0,
      fileOpCount: 0,
      searchOpCount: 0,
      execOpCount: 0,
      successCount: 0,
      errorCount: 0,
      permissionCount: 0,
      waitingCount: 0,
      roundCount: 0,
      stepCount: 0,
      latestPrompt: null,
      latestAttachments: [],
      latestResult: "尚未开始",
      duplicateToolCount: 0,
      validationCount: 0,
      layerMetrics: [],
      costMetrics: [],
      steps: [],
    };
  }

  let promptCount = 0;
  let slashCount = 0;
  let attachmentCount = 0;
  let toolCount = 0;
  let toolSuccessCount = 0;
  let toolErrorCount = 0;
  let fileOpCount = 0;
  let searchOpCount = 0;
  let execOpCount = 0;
  let successCount = 0;
  let errorCount = 0;
  let duplicateToolCount = 0;
  let validationCount = 0;
  let latestPrompt: string | null = null;
  let latestAttachments: PromptAttachment[] = [];
  let latestResult = "尚未开始";
  let latestDurationMs: number | undefined;
  let latestApiDurationMs: number | undefined;
  let latestInputTokens: number | undefined;
  let latestOutputTokens: number | undefined;
  let latestCacheReadTokens: number | undefined;
  let latestCostUsd: number | undefined;
  let latestTtftMs: number | undefined;
  let latestModel: string | undefined;
  let latestRemoteSessionId: string | undefined;
  let latestPermissionMode: string | undefined;
  let round = 0;
  let firstWriteRoundStep = Number.POSITIVE_INFINITY;
  let currentRoundStepCount = 0;
  let maxRoundStepCount = 0;
  let previousToolKey: string | null = null;
  const steps: ExecutionStep[] = [];
  const toolOutcomeMap = new Map<string, ToolOutcome>();

  for (const message of session.messages) {
    if (message.type === "user") {
      const user = message as SDKUserMessage;
      const contents = Array.isArray(user.message.content)
        ? user.message.content
        : [user.message.content];
      for (const content of contents) {
        if (typeof content !== "string" && content.type === "tool_result") {
          toolOutcomeMap.set(content.tool_use_id, {
            isError: Boolean(content.is_error),
            detail: truncate(getToolResultDetail(content), 160),
          });
        }
      }
      continue;
    }

    if (message.type === "assistant") {
      const assistant = message as SDKAssistantMessage;
      latestModel = assistant.message.model || latestModel;
      continue;
    }

    if (message.type === "result") {
      const result = message as SDKResultMessage;
      latestDurationMs = result.duration_ms ?? latestDurationMs;
      latestApiDurationMs = result.duration_api_ms ?? latestApiDurationMs;
      latestCostUsd = result.total_cost_usd ?? latestCostUsd;
      latestInputTokens = result.usage?.input_tokens ?? latestInputTokens;
      latestOutputTokens = result.usage?.output_tokens ?? latestOutputTokens;
      latestCacheReadTokens = result.usage?.cache_read_input_tokens ?? latestCacheReadTokens;
      latestRemoteSessionId = result.session_id ?? latestRemoteSessionId;
      continue;
    }

    if (message.type === "system" && "subtype" in message) {
      const systemMessage = message as Record<string, unknown>;
      latestRemoteSessionId =
        (typeof systemMessage.session_id === "string" ? systemMessage.session_id : undefined) ??
        latestRemoteSessionId;
      latestPermissionMode =
        (typeof systemMessage.permissionMode === "string"
          ? systemMessage.permissionMode
          : typeof systemMessage.permission_mode === "string"
            ? systemMessage.permission_mode
            : undefined) ?? latestPermissionMode;
      continue;
    }

    if (message.type === "stream_event") {
      const streamMessage = message as Record<string, unknown>;
      const ttft = typeof streamMessage.ttft_ms === "number" ? streamMessage.ttft_ms : undefined;
      if (ttft !== undefined) {
        latestTtftMs = ttft;
      }
    }
  }

  for (const message of session.messages.slice(-120)) {
    if (message.type === "user_prompt") {
      round += 1;
      promptCount += 1;
      currentRoundStepCount += 1;
      maxRoundStepCount = Math.max(maxRoundStepCount, currentRoundStepCount);
      latestPrompt = message.prompt;
      latestAttachments = message.attachments ?? [];
      attachmentCount += latestAttachments.length;
      if (isSlashPrompt(message.prompt)) {
        slashCount += 1;
      }
      steps.push({
        id: `prompt-${round}-${steps.length}`,
        round,
        layer: "上下文层",
        title: `第 ${round} 轮开始`,
        detail: truncate(message.prompt || (latestAttachments.length > 0 ? "本轮包含附件输入" : "空提示")),
        tone: "neutral",
      });
      previousToolKey = null;
      continue;
    }

    if (message.type === "system" && "subtype" in message && message.subtype === "init") {
      steps.push({
        id: `init-${message.uuid ?? steps.length}`,
        round: Math.max(round, 1),
        layer: "执行流程层",
        title: "初始化执行环境",
        detail: "会话、命令能力和 slash 能力已加载。",
        tone: "info",
        statusText: "成功",
      });
      continue;
    }

    if (message.type === "system" && "subtype" in message && message.subtype === "hook_started") {
      const systemMessage = message as Record<string, unknown>;
      steps.push({
        id: `hook-${String(systemMessage.uuid ?? steps.length)}`,
        round: Math.max(round, 1),
        layer: "执行流程层",
        title: `触发 Hook：${String(systemMessage.hook_name ?? systemMessage.hook_event ?? "未知 Hook")}`,
        detail: "被动检查链路已接入，可用于事后分析每一步执行可信度。",
        tone: "warning",
        statusText: "开始",
      });
      continue;
    }

    if (message.type === "stream_event") {
      const streamMessage = message as Record<string, unknown>;
      const event = streamMessage.event as Record<string, unknown> | undefined;
      if (event?.type === "message_start") {
        steps.push({
          id: `stream-start-${String(streamMessage.uuid ?? steps.length)}`,
          round: Math.max(round, 1),
          layer: "执行流程层",
          title: "开始生成响应",
          detail:
            typeof streamMessage.ttft_ms === "number"
              ? `首字节时间 ${formatDuration(streamMessage.ttft_ms)}`
              : "模型已开始生成响应。",
          tone: "info",
          statusText: "开始",
        });
      }
      continue;
    }

    if (message.type === "assistant") {
      const assistant = message as SDKAssistantMessage;
      for (const content of assistant.message.content) {
        if (content.type === "thinking") {
          currentRoundStepCount += 1;
          steps.push({
            id: `${assistant.uuid}-thinking-${steps.length}`,
            round: Math.max(round, 1),
            layer: "执行流程层",
            title: "任务分析与决策",
            detail: truncate(content.thinking),
            tone: "warning",
          });
          continue;
        }

        if (content.type === "tool_use") {
          const detail = describeToolInput(
            content.name,
            (content.input ?? {}) as Record<string, unknown>
          );
          const toolKind = classifyToolUse(content.name, detail);
          toolCount += 1;
          currentRoundStepCount += 1;

          if (toolKind === "file") {
            fileOpCount += 1;
            if (firstWriteRoundStep === Number.POSITIVE_INFINITY && /write|edit|multiedit/i.test(content.name)) {
              firstWriteRoundStep = currentRoundStepCount;
            }
          } else if (toolKind === "search") {
            searchOpCount += 1;
          } else if (toolKind === "exec") {
            execOpCount += 1;
          } else if (toolKind === "validation") {
            execOpCount += 1;
            validationCount += 1;
          }

          const toolKey = `${content.name}:${detail}`;
          if (previousToolKey === toolKey) {
            duplicateToolCount += 1;
          }
          previousToolKey = toolKey;
          const toolOutcome = toolOutcomeMap.get(content.id);
          const toolTone: Tone = toolOutcome
            ? toolOutcome.isError
              ? "error"
              : "success"
            : toolKind === "validation"
              ? "warning"
              : "info";

          steps.push({
            id: content.id,
            round: Math.max(round, 1),
            layer: "工具层",
            title: `调用 ${content.name}`,
            detail: truncate(
              [detail || "无额外参数", toolOutcome ? `结果：${toolOutcome.detail}` : ""]
                .filter(Boolean)
                .join(" ｜ "),
              220
            ),
            tone: toolTone,
            statusText: toolOutcome ? (toolOutcome.isError ? "失败" : "成功") : "进行中",
          });
          continue;
        }

        if (content.type === "text") {
          const text = content.text.trim();
          if (!text) continue;
          steps.push({
            id: `${assistant.uuid}-text-${steps.length}`,
            round: Math.max(round, 1),
            layer: "执行结果层",
            title: "生成中间结论",
            detail: truncate(text),
            tone: "neutral",
            statusText: "输出",
          });
        }
      }
      continue;
    }

    if (message.type === "user") {
      const user = message as SDKUserMessage;
      const contents = Array.isArray(user.message.content)
        ? user.message.content
        : [user.message.content];

      for (const content of contents) {
        if (typeof content !== "string" && content.type === "tool_result") {
          currentRoundStepCount += 1;
          const detail = truncate(getToolResultDetail(content));
          if (content.is_error) {
            toolErrorCount += 1;
          } else {
            toolSuccessCount += 1;
          }
          steps.push({
            id: `${content.tool_use_id}-result`,
            round: Math.max(round, 1),
            layer: "工具层",
            title: content.is_error ? "工具返回错误" : "工具返回结果",
            detail,
            tone: content.is_error ? "error" : "success",
            statusText: content.is_error ? "失败" : "成功",
          });
        }
      }
      continue;
    }

    if (message.type === "result") {
      const result = message as SDKResultMessage;
      currentRoundStepCount += 1;
      maxRoundStepCount = Math.max(maxRoundStepCount, currentRoundStepCount);
      if (result.subtype === "success") {
        successCount += 1;
        latestResult = "已完成";
      } else {
        errorCount += 1;
        latestResult = "执行失败";
      }
      steps.push({
        id: `${result.uuid}-result`,
        round: Math.max(round, 1),
        layer: "执行结果层",
        title: result.subtype === "success" ? "本轮执行完成" : "本轮执行失败",
        detail: [
          result.subtype === "success"
            ? "本轮已经产出结果，可继续追问或复盘。"
            : "本轮失败，建议先查看错误步骤和人工确认点。",
          `总耗时 ${formatDuration(result.duration_ms)}`,
          `API 耗时 ${formatDuration(result.duration_api_ms)}`,
          `输入 ${formatNumber(result.usage?.input_tokens)} / 输出 ${formatNumber(result.usage?.output_tokens)} tokens`,
        ].join(" ｜ "),
        tone: result.subtype === "success" ? "success" : "error",
        statusText: result.subtype === "success" ? "成功" : "失败",
      });
      currentRoundStepCount = 0;
      previousToolKey = null;
    }
  }

  const permissionCount = permissionRequests.length;
  const waitingCount = permissionRequests.length;
  if (permissionCount > 0) {
    latestResult = "等待确认";
    for (const request of permissionRequests) {
      steps.unshift({
        id: `permission-${request.toolUseId}`,
        round: Math.max(round, 1),
        layer: "执行流程层",
        title: `等待人工确认 ${request.toolName}`,
        detail: truncate(stringifyUnknown(request.input)),
        tone: "warning",
        statusText: "待确认",
      });
    }
  } else if (session.status === "running" && promptCount > 0) {
    latestResult = "执行中";
  } else if (session.status === "idle" && promptCount === 0) {
    latestResult = "尚未开始";
  }

  const preparationLevel: CostMetric["level"] =
    firstWriteRoundStep === Number.POSITIVE_INFINITY
      ? promptCount > 0
        ? "中"
        : "低"
      : firstWriteRoundStep >= 7 || attachmentCount >= 2
        ? "高"
        : firstWriteRoundStep >= 4
          ? "中"
          : "低";

  const validationLevel: CostMetric["level"] =
    validationCount >= 4 ? "高" : validationCount >= 2 ? "中" : "低";

  const reworkSignals = toolErrorCount + duplicateToolCount + permissionCount;
  const reworkLevel: CostMetric["level"] =
    reworkSignals >= 5 ? "高" : reworkSignals >= 2 ? "中" : "低";

  const layerMetrics: LayerMetric[] = [
    {
      label: "工具层",
      primaryLabel: "调用总数",
      primaryValue: String(toolCount),
      secondaryLabel: "失败 / 等待",
      secondaryValue: `${toolErrorCount} / ${permissionCount}`,
      footnote: `文件 ${fileOpCount} · 检索 ${searchOpCount} · 执行 ${execOpCount}`,
      tone: toolErrorCount > 0 ? "error" : permissionCount > 0 ? "warning" : "info",
    },
    {
      label: "上下文层",
      primaryLabel: "提示轮次",
      primaryValue: String(promptCount),
      secondaryLabel: "附件 / slash",
      secondaryValue: `${attachmentCount} / ${slashCount}`,
      footnote: "用于看上下文来源是否持续膨胀。",
      tone: "neutral",
    },
    {
      label: "执行结果层",
      primaryLabel: "完成轮次",
      primaryValue: String(successCount),
      secondaryLabel: "最新结果",
      secondaryValue: latestResult,
      footnote: `耗时 ${formatDuration(latestDurationMs)} · 输入 ${formatNumber(latestInputTokens)} · 输出 ${formatNumber(latestOutputTokens)}`,
      tone: latestResult === "执行失败" ? "error" : latestResult === "等待确认" ? "warning" : "success",
    },
    {
      label: "执行流程层",
      primaryLabel: "原子步骤",
      primaryValue: String(steps.length),
      secondaryLabel: "人工介入",
      secondaryValue: String(permissionCount),
      footnote: `当前最大轮复杂度 ${maxRoundStepCount || steps.length} 步`,
      tone: permissionCount > 0 ? "warning" : "neutral",
    },
  ];

  const costMetrics: CostMetric[] = [
    {
      label: "准备成本",
      level: preparationLevel,
      detail:
        preparationLevel === "高"
          ? "进入写代码前需要较多检索 / 读文件 / 补充上下文。"
          : preparationLevel === "中"
            ? "已经存在一定准备动作，但仍可继续交给 Agent。"
            : "上下文较直接，可低摩擦进入执行。",
      tone: preparationLevel === "高" ? "warning" : "neutral",
    },
    {
      label: "验证成本",
      level: validationLevel,
      detail:
        validationCount > 0
          ? `检测到 ${validationCount} 次偏验证性质的动作（测试 / 构建 / 检查）。`
          : "当前还没有明显的验证动作，可视为低验证成本。",
      tone: validationLevel === "高" ? "warning" : "neutral",
    },
    {
      label: "返工风险",
      level: reworkLevel,
      detail:
        reworkSignals > 0
          ? `错误 ${toolErrorCount} · 冗余调用 ${duplicateToolCount} · 待确认 ${permissionCount}`
          : "当前没有显著返工信号。",
      tone: reworkLevel === "高" ? "error" : reworkLevel === "中" ? "warning" : "success",
    },
  ];

  return {
    promptCount,
    slashCount,
    attachmentCount,
    toolCount,
    toolSuccessCount,
    toolErrorCount,
    fileOpCount,
    searchOpCount,
    execOpCount,
    successCount,
    errorCount,
    permissionCount,
    waitingCount,
    roundCount: round,
    stepCount: steps.length,
      latestPrompt,
      latestAttachments,
      latestResult,
      latestDurationMs,
      latestApiDurationMs,
      latestInputTokens,
      latestOutputTokens,
      latestCacheReadTokens,
      latestCostUsd,
      latestTtftMs,
      latestModel,
      latestRemoteSessionId,
      latestPermissionMode,
      duplicateToolCount,
      validationCount,
      layerMetrics,
    costMetrics,
    steps: steps.slice(-40).reverse(),
  };
}

function statusLabel(status: SessionView["status"]) {
  switch (status) {
    case "running":
      return { text: "执行中", tone: "info" as const };
    case "completed":
      return { text: "已完成", tone: "success" as const };
    case "error":
      return { text: "出错", tone: "error" as const };
    default:
      return { text: "待命", tone: "neutral" as const };
  }
}

function StepBadge({ layer }: { layer: ObservationLayer }) {
  const tone: Tone =
    layer === "工具层"
      ? "info"
      : layer === "上下文层"
        ? "neutral"
        : layer === "执行结果层"
          ? "success"
          : "warning";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClasses(tone)}`}>
      {layer}
    </span>
  );
}

export function ActivityRail({
  session,
  partialMessage,
  globalError,
}: {
  session: SessionView | undefined;
  partialMessage: string;
  globalError: string | null;
}) {
  const permissionRequests = session?.permissionRequests ?? [];
  const [showPromptDetail, setShowPromptDetail] = useState(false);
  const [showContextDetail, setShowContextDetail] = useState(false);
  const [showExecutionDetail, setShowExecutionDetail] = useState(false);
  const metrics = useMemo(
    () => buildObservationModel(session, permissionRequests),
    [session, permissionRequests]
  );
  const status = statusLabel(session?.status ?? "idle");

  return (
    <aside className="fixed inset-y-0 right-0 hidden w-[348px] overflow-y-auto border-l border-black/5 bg-[linear-gradient(180deg,rgba(246,248,251,0.96),rgba(238,242,247,0.94))] px-4 pb-5 pt-12 shadow-[inset_1px_0_0_rgba(255,255,255,0.72)] backdrop-blur-xl xl:flex xl:flex-col">
      <div
        className="absolute inset-x-0 top-0 h-12"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink-800">执行观测</div>
          <div className="mt-1 text-xs leading-5 text-muted">
            口径按 4 层观测展开：工具、上下文、结果、流程。默认只看指标，细节按需展开。
          </div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(status.tone)}`}>
          {status.text}
        </span>
      </div>

      {globalError && (
        <div className="mt-4 rounded-2xl border border-error/20 bg-error-light p-3 text-sm text-error">
          {globalError}
        </div>
      )}

      <section className="mt-4 rounded-[24px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
        <div className="text-xs font-semibold text-ink-700">四层观测口径</div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {metrics.layerMetrics.map((item) => (
            <div key={item.label} className={`rounded-2xl px-3 py-3 ${metricTone(item.tone ?? "neutral")}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-semibold text-current/80">{item.label}</div>
                <div className="text-[11px] text-current/70">
                  {item.primaryLabel} · {item.secondaryLabel}
                </div>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">{item.primaryValue}</div>
                  <div className="text-[11px] text-current/70">{item.primaryLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">{item.secondaryValue}</div>
                  <div className="text-[11px] text-current/70">{item.secondaryLabel}</div>
                </div>
              </div>
              <div className="mt-2 text-[11px] leading-5 text-current/75">{item.footnote}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
        <div className="text-xs font-semibold text-ink-700">结果摘要</div>
        <div className="mt-1 text-[11px] text-muted">看最新一轮是否成功、用了多少 token、耗时多久。</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={`rounded-2xl px-3 py-3 ${metricTone(status.tone)}`}>
            <div className="text-[11px] text-current/70">执行结果</div>
            <div className="mt-1 text-sm font-semibold">{metrics.latestResult}</div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3 text-ink-800">
            <div className="text-[11px] text-muted">总耗时</div>
            <div className="mt-1 text-sm font-semibold">{formatDuration(metrics.latestDurationMs)}</div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3 text-ink-800">
            <div className="text-[11px] text-muted">API 耗时 / TTFT</div>
            <div className="mt-1 text-sm font-semibold">
              {formatDuration(metrics.latestApiDurationMs)} / {formatDuration(metrics.latestTtftMs)}
            </div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3 text-ink-800">
            <div className="text-[11px] text-muted">输入 / 输出 Tokens</div>
            <div className="mt-1 text-sm font-semibold">
              {formatNumber(metrics.latestInputTokens)} / {formatNumber(metrics.latestOutputTokens)}
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3 text-[11px] text-muted">
          缓存读取 {formatNumber(metrics.latestCacheReadTokens)} · 费用 {formatUsd(metrics.latestCostUsd)}
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
        <div className="text-xs font-semibold text-ink-700">Agent 总成本判断</div>
        <div className="mt-1 text-[11px] text-muted">准备成本 + 验证成本 + 返工风险，用来判断当前轮是否适合继续交给 AI。</div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          {metrics.costMetrics.map((item) => (
            <div key={item.label} className={`rounded-2xl px-3 py-3 ${metricTone(item.tone)}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] text-current/70">{item.label}</div>
                <div className="text-sm font-semibold">{item.level}</div>
              </div>
              <div className="mt-2 text-[11px] leading-5 text-current/80">{item.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-[24px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-ink-700">当前提示</div>
            <div className="mt-1 text-[11px] text-muted">详细 prompt 默认折叠，避免右侧被提示词淹没。</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPromptDetail((value) => !value)}
              className="rounded-full border border-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-900/20 hover:bg-surface-secondary"
            >
              {showPromptDetail ? "收起提示" : "查看提示"}
            </button>
            <button
              type="button"
              onClick={() => setShowContextDetail((value) => !value)}
              className="rounded-full border border-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-900/20 hover:bg-surface-secondary"
            >
              {showContextDetail ? "收起上下文" : "查看上下文"}
            </button>
          </div>
        </div>
        {showPromptDetail && (
          <div className="mt-3 rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3">
            <div className="text-[11px] text-muted">最新用户输入</div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink-800">
              {metrics.latestPrompt ||
                (metrics.latestAttachments.length > 0 ? "本轮主要发送了附件。" : "还没有发送提示。")}
            </p>
            {metrics.latestAttachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {metrics.latestAttachments.map((attachment) => (
                  <span
                    key={attachment.id}
                    className="rounded-full border border-ink-900/10 bg-white px-2.5 py-1 text-[11px] text-ink-700"
                  >
                    {attachment.kind === "image" ? "图片" : "文本"} · {attachment.name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-ink-900/5 pt-3 text-[11px] text-muted">
              会话：{session?.title || "尚未开始"} · 轮次：{metrics.roundCount}
            </div>
          </div>
        )}
        {showContextDetail && (
          <div className="mt-3 rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3">
            <div className="text-[11px] text-muted">上下文快照</div>
            <div className="mt-3 grid gap-2 text-[12px] text-ink-800">
              <div>本地会话：{session?.id || "-"}</div>
              <div>远端会话：{metrics.latestRemoteSessionId || "-"}</div>
              <div>当前模型：{metrics.latestModel || "-"}</div>
              <div>权限模式：{metrics.latestPermissionMode || "bypassPermissions"}</div>
              <div>工作目录：{session?.cwd || "-"}</div>
              <div>Slash 命令数：{session?.slashCommands?.length ?? 0}</div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 min-h-0 flex-1 rounded-[24px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] p-4 shadow-[0_14px_34px_rgba(30,38,52,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-ink-700">原子步骤轨迹</div>
            <div className="mt-1 text-[11px] text-muted">用步骤追踪代替“最近消息摘要”，方便分析每一步怎么执行、卡在哪一层。</div>
          </div>
          <button
            type="button"
            onClick={() => setShowExecutionDetail((value) => !value)}
            className="rounded-full border border-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-900/20 hover:bg-surface-secondary"
          >
            {showExecutionDetail ? "收起轨迹" : "展开轨迹"}
          </button>
        </div>

        {showExecutionDetail ? (
          <div className="mt-3 flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            {partialMessage && (
              <section className="rounded-2xl border border-info/20 bg-info-light/30 p-4">
                <div className="text-xs font-semibold text-info">实时输出</div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-700">{partialMessage}</p>
              </section>
            )}
            {metrics.steps.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-900/10 bg-surface-secondary px-3 py-4 text-sm text-muted">
                发出一条消息后，这里会按“上下文 → 流程 → 工具 → 结果”的口径记录原子步骤。
              </div>
            ) : (
              <>
                <div className="text-[11px] text-muted">最近 {metrics.steps.length} 个步骤</div>
                {metrics.steps.map((step) => (
                  <div key={step.id} className={`rounded-xl border px-3 py-3 ${toneClasses(step.tone)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StepBadge layer={step.layer} />
                          <span className="text-[10px] font-medium text-current/70">第 {step.round} 轮</span>
                          {step.statusText && (
                            <span className="rounded-full border border-current/15 px-2 py-0.5 text-[10px] font-medium text-current/80">
                              {step.statusText}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 text-sm font-medium">{step.title}</div>
                      </div>
                    </div>
                    {step.detail && (
                      <div className="mt-2 break-words text-xs leading-5 opacity-90">{step.detail}</div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-ink-900/10 bg-surface-secondary px-3 py-4 text-sm text-muted">
            默认只展示观测指标。点击“展开轨迹”后，可按四层口径查看每一步执行。
          </div>
        )}
      </section>
    </aside>
  );
}
