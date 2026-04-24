import { useEffect, useState } from "react";
import type {
  PermissionResult,
  SDKAssistantMessage,
  SDKMessage,
  SDKResultMessage,
  SDKUserMessage
} from "@anthropic-ai/claude-agent-sdk";
import type { PromptAttachment, StreamMessage } from "../types";
import type { PermissionRequest } from "../store/useAppStore";
import MDContent from "../render/markdown";
import { DecisionPanel } from "./DecisionPanel";
import { resolveImageAttachmentSrc } from "../../shared/attachments";

type MessageContent = SDKAssistantMessage["message"]["content"][number];
type ToolResultContent = SDKUserMessage["message"]["content"][number];
type ToolStatus = "pending" | "success" | "error";
const toolStatusMap = new Map<string, ToolStatus>();
const toolStatusListeners = new Set<() => void>();
const MAX_VISIBLE_LINES = 3;

type SystemInitMessage = SDKMessage & {
  subtype?: string;
  session_id?: string;
  model?: string;
  permissionMode?: string;
  cwd?: string;
};

type AskUserQuestionInput = {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
};

const getAskUserQuestionSignature = (input?: AskUserQuestionInput | null) => {
  if (!input?.questions?.length) return "";
  return input.questions.map((question) => {
    const options = (question.options ?? []).map((o) => `${o.label}|${o.description ?? ""}`).join(",");
    return `${question.question}|${question.header ?? ""}|${question.multiSelect ? "1" : "0"}|${options}`;
  }).join("||");
};

const setToolStatus = (toolUseId: string | undefined, status: ToolStatus) => {
  if (!toolUseId) return;
  toolStatusMap.set(toolUseId, status);
  toolStatusListeners.forEach((listener) => listener());
};

const getRecordString = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  return typeof value === "string" ? value : null;
};

const InfoItem = ({ name, value }: { name: string; value: string }) => (
  <div className="text-[14px]">
    <span className="mr-4 font-normal">{name}</span>
    <span className="font-light">{value}</span>
  </div>
);

const useToolStatus = (toolUseId: string | undefined) => {
  const [status, setStatus] = useState<ToolStatus | undefined>(() =>
    toolUseId ? toolStatusMap.get(toolUseId) : undefined
  );
  useEffect(() => {
    if (!toolUseId) return;
    const handleUpdate = () => setStatus(toolStatusMap.get(toolUseId));
    toolStatusListeners.add(handleUpdate);
    return () => { toolStatusListeners.delete(handleUpdate); };
  }, [toolUseId]);
  return status;
};

const StatusDot = ({ variant = "accent", isActive = false, isVisible = true }: {
  variant?: "accent" | "success" | "error"; isActive?: boolean; isVisible?: boolean;
}) => {
  if (!isVisible) return null;
  const colorClass = variant === "success" ? "bg-success" : variant === "error" ? "bg-error" : "bg-accent";
  return (
    <span className="relative flex h-2 w-2">
      {isActive && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colorClass} opacity-75`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colorClass}`} />
    </span>
  );
};

const SessionResult = ({ message }: { message: SDKResultMessage }) => {
  const formatMinutes = (ms: number | undefined) => typeof ms !== "number" ? "-" : `${(ms / 60000).toFixed(2)} min`;
  const formatUsd = (usd: number | undefined) => typeof usd !== "number" ? "-" : usd.toFixed(2);
  const formatMillions = (tokens: number | undefined) => typeof tokens !== "number" ? "-" : `${(tokens / 1_000_000).toFixed(4)} M`;

  return (
    <div className="mt-5 flex flex-col gap-2">
      <div className="text-[11px] font-semibold tracking-[0.16em] text-muted">会话结果</div>
      <div className="flex flex-col rounded-[24px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,247,250,0.92))] px-4 py-4 shadow-[0_10px_26px_rgba(30,38,52,0.05)] space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="font-normal">总耗时</span>
          <span className="inline-flex items-center rounded-full bg-[#eef2f8] px-2.5 py-0.5 text-ink-700 text-[13px]">{formatMinutes(message.duration_ms)}</span>
          <span className="font-normal">API 耗时</span>
          <span className="inline-flex items-center rounded-full bg-[#eef2f8] px-2.5 py-0.5 text-ink-700 text-[13px]">{formatMinutes(message.duration_api_ms)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[14px]">
          <span className="font-normal">用量</span>
          <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-accent text-[13px]">费用 ${formatUsd(message.total_cost_usd)}</span>
          <span className="inline-flex items-center rounded-full bg-[#eef2f8] px-2.5 py-0.5 text-ink-700 text-[13px]">输入 {formatMillions(message.usage?.input_tokens)}</span>
          <span className="inline-flex items-center rounded-full bg-[#eef2f8] px-2.5 py-0.5 text-ink-700 text-[13px]">输出 {formatMillions(message.usage?.output_tokens)}</span>
        </div>
      </div>
    </div>
  );
};

export function isMarkdown(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const patterns: RegExp[] = [/^#{1,6}\s+/m, /```[\s\S]*?```/];
  return patterns.some((pattern) => pattern.test(text));
}

function extractTagContent(input: string, tag: string): string | null {
  const match = input.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1] : null;
}

const ToolResult = ({ messageContent }: { messageContent: ToolResultContent }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isToolResult = typeof messageContent !== "string" && messageContent.type === "tool_result";
  const toolUseId = isToolResult ? messageContent.tool_use_id : undefined;
  const status: ToolStatus = isToolResult && messageContent.is_error ? "error" : "success";
  let lines: string[] = [];

  useEffect(() => {
    if (isToolResult) {
      setToolStatus(toolUseId, status);
    }
  }, [isToolResult, status, toolUseId]);

  if (!isToolResult) return null;

  const isError = messageContent.is_error;

  if (messageContent.is_error) {
    lines = [extractTagContent(String(messageContent.content), "tool_use_error") || String(messageContent.content)];
  } else {
    try {
      if (Array.isArray(messageContent.content)) {
        lines = messageContent.content
          .map((item) => typeof item === "string" ? item : ("text" in item ? item.text ?? "" : ""))
          .join("\n")
          .split("\n");
      } else {
        lines = String(messageContent.content).split("\n");
      }
    } catch { lines = [JSON.stringify(messageContent, null, 2)]; }
  }

  const isMarkdownContent = isMarkdown(lines.join("\n"));
  const hasMoreLines = lines.length > MAX_VISIBLE_LINES;
  const visibleContent = hasMoreLines && !isExpanded ? lines.slice(0, MAX_VISIBLE_LINES).join("\n") : lines.join("\n");

  return (
    <div className="mt-4 flex flex-col">
      <div className="text-[11px] font-semibold tracking-[0.16em] text-muted">工具输出</div>
      <div className="mt-2 rounded-[22px] border border-black/6 bg-[#f4f7fb] p-4">
        <pre className={`text-sm whitespace-pre-wrap break-words font-mono ${isError ? "text-red-500" : "text-ink-700"}`}>
          {isMarkdownContent ? <MDContent text={visibleContent} /> : visibleContent}
        </pre>
        {hasMoreLines && (
          <button onClick={() => setIsExpanded(!isExpanded)} className="mt-2 text-sm text-accent hover:text-accent-hover transition-colors flex items-center gap-1">
            <span>{isExpanded ? "▲" : "▼"}</span>
            <span>{isExpanded ? "收起" : `展开剩余 ${lines.length - MAX_VISIBLE_LINES} 行`}</span>
          </button>
        )}
      </div>
    </div>
  );
};

const AssistantBlockCard = ({ title, text, showIndicator = false }: { title: string; text: string; showIndicator?: boolean }) => (
  <div className="mt-5 flex flex-col">
    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted">
      <StatusDot variant="success" isActive={showIndicator} isVisible={showIndicator} />
      {title}
    </div>
    <div className="mt-2 rounded-[24px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,249,252,0.94))] px-5 py-4 shadow-[0_10px_24px_rgba(30,38,52,0.05)]">
      <MDContent text={text} />
    </div>
  </div>
);

const ToolUseCard = ({ messageContent, showIndicator = false }: { messageContent: MessageContent; showIndicator?: boolean }) => {
  const isToolUse = messageContent.type === "tool_use";
  const toolUseId = isToolUse ? messageContent.id : undefined;
  const toolStatus = useToolStatus(toolUseId);
  const statusVariant = toolStatus === "error" ? "error" : "success";
  const isPending = !toolStatus || toolStatus === "pending";
  const shouldShowDot = toolStatus === "success" || toolStatus === "error" || showIndicator;

  useEffect(() => {
    if (toolUseId && !toolStatusMap.has(toolUseId)) setToolStatus(toolUseId, "pending");
  }, [toolUseId]);

  if (!isToolUse) return null;

  const getToolInfo = (): string | null => {
    const input = messageContent.input as Record<string, unknown>;
    switch (messageContent.name) {
      case "Bash": return getRecordString(input, "command");
      case "Read": case "Write": case "Edit": return getRecordString(input, "file_path");
      case "Glob": case "Grep": return getRecordString(input, "pattern");
      case "Task": return getRecordString(input, "description");
      case "WebFetch": return getRecordString(input, "url");
      default: return null;
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-[20px] border border-black/6 bg-[#f4f7fb] px-3 py-3 overflow-hidden">
      <div className="flex flex-row items-center gap-2 min-w-0">
        <StatusDot variant={statusVariant} isActive={isPending && showIndicator} isVisible={shouldShowDot} />
        <div className="flex flex-row items-center gap-2 tool-use-item min-w-0 flex-1">
          <span className="inline-flex items-center rounded-md text-accent py-0.5 text-sm font-medium shrink-0">{messageContent.name}</span>
          <span className="text-sm text-muted truncate">{getToolInfo()}</span>
        </div>
      </div>
    </div>
  );
};

const AskUserQuestionCard = ({
  messageContent,
  permissionRequest,
  onPermissionResult
}: {
  messageContent: MessageContent;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
}) => {
  if (messageContent.type !== "tool_use") return null;
  
  const input = messageContent.input as AskUserQuestionInput | null;
  const questions = input?.questions ?? [];
  const currentSignature = getAskUserQuestionSignature(input);
  const requestSignature = getAskUserQuestionSignature(permissionRequest?.input as AskUserQuestionInput | undefined);
  const isActiveRequest = permissionRequest && currentSignature === requestSignature;

  if (isActiveRequest && onPermissionResult) {
    return (
      <div className="mt-4">
        <DecisionPanel
          request={permissionRequest}
          onSubmit={(result) => onPermissionResult(permissionRequest.toolUseId, result)}
        />
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-[20px] border border-black/6 bg-[#f4f7fb] px-3 py-3">
      <div className="flex flex-row items-center gap-2">
        <StatusDot variant="success" isActive={false} isVisible={true} />
        <span className="inline-flex items-center rounded-md text-accent py-0.5 text-sm font-medium">向你提问</span>
      </div>
      {questions.map((q, idx) => (
        <div key={idx} className="text-sm text-ink-700 ml-4">{q.question}</div>
      ))}
    </div>
  );
};

const SystemInfoCard = ({ message, showIndicator = false }: { message: SDKMessage; showIndicator?: boolean }) => {
  if (message.type !== "system" || !("subtype" in message) || message.subtype !== "init") return null;
  
  const systemMsg = message as SystemInitMessage;
  
  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted">
        <StatusDot variant="success" isActive={showIndicator} isVisible={showIndicator} />
        系统初始化
      </div>
      <div className="flex flex-col rounded-[22px] border border-black/6 bg-[#f4f7fb] px-4 py-3 space-y-1">
        <InfoItem name="会话编号" value={systemMsg.session_id || "-"} />
        <InfoItem name="模型名称" value={systemMsg.model || "-"} />
        <InfoItem name="权限模式" value={systemMsg.permissionMode || "-"} />
        <InfoItem name="工作目录" value={systemMsg.cwd || "-"} />
      </div>
    </div>
  );
};

const AttachmentChip = ({ attachment }: { attachment: PromptAttachment }) => (
  <div className="rounded-2xl border border-black/6 bg-[#eef2f8] px-3 py-2">
    <div className="text-xs font-medium text-ink-700">{attachment.name}</div>
    <div className="mt-1 text-[11px] text-muted">
      {attachment.kind === "image" ? "图片附件" : "文本附件"}
    </div>
  </div>
);

const UserMessageCard = ({ message, showIndicator = false }: { message: { type: "user_prompt"; prompt: string; attachments?: PromptAttachment[] }; showIndicator?: boolean }) => (
  <div className="mt-5 flex flex-col items-end">
    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-muted">
      <StatusDot variant="success" isActive={showIndicator} isVisible={showIndicator} />
      用户
    </div>
    {message.prompt.trim() ? (
      <div className="mt-2 w-full max-w-[78%] rounded-[24px] border border-accent/18 bg-[linear-gradient(180deg,rgba(253,244,241,0.98),rgba(255,255,255,0.96))] px-5 py-4 text-ink-800 shadow-[0_16px_30px_rgba(210,106,61,0.08)]">
        <MDContent text={message.prompt} />
      </div>
    ) : (
      <div className="mt-2 w-full max-w-[78%] rounded-[24px] border border-black/6 bg-[#eef2f8] px-4 py-3 text-sm text-muted">
        已发送附件
      </div>
    )}
    {message.attachments && message.attachments.length > 0 && (
      <div className="mt-3 grid w-full max-w-[78%] gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {message.attachments.map((attachment) => (
            <AttachmentChip key={attachment.id} attachment={attachment} />
          ))}
        </div>
        {message.attachments.map((attachment) => {
          if (attachment.kind === "image") {
            const imageSrc = resolveImageAttachmentSrc(attachment);
            return (
              <div key={`${attachment.id}-preview`} className="overflow-hidden rounded-2xl border border-black/6 bg-[#eef2f8] p-2">
                <img
                  src={imageSrc}
                  alt={attachment.name}
                  className="max-h-64 w-full rounded-xl object-contain"
                />
              </div>
            );
          }

          return (
            <div key={`${attachment.id}-preview`} className="rounded-2xl border border-black/6 bg-[#eef2f8] p-3">
              <div className="mb-2 text-xs font-medium text-muted">{attachment.name}</div>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm text-ink-700">
                {attachment.preview || attachment.data}
              </pre>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export function MessageCard({
  message,
  isLast = false,
  isRunning = false,
  permissionRequest,
  onPermissionResult
}: {
  message: StreamMessage;
  isLast?: boolean;
  isRunning?: boolean;
  permissionRequest?: PermissionRequest;
  onPermissionResult?: (toolUseId: string, result: PermissionResult) => void;
}) {
  const showIndicator = isLast && isRunning;

  if (message.type === "user_prompt") {
    return <UserMessageCard message={message} showIndicator={showIndicator} />;
  }

  const sdkMessage = message as SDKMessage;

  if (sdkMessage.type === "system") {
    return <SystemInfoCard message={sdkMessage} showIndicator={showIndicator} />;
  }

  if (sdkMessage.type === "result") {
    if (sdkMessage.subtype === "success") {
      return <SessionResult message={sdkMessage} />;
    }
    return (
      <div className="flex flex-col gap-2 mt-4">
        <div className="header text-error">会话错误</div>
        <div className="rounded-xl bg-error-light p-3">
          <pre className="text-sm text-error whitespace-pre-wrap">{JSON.stringify(sdkMessage, null, 2)}</pre>
        </div>
      </div>
    );
  }

  if (sdkMessage.type === "assistant") {
    const contents = sdkMessage.message.content;
    return (
      <>
        {contents.map((content: MessageContent, idx: number) => {
          const isLastContent = idx === contents.length - 1;
          if (content.type === "thinking") {
            return <AssistantBlockCard key={idx} title="思考" text={content.thinking} showIndicator={isLastContent && showIndicator} />;
          }
          if (content.type === "text") {
            return <AssistantBlockCard key={idx} title="助手" text={content.text} showIndicator={isLastContent && showIndicator} />;
          }
          if (content.type === "tool_use") {
            if (content.name === "AskUserQuestion") {
              return <AskUserQuestionCard key={idx} messageContent={content} permissionRequest={permissionRequest} onPermissionResult={onPermissionResult} />;
            }
            return <ToolUseCard key={idx} messageContent={content} showIndicator={isLastContent && showIndicator} />;
          }
          return null;
        })}
      </>
    );
  }

  if (sdkMessage.type === "user") {
    const contents = Array.isArray(sdkMessage.message.content)
      ? sdkMessage.message.content
      : [sdkMessage.message.content];
    return (
      <>
        {contents.map((content: ToolResultContent, idx: number) => {
          if (typeof content !== "string" && content.type === "tool_result") {
            return <ToolResult key={idx} messageContent={content} />;
          }
          return null;
        })}
      </>
    );
  }

  return null;
}

export { MessageCard as EventCard };
