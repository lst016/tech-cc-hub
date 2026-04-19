import { useMemo, useState, type CSSProperties } from "react";
import type { SDKAssistantMessage, SDKMessage, SDKResultMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment } from "../types";
import type { PermissionRequest, SessionView } from "../store/useAppStore";

type ActivityItem = {
  id: string;
  title: string;
  detail?: string;
  tone: "neutral" | "info" | "success" | "error" | "warning";
};

function toneClasses(tone: ActivityItem["tone"]) {
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

function describeToolInput(name: string, input: Record<string, unknown>) {
  switch (name) {
    case "Bash":
      return String(input.command ?? "");
    case "Read":
    case "Write":
    case "Edit":
      return String(input.file_path ?? "");
    case "Glob":
    case "Grep":
      return String(input.pattern ?? "");
    case "Task":
      return String(input.description ?? "");
    case "WebFetch":
      return String(input.url ?? "");
    default:
      return Object.keys(input).length > 0 ? JSON.stringify(input) : "";
  }
}

function buildActivityItems(session: SessionView | undefined, permissionRequests: PermissionRequest[]) {
  const items: ActivityItem[] = [];
  if (!session) return items;

  for (const message of session.messages.slice(-30)) {
    if ((message as SDKMessage).type === "assistant") {
      const assistant = message as SDKAssistantMessage;
      for (const content of assistant.message.content) {
        if (content.type === "tool_use") {
          items.push({
            id: content.id,
            title: `调用 ${content.name}`,
            detail: describeToolInput(content.name, (content.input ?? {}) as Record<string, unknown>),
            tone: "info",
          });
        } else if (content.type === "text") {
          items.push({
            id: `${assistant.uuid}-text`,
            title: "助手输出",
            detail: content.text.slice(0, 120),
            tone: "neutral",
          });
        } else if (content.type === "thinking") {
          items.push({
            id: `${assistant.uuid}-thinking`,
            title: "内部思考",
            detail: content.thinking.slice(0, 120),
            tone: "warning",
          });
        }
      }
      continue;
    }

    if ((message as SDKMessage).type === "user") {
      const user = message as SDKUserMessage;
      const contents = Array.isArray(user.message.content) ? user.message.content : [user.message.content];
      for (const content of contents) {
        if (typeof content !== "string" && content.type === "tool_result") {
          const detail = Array.isArray(content.content)
            ? content.content
                .map((item) => {
                  if (typeof item === "string") return item;
                  if ("text" in item && typeof item.text === "string") return item.text;
                  if ("source" in item && item.source && typeof item.source === "object") return JSON.stringify(item.source);
                  return JSON.stringify(item);
                })
                .join(" ")
                .slice(0, 120)
            : String(content.content).slice(0, 120);
          items.push({
            id: `${content.tool_use_id}-result`,
            title: content.is_error ? "工具返回错误" : "工具返回结果",
            detail,
            tone: content.is_error ? "error" : "success",
          });
        }
      }
      continue;
    }

    if ((message as SDKMessage).type === "result") {
      const result = message as SDKResultMessage;
      items.push({
        id: `${result.uuid}-result`,
        title: result.subtype === "success" ? "本轮执行完成" : "本轮执行失败",
        detail: result.subtype === "success" ? "结果已生成，可继续追问或复盘。" : "请查看错误详情后重试。",
        tone: result.subtype === "success" ? "success" : "error",
      });
    }
  }

  for (const request of permissionRequests) {
    items.unshift({
      id: `permission-${request.toolUseId}`,
      title: `等待你确认 ${request.toolName}`,
      detail: typeof request.input === "object" ? JSON.stringify(request.input).slice(0, 120) : String(request.input ?? ""),
      tone: "warning",
    });
  }

  return items.slice(-10).reverse();
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

type MetricsSummary = {
  promptCount: number;
  toolCount: number;
  successCount: number;
  errorCount: number;
  latestPrompt: string | null;
  latestAttachments: PromptAttachment[];
  latestResult: string;
};

function buildMetricsSummary(session: SessionView | undefined, permissionRequests: PermissionRequest[]): MetricsSummary {
  if (!session) {
    return {
      promptCount: 0,
      toolCount: 0,
      successCount: 0,
      errorCount: 0,
      latestPrompt: null,
      latestAttachments: [],
      latestResult: "尚未开始",
    };
  }

  let promptCount = 0;
  let toolCount = 0;
  let successCount = 0;
  let errorCount = permissionRequests.length > 0 ? 1 : 0;
  let latestPrompt: string | null = null;
  let latestAttachments: PromptAttachment[] = [];
  let latestResult = permissionRequests.length > 0 ? "等待确认" : "执行中";

  for (const message of session.messages) {
    if (message.type === "user_prompt") {
      promptCount += 1;
      latestPrompt = message.prompt;
      latestAttachments = message.attachments ?? [];
      continue;
    }

    if (message.type === "assistant") {
      for (const content of message.message.content) {
        if (content.type === "tool_use") {
          toolCount += 1;
        }
      }
      continue;
    }

    if (message.type === "result") {
      if (message.subtype === "success") {
        successCount += 1;
        latestResult = "已完成";
      } else {
        errorCount += 1;
        latestResult = "执行失败";
      }
    }
  }

  if (session.status === "idle" && promptCount === 0) {
    latestResult = "尚未开始";
  } else if (session.status === "completed" && successCount > 0) {
    latestResult = "已完成";
  } else if (session.status === "error") {
    latestResult = "执行失败";
  } else if (permissionRequests.length > 0) {
    latestResult = "等待确认";
  }

  return {
    promptCount,
    toolCount,
    successCount,
    errorCount,
    latestPrompt,
    latestAttachments,
    latestResult,
  };
}

function metricTone(tone: ActivityItem["tone"]) {
  return `border ${toneClasses(tone)}`;
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
  const [showExecutionDetail, setShowExecutionDetail] = useState(false);
  const items = useMemo(() => buildActivityItems(session, permissionRequests), [session, permissionRequests]);
  const metrics = useMemo(() => buildMetricsSummary(session, permissionRequests), [session, permissionRequests]);
  const status = statusLabel(session?.status ?? "idle");

  return (
    <aside className="fixed inset-y-0 right-0 hidden w-[320px] border-l border-ink-900/5 bg-[#F7F5F1] px-4 pb-5 pt-12 xl:flex xl:flex-col">
      <div
        className="absolute top-0 left-0 right-0 h-12"
        style={{ WebkitAppRegion: "drag" } as CSSProperties}
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-ink-800">执行侧栏</div>
          <div className="mt-1 text-xs text-muted">默认只显示执行指标，详细内容按需展开查看。</div>
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

      <section className="mt-4 rounded-2xl border border-ink-900/5 bg-white p-4 shadow-soft">
        <div className="text-xs font-semibold text-ink-700">执行指标</div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={`rounded-2xl px-3 py-3 ${metricTone(status.tone)}`}>
            <div className="text-[11px] text-current/70">状态</div>
            <div className="mt-1 text-sm font-semibold">{status.text}</div>
          </div>
          <div className={`rounded-2xl px-3 py-3 ${metricTone(status.tone === "error" ? "error" : "neutral")}`}>
            <div className="text-[11px] text-current/70">结果</div>
            <div className="mt-1 text-sm font-semibold">{metrics.latestResult}</div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3 text-ink-800">
            <div className="text-[11px] text-muted">指令轮次</div>
            <div className="mt-1 text-sm font-semibold">{metrics.promptCount}</div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3 text-ink-800">
            <div className="text-[11px] text-muted">工具调用</div>
            <div className="mt-1 text-sm font-semibold">{metrics.toolCount}</div>
          </div>
          <div className="rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3 text-ink-800">
            <div className="text-[11px] text-muted">已完成轮次</div>
            <div className="mt-1 text-sm font-semibold">{metrics.successCount}</div>
          </div>
          <div className={`rounded-2xl px-3 py-3 ${permissionRequests.length > 0 ? metricTone("warning") : "border border-ink-900/10 bg-surface-secondary text-ink-800"}`}>
            <div className="text-[11px] text-current/70">待确认</div>
            <div className="mt-1 text-sm font-semibold">{permissionRequests.length}</div>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-ink-900/5 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-ink-700">当前提示</div>
            <div className="mt-1 text-[11px] text-muted">默认折叠，避免右侧信息过载。</div>
          </div>
          <button
            type="button"
            onClick={() => setShowPromptDetail((value) => !value)}
            className="rounded-full border border-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-900/20 hover:bg-surface-secondary"
          >
            {showPromptDetail ? "收起提示" : "查看提示"}
          </button>
        </div>
        {showPromptDetail && (
          <div className="mt-3 rounded-2xl border border-ink-900/10 bg-surface-secondary px-3 py-3">
            <div className="text-[11px] text-muted">最新用户输入</div>
            <p className="mt-2 text-sm leading-6 text-ink-800 whitespace-pre-wrap break-words">
              {metrics.latestPrompt || (metrics.latestAttachments.length > 0 ? "本轮主要发送了附件。" : "还没有发送提示。")}
            </p>
            {metrics.latestAttachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {metrics.latestAttachments.map((attachment) => (
                  <span key={attachment.id} className="rounded-full border border-ink-900/10 bg-white px-2.5 py-1 text-[11px] text-ink-700">
                    {attachment.kind === "image" ? "图片" : "文本"} · {attachment.name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 border-t border-ink-900/5 pt-3 text-[11px] text-muted">
              会话：{session?.title || "尚未开始"}
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 min-h-0 flex-1 rounded-2xl border border-ink-900/5 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-ink-700">执行明细</div>
            <div className="mt-1 text-[11px] text-muted">需要时再展开查看完整执行链。</div>
          </div>
          <button
            type="button"
            onClick={() => setShowExecutionDetail((value) => !value)}
            className="rounded-full border border-ink-900/10 px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-ink-900/20 hover:bg-surface-secondary"
          >
            {showExecutionDetail ? "收起明细" : "展开明细"}
          </button>
        </div>
        {showExecutionDetail ? (
          <div className="mt-3 flex h-full min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            {partialMessage && (
              <section className="rounded-2xl border border-info/20 bg-info-light/30 p-4">
                <div className="text-xs font-semibold text-info">实时输出</div>
                <p className="mt-2 text-sm text-ink-700 whitespace-pre-wrap break-words">{partialMessage}</p>
              </section>
            )}
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-900/10 bg-surface-secondary px-3 py-4 text-sm text-muted">
                发出一条消息后，这里会显示工具调用、等待确认、结果回写和阶段变化。
              </div>
            ) : (
              <>
                <div className="text-[11px] text-muted">{items.length} 条最近事件</div>
                {items.map((item) => (
                  <div key={item.id} className={`rounded-xl border px-3 py-3 ${toneClasses(item.tone)}`}>
                    <div className="text-sm font-medium">{item.title}</div>
                    {item.detail && <div className="mt-1 text-xs leading-5 opacity-90 break-words">{item.detail}</div>}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-ink-900/10 bg-surface-secondary px-3 py-4 text-sm text-muted">
            默认只展示执行指标。点击“展开明细”后，可查看实时输出、工具调用和结果回写。
          </div>
        )}
      </section>
    </aside>
  );
}
