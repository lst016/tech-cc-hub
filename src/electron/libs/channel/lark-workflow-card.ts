import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";

import type { WorkflowRunStatus } from "../../../shared/workflows/workflow-runs.js";
import type { StreamMessage } from "../../types.js";
import type { ChannelReplyTarget } from "./channel-workspace.js";

type UnknownRecord = Record<string, unknown>;

export type LarkWorkflowCardSessionStatus = "idle" | "running" | "completed" | "error";

export type LarkWorkflowCardRun = {
  id: string;
  taskId: string;
  workflowRunId?: string;
  workflowName?: string;
  status: WorkflowRunStatus;
  summary?: string;
  warning?: string;
  error?: string;
  sessionUrl?: string;
  canResume?: boolean;
  canRerun?: boolean;
};

export type LarkWorkflowCardPermission = {
  toolUseId: string;
  toolName: string;
  input: unknown;
};

export type LarkAskUserQuestionOption = {
  label: string;
  description?: string;
};

export type LarkAskUserQuestion = {
  question: string;
  header?: string;
  options: LarkAskUserQuestionOption[];
  multiSelect: boolean;
};

export type LarkAgentConversationEntry =
  | {
      id: string;
      kind: "assistant";
      text: string;
    }
  | {
      id: string;
      kind: "tools";
      title: string;
      detail: string;
      status: "running" | "completed" | "error";
    };

export type LarkWorkflowCardSnapshot = {
  sessionId: string;
  title: string;
  prompt?: string;
  status: LarkWorkflowCardSessionStatus;
  updatedAt: number;
  assistantSummary?: string;
  error?: string;
  actionNotice?: string;
  runs: LarkWorkflowCardRun[];
  permission?: LarkWorkflowCardPermission;
  conversation?: LarkAgentConversationEntry[];
};

export type LarkWorkflowCardActionName =
  | "stop_session"
  | "stop_task"
  | "permission_allow"
  | "permission_deny"
  | "question_answer"
  | "resume_run"
  | "rerun_run";

export type LarkWorkflowCardActionPayload = {
  v: 1;
  action: LarkWorkflowCardActionName;
  sessionId: string;
  cardVersion: number;
  taskId?: string;
  workflowRunId?: string;
  toolUseId?: string;
  answer?: string;
};

export type LarkCardActionEvent = {
  eventId: string;
  operatorId: string;
  messageId: string;
  chatId: string;
  callbackToken: string;
  timestamp?: number;
  action: LarkWorkflowCardActionPayload;
};

export type LarkCardJson = {
  schema: "2.0";
  config: {
    update_multi: true;
    enable_forward: false;
    width_mode: "default";
    summary: { content: string };
  };
  header?: {
    title: { tag: "plain_text"; content: string };
    subtitle: { tag: "plain_text"; content: string };
    template: string;
    icon: { tag: "standard_icon"; token: string };
    text_tag_list: Array<{
      tag: "text_tag";
      text: { tag: "plain_text"; content: string };
      color: string;
    }>;
  };
  body: {
    direction: "vertical";
    padding: string;
    vertical_spacing: string;
    elements: UnknownRecord[];
  };
};

export type LarkWorkflowCardSendResult = {
  messageId: string;
  chatId?: string;
};

type LarkWorkflowCardDelivery = {
  send: (
    target: ChannelReplyTarget,
    card: LarkCardJson,
    idempotencyKey: string,
  ) => Promise<LarkWorkflowCardSendResult>;
  update: (messageId: string, card: LarkCardJson) => Promise<void>;
};

type LarkWorkflowCardCoordinatorState = {
  target: ChannelReplyTarget;
  turnKey: string;
  messageId?: string;
  version: number;
  signature?: string;
  snapshot?: LarkWorkflowCardSnapshot;
  queue: Promise<void>;
};

export type LarkWorkflowCardPublicState = {
  target: ChannelReplyTarget;
  messageId?: string;
  version: number;
};

export type LarkWorkflowCardActionRejection =
  | "unknown_session"
  | "duplicate"
  | "stale"
  | "foreign_operator"
  | "foreign_message"
  | "foreign_chat";

export type LarkWorkflowReplyDelivery = "workflow_card" | "text" | "skipped";

export async function resolveLarkWorkflowReplyDelivery(
  provider: string,
  synchronizeCard: () => Promise<boolean>,
): Promise<LarkWorkflowReplyDelivery> {
  if (provider !== "lark") return "text";
  return await synchronizeCard() ? "workflow_card" : "skipped";
}

const MAX_TITLE_CHARS = 80;
const MAX_PROMPT_CHARS = 600;
const MAX_SUMMARY_CHARS = 3_000;
const MAX_RUNS = 6;
const MAX_CONVERSATION_ENTRIES = 16;
const MAX_TOOL_DETAIL_CHARS = 1_200;
const MAX_TOOL_DETAIL_ITEMS = 10;
const MAX_CONVERSATION_BYTES = 12_000;
const MAX_ACTION_EVENT_IDS = 2_000;
const MAX_ASK_QUESTIONS = 3;
const MAX_ASK_OPTIONS = 6;
const LARK_QUESTION_TOOL_NAMES = new Set([
  "AskUserQuestion",
  "mcp__tech-cc-hub-lark__ask_user_question",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function normalizeLarkAskUserQuestions(input: unknown): LarkAskUserQuestion[] {
  if (!isRecord(input)) return [];
  const rawQuestions = input.questions;
  const items = Array.isArray(rawQuestions)
    ? rawQuestions
    : typeof rawQuestions === "string" && rawQuestions.trim()
      ? [{ question: rawQuestions }]
      : isRecord(rawQuestions)
        ? [rawQuestions]
        : [];

  return items.flatMap((item): LarkAskUserQuestion[] => {
    if (typeof item === "string" && item.trim()) {
      return [{ question: item.trim(), options: [], multiSelect: false }];
    }
    if (!isRecord(item)) return [];
    const question = asString(item.question) ?? asString(item.prompt) ?? asString(item.text);
    if (!question) return [];
    const options = Array.isArray(item.options)
      ? item.options.flatMap((option): LarkAskUserQuestionOption[] => {
        if (typeof option === "string" && option.trim()) return [{ label: option.trim() }];
        if (!isRecord(option)) return [];
        const label = asString(option.label);
        if (!label) return [];
        return [{ label, ...(asString(option.description) ? { description: asString(option.description) } : {}) }];
      })
      : [];
    return [{
      question,
      ...(asString(item.header) ? { header: asString(item.header) } : {}),
      options,
      multiSelect: item.multiSelect === true,
    }];
  });
}

export function buildLarkAskUserQuestionAnsweredInput(input: unknown, reply: string): UnknownRecord | null {
  if (!isRecord(input)) return null;
  const questions = normalizeLarkAskUserQuestions(input);
  const trimmedReply = reply.trim();
  if (questions.length === 0 || !trimmedReply) return null;

  const replyLines = trimmedReply.split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)、]|[-*])\s*/, "").trim())
    .filter(Boolean);
  const answers: Record<string, string> = {};
  questions.forEach((question, index) => {
    const answer = questions.length === 1 ? trimmedReply : replyLines[index];
    if (answer) answers[question.question] = answer;
  });
  if (Object.keys(answers).length === 0) return null;
  return { ...input, answers };
}

export function buildLarkAskUserQuestionOptionAnswerInput(input: unknown, answer: string): UnknownRecord | null {
  const questions = normalizeLarkAskUserQuestions(input);
  const question = questions.length === 1 && !questions[0].multiSelect ? questions[0] : undefined;
  if (!question?.options.some((option) => option.label === answer)) return null;
  return buildLarkAskUserQuestionAnsweredInput(input, answer);
}

function compactText(value: string | undefined, limit: number, fallback = "未提供"): string {
  const compact = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!compact) return fallback;
  return Array.from(compact).length <= limit
    ? compact
    : `${Array.from(compact).slice(0, Math.max(1, limit - 1)).join("")}…`;
}

function truncateText(value: string | undefined, limit: number, fallback = "未提供"): string {
  const text = value?.trim() ?? "";
  if (!text) return fallback;
  return Array.from(text).length <= limit
    ? text
    : `${Array.from(text).slice(0, Math.max(1, limit - 1)).join("")}…`;
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const ellipsisBytes = Buffer.byteLength("…", "utf8");
  if (maxBytes < ellipsisBytes) return "";
  const availableBytes = Math.max(0, maxBytes - ellipsisBytes);
  const characters: string[] = [];
  let usedBytes = 0;
  for (const character of value) {
    const characterBytes = Buffer.byteLength(character, "utf8");
    if (usedBytes + characterBytes > availableBytes) break;
    characters.push(character);
    usedBytes += characterBytes;
  }
  return `${characters.join("")}…`;
}

function limitConversationEntries(entries: LarkAgentConversationEntry[]): LarkAgentConversationEntry[] {
  const limited: LarkAgentConversationEntry[] = [];
  let remainingBytes = MAX_CONVERSATION_BYTES;

  for (const entry of entries.slice(-MAX_CONVERSATION_ENTRIES).reverse()) {
    if (remainingBytes < 64) break;
    if (entry.kind === "assistant") {
      const text = truncateUtf8(entry.text, remainingBytes);
      limited.unshift({ ...entry, text });
      remainingBytes -= Buffer.byteLength(text, "utf8");
      continue;
    }

    const title = truncateUtf8(entry.title, Math.min(remainingBytes, 480));
    const titleBytes = Buffer.byteLength(title, "utf8");
    const detailBudget = Math.max(0, remainingBytes - titleBytes);
    const detail = truncateUtf8(entry.detail, detailBudget);
    limited.unshift({ ...entry, title, detail });
    remainingBytes -= titleBytes + Buffer.byteLength(detail, "utf8");
  }

  return limited;
}

function sessionStatusLabel(snapshot: LarkWorkflowCardSnapshot): string {
  if (snapshot.permission) return "等待确认";
  if (snapshot.status === "completed") return "已完成";
  if (snapshot.status === "error") return "执行失败";
  if (snapshot.status === "idle") return "已停止";
  return "执行中";
}

function messageContentItems(message: StreamMessage): UnknownRecord[] {
  const envelope = message as unknown as UnknownRecord;
  const sdkMessage = isRecord(envelope.message) ? envelope.message : undefined;
  const content = sdkMessage?.content;
  if (!Array.isArray(content)) return [];
  return content.filter(isRecord);
}

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    Bash: "运行命令",
    Read: "读取文件",
    Write: "写入文件",
    Edit: "编辑文件",
    MultiEdit: "编辑文件",
    Glob: "查找文件",
    Grep: "搜索代码",
    WebFetch: "读取网页",
    WebSearch: "搜索网页",
    Task: "调度 Agent",
    Agent: "调度 Agent",
    Skill: "使用技能",
    ToolSearch: "查找工具",
    TaskOutput: "读取任务结果",
    "mcp__tech-cc-hub-plan__update_plan": "更新计划",
  };
  return labels[name] ?? name;
}

function compactToolPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = value.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 2) return value;
  return `…/${parts.slice(-2).join("/")}`;
}

function recordString(record: UnknownRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return undefined;
}

function toolDetail(tool: UnknownRecord): string {
  const name = asString(tool.name) ?? "工具";
  const input = isRecord(tool.input) ? tool.input : {};
  const summary = name === "Bash"
    ? recordString(input, "command")
    : name === "Read" || name === "Write" || name === "Edit" || name === "MultiEdit"
      ? compactToolPath(recordString(input, "file_path", "path"))
      : name === "Glob" || name === "Grep"
        ? [recordString(input, "pattern"), compactToolPath(recordString(input, "path"))].filter(Boolean).join(" · ")
        : name === "TaskOutput"
          ? recordString(input, "task_id", "taskId")
          : recordString(input, "description", "query", "url", "prompt");
  return summary ? `${toolLabel(name)}：${compactText(summary, 160)}` : toolLabel(name);
}

function toolGroupTitle(tools: UnknownRecord[]): string {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    const name = asString(tool.name) ?? "tool";
    const category = name === "Bash"
      ? "command"
      : name === "Read"
        ? "read"
        : name === "Write" || name === "Edit" || name === "MultiEdit"
          ? "edit"
          : name === "Glob" || name === "Grep" || name === "WebSearch" || name === "ToolSearch"
            ? "search"
            : name === "Task" || name === "Agent"
              ? "agent"
              : "other";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const phrases: string[] = [];
  const append = (key: string, format: (count: number) => string) => {
    const count = counts.get(key);
    if (!count) return;
    phrases.push(format(count));
    counts.delete(key);
  };
  append("command", (count) => `运行 ${count} 条命令`);
  append("read", (count) => `读取 ${count} 个文件`);
  append("edit", (count) => `编辑 ${count} 个文件`);
  append("search", (count) => `搜索 ${count} 次`);
  append("agent", (count) => `调度 ${count} 个 Agent`);
  append("other", (count) => `其他 ${count} 项`);
  return phrases.join("，") || "处理任务";
}

export function deriveLarkAgentConversationEntries(
  messages: StreamMessage[],
  sessionStatus: LarkWorkflowCardSessionStatus,
): LarkAgentConversationEntry[] {
  let turnStart = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.type === "user_prompt") {
      turnStart = index;
      break;
    }
  }
  const turnMessages = messages.slice(turnStart + 1);
  const toolResults = new Map<string, "completed" | "error">();

  for (const message of turnMessages) {
    for (const content of messageContentItems(message)) {
      if (content.type !== "tool_result") continue;
      const toolUseId = asString(content.tool_use_id);
      if (!toolUseId) continue;
      toolResults.set(toolUseId, content.is_error === true ? "error" : "completed");
    }
  }

  const entries: LarkAgentConversationEntry[] = [];
  const tools: UnknownRecord[] = [];
  let firstToolTurnIndex: number | undefined;
  turnMessages.forEach((message, turnIndex) => {
    if (message.type !== "assistant") return;
    const contentItems = messageContentItems(message);
    contentItems.forEach((content, contentIndex) => {
      if (content.type !== "text") return;
      const text = asString(content.text);
      if (!text) return;
      entries.push({
        id: `assistant-${turnIndex + turnStart + 1}-${contentIndex}`,
        kind: "assistant",
        text: truncateText(text, MAX_SUMMARY_CHARS),
      });
    });

    const messageTools = contentItems.filter((content) =>
      content.type === "tool_use" && !LARK_QUESTION_TOOL_NAMES.has(asString(content.name) ?? "")
    );
    if (messageTools.length === 0) return;
    firstToolTurnIndex ??= turnIndex;
    tools.push(...messageTools);
  });

  if (tools.length > 0) {
    const resultStates = tools.map((tool) => {
      const toolUseId = asString(tool.id);
      return toolUseId ? toolResults.get(toolUseId) : undefined;
    });
    const status = resultStates.includes("error")
      ? "error"
      : resultStates.every((result) => result === "completed") || sessionStatus !== "running"
        ? "completed"
        : "running";
    const uniqueDetails = [...new Set(tools.map(toolDetail))];
    const visibleDetails = uniqueDetails.slice(0, MAX_TOOL_DETAIL_ITEMS);
    const hiddenDetailCount = uniqueDetails.length - visibleDetails.length;
    const detailLines = visibleDetails.map((detail) => `• ${detail}`);
    if (hiddenDetailCount > 0) detailLines.push(`• 另有 ${hiddenDetailCount} 项操作`);
    entries.push({
      id: `tools-${(firstToolTurnIndex ?? 0) + turnStart + 1}`,
      kind: "tools",
      title: toolGroupTitle(tools),
      detail: truncateText(detailLines.join("\n"), MAX_TOOL_DETAIL_CHARS),
      status,
    });
  }

  return limitConversationEntries(entries);
}

function buildCallbackButton(options: {
  text: string;
  type: string;
  action: LarkWorkflowCardActionPayload;
  confirm?: { title: string; text: string };
  width?: "default" | "fill";
}): UnknownRecord {
  return {
    tag: "button",
    text: { tag: "plain_text", content: options.text },
    type: options.type,
    width: options.width ?? "default",
    behaviors: [{ type: "callback", value: options.action }],
    ...(options.confirm
      ? {
          confirm: {
            title: { tag: "plain_text", content: options.confirm.title },
            text: { tag: "plain_text", content: options.confirm.text },
          },
        }
      : {}),
  };
}

function buildOpenUrlButton(text: string, url: string): UnknownRecord {
  return {
    tag: "button",
    text: { tag: "plain_text", content: text },
    type: "default",
    width: "default",
    behaviors: [{ type: "open_url", default_url: url }],
  };
}

function buildButtonRow(buttons: UnknownRecord[]): UnknownRecord {
  return {
    tag: "column_set",
    flex_mode: "none",
    horizontal_spacing: "8px",
    columns: buttons.map((button) => ({
      tag: "column",
      width: "weighted",
      weight: 1,
      elements: [button],
    })),
  };
}

function buildRunActivityPanel(runs: LarkWorkflowCardRun[]): UnknownRecord {
  const visibleRuns = runs.slice(0, MAX_RUNS);
  const detail = visibleRuns.map((run) => {
    const name = compactText(run.workflowName, 60, "子任务");
    const summary = compactText(run.error ?? run.warning ?? run.summary, 180, "等待进度更新");
    return `• ${name}：${summary}`;
  }).join("\n");
  return {
    tag: "collapsible_panel",
    expanded: false,
    header: {
      title: { tag: "plain_text", content: `执行过程 · ${visibleRuns.length} 个子任务` },
    },
    elements: [{ tag: "markdown", content: detail, text_size: "notation" }],
  };
}

function buildConversationActivityPanel(entries: Extract<LarkAgentConversationEntry, { kind: "tools" }>[]): UnknownRecord {
  const title = entries.length === 1 ? entries[0].title : `${entries.length} 个阶段`;
  const detail = [...new Set(entries.map((entry) => entry.detail))].join("\n");
  return {
    tag: "collapsible_panel",
    expanded: false,
    header: {
      title: { tag: "plain_text", content: `执行过程 · ${title}` },
    },
    elements: [{ tag: "markdown", content: truncateText(detail, MAX_TOOL_DETAIL_CHARS), text_size: "notation" }],
  };
}

function actionPayload(
  snapshot: LarkWorkflowCardSnapshot,
  cardVersion: number,
  action: LarkWorkflowCardActionName,
  extra: Partial<LarkWorkflowCardActionPayload> = {},
): LarkWorkflowCardActionPayload {
  return {
    v: 1,
    action,
    sessionId: snapshot.sessionId,
    cardVersion,
    ...extra,
  };
}

function buildAskUserQuestionElements(
  snapshot: LarkWorkflowCardSnapshot & { cardVersion: number },
  permission: LarkWorkflowCardPermission,
): UnknownRecord[] {
  const questions = normalizeLarkAskUserQuestions(permission.input).slice(0, MAX_ASK_QUESTIONS);
  if (questions.length === 0) return [];

  const elements: UnknownRecord[] = [{
    tag: "markdown",
    content: `**请回答以下问题**${questions.length > 1 ? ` · ${questions.length} 题` : ""}`,
  }];
  const canAnswerWithButtons = questions.length === 1
    && !questions[0].multiSelect
    && questions[0].options.length > 0
    && questions[0].options.length <= MAX_ASK_OPTIONS;

  questions.forEach((question, questionIndex) => {
    const header = question.header ? `<font color='grey'>${compactText(question.header, 40)}</font>\n` : "";
    const multiSelectHint = question.multiSelect ? " · 多选" : "";
    elements.push({
      tag: "markdown",
      content: `${header}**${questionIndex + 1}. ${truncateText(question.question, 500)}**${multiSelectHint}`,
    });

    if (!canAnswerWithButtons && question.options.length > 0) {
      const optionLines = question.options.slice(0, MAX_ASK_OPTIONS).map((option, optionIndex) => {
        const description = option.description ? ` — ${compactText(option.description, 120)}` : "";
        return `${String.fromCharCode(65 + optionIndex)}. ${compactText(option.label, 80)}${description}`;
      });
      elements.push({ tag: "markdown", content: optionLines.join("\n"), text_size: "notation" });
    }
  });

  if (canAnswerWithButtons) {
    const buttons = questions[0].options.map((option, optionIndex) => buildCallbackButton({
      text: compactText(option.label, 40),
      type: optionIndex === 0 ? "primary_filled" : "default",
      width: "fill",
      action: actionPayload(snapshot, snapshot.cardVersion, "question_answer", {
        toolUseId: permission.toolUseId,
        answer: option.label,
      }),
    }));
    for (let index = 0; index < buttons.length; index += 2) {
      elements.push(buildButtonRow(buttons.slice(index, index + 2)));
    }
  } else {
    elements.push({
      tag: "markdown",
      content: "<font color='grey'>请直接回复这条飞书消息；多题时每行回答一题。</font>",
    });
  }

  elements.push(buildButtonRow([buildCallbackButton({
    text: "取消",
    type: "default",
    action: actionPayload(snapshot, snapshot.cardVersion, "permission_deny", {
      toolUseId: permission.toolUseId,
    }),
  })]));
  return elements;
}

export function buildLarkWorkflowCard(
  snapshot: LarkWorkflowCardSnapshot & { cardVersion: number },
): LarkCardJson {
  const elements: UnknownRecord[] = [];

  if (snapshot.prompt?.trim()) {
    const quotedPrompt = truncateText(snapshot.prompt, MAX_PROMPT_CHARS).replace(/\r?\n/g, "\n> ");
    elements.push({ tag: "markdown", content: `> ${quotedPrompt}` });
  }

  const conversation = limitConversationEntries(snapshot.conversation ?? []);
  const toolEntries = conversation.filter(
    (entry): entry is Extract<LarkAgentConversationEntry, { kind: "tools" }> => entry.kind === "tools",
  );
  const latestAssistant = [...conversation].reverse().find((entry) => entry.kind === "assistant");
  if (toolEntries.length > 0) {
    elements.push(buildConversationActivityPanel(toolEntries));
  } else if (snapshot.runs.length > 0) {
    elements.push(buildRunActivityPanel(snapshot.runs));
  }
  if (latestAssistant?.kind === "assistant") {
    elements.push({ tag: "markdown", content: latestAssistant.text });
  }

  if (snapshot.permission?.toolName === "AskUserQuestion") {
    const questionElements = buildAskUserQuestionElements(snapshot, snapshot.permission);
    if (questionElements.length > 0) {
      elements.push(...questionElements);
    } else {
      elements.push({
        tag: "markdown",
        content: "**等待回答**\n问题内容无法解析，请取消后让 Agent 重新提问。",
      });
      elements.push(buildButtonRow([buildCallbackButton({
        text: "取消",
        type: "default",
        action: actionPayload(snapshot, snapshot.cardVersion, "permission_deny", {
          toolUseId: snapshot.permission.toolUseId,
        }),
      })]));
    }
  } else if (snapshot.permission) {
    elements.push({
      tag: "markdown",
      content: `**等待确认**\n工具 **${compactText(snapshot.permission.toolName, 80)}** 请求继续执行。`,
    });
    elements.push(buildButtonRow([
      buildCallbackButton({
        text: "允许一次",
        type: "primary_filled",
        width: "fill",
        action: actionPayload(snapshot, snapshot.cardVersion, "permission_allow", {
          toolUseId: snapshot.permission.toolUseId,
        }),
      }),
      buildCallbackButton({
        text: "拒绝",
        type: "danger",
        width: "fill",
        action: actionPayload(snapshot, snapshot.cardVersion, "permission_deny", {
          toolUseId: snapshot.permission.toolUseId,
        }),
      }),
    ]));
  }

  if (snapshot.actionNotice?.trim()) {
    elements.push({ tag: "markdown", content: `<font color='grey'>${compactText(snapshot.actionNotice, 300)}</font>` });
  }

  const terminalText = snapshot.error?.trim() || snapshot.assistantSummary?.trim();
  const terminalAlreadyShown = conversation.some((entry) =>
    entry.kind === "assistant" && entry.text === truncateText(terminalText, MAX_SUMMARY_CHARS)
  );
  if (terminalText && !terminalAlreadyShown) {
    elements.push({ tag: "markdown", content: truncateText(terminalText, MAX_SUMMARY_CHARS) });
  }

  if (snapshot.status === "running" && !snapshot.permission) {
    elements.push({
      tag: "markdown",
      content: "<font color='blue'>正在执行…</font>",
    });
  } else if (snapshot.status === "error" && snapshot.error) {
    elements.push({ tag: "markdown", content: "<font color='red'>执行遇到问题</font>" });
  } else if (snapshot.status === "idle") {
    elements.push({ tag: "markdown", content: "<font color='grey'>已停止</font>" });
  }

  const actionButtons: UnknownRecord[] = [];
  if (snapshot.status === "running" && !snapshot.permission) {
    actionButtons.push(buildCallbackButton({
      text: "停止",
      type: "default",
      action: actionPayload(snapshot, snapshot.cardVersion, "stop_session"),
      confirm: { title: "停止当前任务？", text: "Agent 将停止当前处理。" },
    }));
  }

  if (snapshot.status === "error" || snapshot.status === "idle") {
    const resumable = snapshot.runs.find((run) => run.canResume && run.workflowRunId);
    if (resumable?.workflowRunId) {
      actionButtons.push(buildCallbackButton({
        text: "继续执行",
        type: "primary_filled",
        action: actionPayload(snapshot, snapshot.cardVersion, "resume_run", {
          workflowRunId: resumable.workflowRunId,
        }),
      }));
    }
    const recoverable = snapshot.runs.find((run) => run.canRerun && run.workflowRunId);
    if (recoverable?.workflowRunId) {
      actionButtons.push(buildCallbackButton({
        text: "重新执行",
        type: resumable ? "default" : "primary_filled",
        action: actionPayload(snapshot, snapshot.cardVersion, "rerun_run", {
          workflowRunId: recoverable.workflowRunId,
        }),
      }));
    }
  }

  if (snapshot.status === "completed") {
    for (const run of snapshot.runs.filter((item) => item.sessionUrl).slice(0, 2)) {
      actionButtons.push(buildOpenUrlButton("查看交付", run.sessionUrl as string));
    }
  }

  if (actionButtons.length > 0) elements.push(buildButtonRow(actionButtons));

  const title = compactText(snapshot.title, MAX_TITLE_CHARS, "AI 流程执行");
  const statusLabel = sessionStatusLabel(snapshot);
  return {
    schema: "2.0",
    config: {
      update_multi: true,
      enable_forward: false,
      width_mode: "default",
      summary: { content: `${title} · ${statusLabel}` },
    },
    body: {
      direction: "vertical",
      padding: "12px 16px 12px 16px",
      vertical_spacing: "6px",
      elements,
    },
  };
}

export function buildLarkCliWorkflowCardSendArgs(
  target: ChannelReplyTarget,
  card: LarkCardJson,
  idempotencyKey: string,
): string[] {
  return [
    "im",
    "+messages-send",
    "--chat-id",
    target.rawConversationId,
    "--msg-type",
    "interactive",
    "--content",
    JSON.stringify(card),
    "--as",
    "bot",
    "--idempotency-key",
    idempotencyKey,
    "--json",
  ];
}

export function buildLarkWorkflowCardSendBody(
  target: ChannelReplyTarget,
  card: LarkCardJson,
  idempotencyKey: string,
): UnknownRecord {
  return {
    receive_id: target.rawConversationId,
    msg_type: "interactive",
    content: JSON.stringify(card),
    uuid: idempotencyKey,
  };
}

function buildLarkCliDataFileReference(dataFilePath: string): string {
  const normalizedPath = dataFilePath.trim();
  if (
    !normalizedPath
    || isAbsolute(normalizedPath)
    || normalizedPath === "~"
    || normalizedPath.startsWith("~/")
    || normalizedPath.startsWith("~\\")
  ) {
    throw new Error("Lark CLI --data files must use a non-empty relative path inside the command cwd");
  }
  return `@${normalizedPath}`;
}

export function buildLarkCliWorkflowCardSendFileArgs(dataFilePath: string): string[] {
  return [
    "api",
    "POST",
    "/open-apis/im/v1/messages",
    "--params",
    JSON.stringify({ receive_id_type: "chat_id" }),
    "--data",
    buildLarkCliDataFileReference(dataFilePath),
    "--as",
    "bot",
    "--json",
  ];
}

export function buildLarkCliCardPatchArgs(messageId: string, card: LarkCardJson): string[] {
  return [
    "api",
    "PATCH",
    `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}`,
    "--data",
    JSON.stringify({ content: JSON.stringify(card) }),
    "--as",
    "bot",
    "--json",
  ];
}

export function buildLarkCliCardPatchFileArgs(messageId: string, dataFilePath: string): string[] {
  return [
    "api",
    "PATCH",
    `/open-apis/im/v1/messages/${encodeURIComponent(messageId)}`,
    "--data",
    buildLarkCliDataFileReference(dataFilePath),
    "--as",
    "bot",
    "--json",
  ];
}

export function buildLarkCliDelayedCardUpdateArgs(token: string, card: LarkCardJson): string[] {
  return [
    "api",
    "POST",
    "/open-apis/interactive/v1/card/update",
    "--data",
    JSON.stringify({ token, card }),
    "--as",
    "bot",
    "--json",
  ];
}

export function buildLarkCliDelayedCardUpdateFileArgs(dataFilePath: string): string[] {
  return [
    "api",
    "POST",
    "/open-apis/interactive/v1/card/update",
    "--data",
    buildLarkCliDataFileReference(dataFilePath),
    "--as",
    "bot",
    "--json",
  ];
}

function findStringField(value: unknown, field: string): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringField(item, field);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const direct = asString(value[field]);
  if (direct) return direct;
  for (const nested of Object.values(value)) {
    const found = findStringField(nested, field);
    if (found) return found;
  }
  return undefined;
}

export function parseLarkWorkflowCardSendResponse(raw: string): LarkWorkflowCardSendResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Lark workflow card response was not valid JSON");
  }
  if (isRecord(value) && value.ok === false) {
    const error = isRecord(value.error) ? asString(value.error.message) : undefined;
    throw new Error(error ?? "Lark workflow card send failed");
  }
  const messageId = findStringField(value, "message_id");
  if (!messageId) throw new Error("Lark workflow card response did not include message_id");
  return { messageId, chatId: findStringField(value, "chat_id") };
}

function parseActionPayload(value: unknown): LarkWorkflowCardActionPayload | null {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed) || parsed.v !== 1) return null;
  const action = asString(parsed.action) as LarkWorkflowCardActionName | undefined;
  const sessionId = asString(parsed.sessionId);
  const cardVersion = asPositiveInteger(parsed.cardVersion);
  const allowedActions: LarkWorkflowCardActionName[] = [
    "stop_session",
    "stop_task",
    "permission_allow",
    "permission_deny",
    "question_answer",
    "resume_run",
    "rerun_run",
  ];
  if (!action || !allowedActions.includes(action) || !sessionId || !cardVersion) return null;

  const taskId = asString(parsed.taskId);
  const workflowRunId = asString(parsed.workflowRunId);
  const toolUseId = asString(parsed.toolUseId);
  const answer = asString(parsed.answer);
  const payload: LarkWorkflowCardActionPayload = {
    v: 1,
    action,
    sessionId,
    cardVersion,
    ...(taskId ? { taskId } : {}),
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(toolUseId ? { toolUseId } : {}),
    ...(answer ? { answer } : {}),
  };
  if (action === "stop_task" && !payload.taskId) return null;
  if ((action === "permission_allow" || action === "permission_deny") && !payload.toolUseId) return null;
  if (action === "question_answer" && (!payload.toolUseId || !payload.answer)) return null;
  if ((action === "resume_run" || action === "rerun_run") && !payload.workflowRunId) return null;
  return payload;
}

export function normalizeLarkCardActionEvent(value: unknown): LarkCardActionEvent | null {
  if (!isRecord(value) || value.type !== "card.action.trigger") return null;
  if (asString(value.action_tag) !== "button") return null;
  const eventId = asString(value.event_id);
  const operatorId = asString(value.operator_id);
  const messageId = asString(value.message_id);
  const chatId = asString(value.chat_id);
  const callbackToken = asString(value.token);
  const action = parseActionPayload(value.action_value);
  if (!eventId || !operatorId || !messageId || !chatId || !callbackToken || !action) return null;
  const timestampRaw = asString(value.timestamp);
  const timestamp = timestampRaw ? Number(timestampRaw) : undefined;
  return {
    eventId,
    operatorId,
    messageId,
    chatId,
    callbackToken,
    timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
    action,
  };
}

export function createLarkWorkflowCardCoordinator(delivery: LarkWorkflowCardDelivery) {
  const states = new Map<string, LarkWorkflowCardCoordinatorState>();
  const acceptedEventIds = new Set<string>();

  function turnKey(target: ChannelReplyTarget, snapshot: LarkWorkflowCardSnapshot): string {
    return target.externalMessageId?.trim() || snapshot.sessionId;
  }

  async function finalizePreviousTurn(state: LarkWorkflowCardCoordinatorState): Promise<void> {
    const snapshot = state.snapshot;
    if (!state.messageId || !snapshot || (snapshot.status !== "running" && !snapshot.permission)) return;

    const version = state.version + 1;
    const finalizedSnapshot: LarkWorkflowCardSnapshot = {
      ...snapshot,
      status: "completed",
      updatedAt: Date.now(),
      permission: undefined,
      actionNotice: undefined,
    };
    await delivery.update(
      state.messageId,
      buildLarkWorkflowCard({ ...finalizedSnapshot, cardVersion: version }),
    );
    state.version = version;
    state.signature = JSON.stringify({ ...finalizedSnapshot, updatedAt: 0 });
    state.snapshot = finalizedSnapshot;
  }

  function rememberEventId(eventId: string): boolean {
    if (acceptedEventIds.has(eventId)) return false;
    acceptedEventIds.add(eventId);
    if (acceptedEventIds.size > MAX_ACTION_EVENT_IDS) {
      const oldest = acceptedEventIds.values().next().value as string | undefined;
      if (oldest) acceptedEventIds.delete(oldest);
    }
    return true;
  }

  return {
    sync: async (target: ChannelReplyTarget, snapshot: LarkWorkflowCardSnapshot): Promise<void> => {
      const nextTurnKey = turnKey(target, snapshot);
      let state = states.get(snapshot.sessionId);
      if (!state || state.turnKey !== nextTurnKey) {
        const previousState = state;
        const transition = previousState
          ? previousState.queue.catch(() => undefined).then(() => finalizePreviousTurn(previousState))
          : Promise.resolve();
        state = { target, turnKey: nextTurnKey, version: 0, queue: transition };
        states.set(snapshot.sessionId, state);
      } else {
        state.target = target;
      }
      const currentState = state;
      const signature = JSON.stringify({ ...snapshot, updatedAt: 0 });
      const operation = currentState.queue.catch(() => undefined).then(async () => {
        if (currentState.signature === signature) return;
        const version = currentState.version + 1;
        const card = buildLarkWorkflowCard({ ...snapshot, cardVersion: version });
        if (currentState.messageId) {
          await delivery.update(currentState.messageId, card);
        } else {
          const digest = createHash("sha256")
            .update([target.rawConversationId, snapshot.sessionId, currentState.turnKey].join("\0"))
            .digest("hex")
            .slice(0, 32);
          const result = await delivery.send(target, card, `techcc-card-${digest}`);
          currentState.messageId = result.messageId;
        }
        currentState.version = version;
        currentState.signature = signature;
        currentState.snapshot = snapshot;
      });
      currentState.queue = operation;
      await operation;
    },
    getState: (sessionId: string): LarkWorkflowCardPublicState | undefined => {
      const state = states.get(sessionId);
      return state
        ? { target: state.target, messageId: state.messageId, version: state.version }
        : undefined;
    },
    forget: (sessionId: string): void => {
      states.delete(sessionId);
    },
    acceptAction: (
      event: LarkCardActionEvent,
    ): { ok: true } | { ok: false; reason: LarkWorkflowCardActionRejection } => {
      if (!rememberEventId(event.eventId)) return { ok: false, reason: "duplicate" };
      const state = states.get(event.action.sessionId);
      if (!state) return { ok: false, reason: "unknown_session" };
      if (state.target.senderId && event.operatorId !== state.target.senderId) {
        return { ok: false, reason: "foreign_operator" };
      }
      if (state.target.rawConversationId !== event.chatId) return { ok: false, reason: "foreign_chat" };
      if (!state.messageId || state.messageId !== event.messageId) return { ok: false, reason: "foreign_message" };
      if (state.version !== event.action.cardVersion) return { ok: false, reason: "stale" };
      return { ok: true };
    },
  };
}
