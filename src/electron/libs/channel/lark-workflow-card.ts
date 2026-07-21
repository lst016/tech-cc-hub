import { createHash } from "node:crypto";
import { isAbsolute } from "node:path";

import type { WorkflowRunStatus } from "../../../shared/workflows/workflow-runs.js";
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
};

export type LarkWorkflowCardActionName =
  | "stop_session"
  | "stop_task"
  | "permission_allow"
  | "permission_deny"
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
  header: {
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
  messageId?: string;
  version: number;
  signature?: string;
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
const MAX_ACTION_EVENT_IDS = 2_000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function compactText(value: string | undefined, limit: number, fallback = "未提供"): string {
  const compact = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!compact) return fallback;
  return Array.from(compact).length <= limit
    ? compact
    : `${Array.from(compact).slice(0, Math.max(1, limit - 1)).join("")}…`;
}

function formatUpdatedAt(value: number): string {
  if (!Number.isFinite(value)) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function statusPresentation(snapshot: LarkWorkflowCardSnapshot): {
  label: string;
  template: string;
  tagColor: string;
  accent: string;
} {
  if (snapshot.permission) {
    return { label: "等待确认", template: "yellow", tagColor: "yellow", accent: "orange" };
  }

  if (snapshot.status === "completed") {
    return { label: "已完成", template: "green", tagColor: "green", accent: "green" };
  }
  if (snapshot.status === "error") {
    return { label: "执行失败", template: "red", tagColor: "red", accent: "red" };
  }
  if (snapshot.status === "idle") {
    return { label: "已停止", template: "grey", tagColor: "grey", accent: "grey" };
  }
  return { label: "执行中", template: "blue", tagColor: "blue", accent: "blue" };
}

function runPresentation(status: WorkflowRunStatus): { label: string; color: string } {
  if (status === "completed") return { label: "已完成", color: "green" };
  if (status === "failed") return { label: "失败", color: "red" };
  if (status === "killed") return { label: "已停止", color: "grey" };
  if (status === "backgrounded") return { label: "后台运行", color: "blue" };
  if (status === "launching") return { label: "启动中", color: "blue" };
  if (status === "running") return { label: "执行中", color: "blue" };
  return { label: "状态未知", color: "grey" };
}

function buildCallbackButton(options: {
  text: string;
  type: string;
  action: LarkWorkflowCardActionPayload;
  confirm?: { title: string; text: string };
}): UnknownRecord {
  return {
    tag: "button",
    text: { tag: "plain_text", content: options.text },
    type: options.type,
    width: "fill",
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
    width: "fill",
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

function buildMetricColumn(value: string, label: string, color: string): UnknownRecord {
  return {
    tag: "column",
    width: "weighted",
    weight: 1,
    background_style: `${color}-50`,
    padding: "12px",
    vertical_spacing: "2px",
    elements: [
      { tag: "markdown", content: `**<font color='${color}'>${value}</font>**`, text_align: "center" },
      { tag: "markdown", content: `<font color='grey'>${label}</font>`, text_align: "center", text_size: "notation" },
    ],
  };
}

function buildRunBlock(run: LarkWorkflowCardRun): UnknownRecord {
  const presentation = runPresentation(run.status);
  const name = compactText(run.workflowName, 80, "子任务");
  const detail = compactText(run.error ?? run.warning ?? run.summary, 500, "等待进度更新");
  return {
    tag: "column_set",
    flex_mode: "none",
    margin: "0px",
    columns: [{
      tag: "column",
      width: "weighted",
      weight: 1,
      background_style: `${presentation.color}-50`,
      padding: "12px",
      vertical_spacing: "4px",
      elements: [
        { tag: "markdown", content: `**<font color='${presentation.color}'>${name}</font>**  <text_tag color='${presentation.color}'>${presentation.label}</text_tag>` },
        { tag: "markdown", content: detail, text_size: "notation" },
      ],
    }],
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

export function buildLarkWorkflowCard(
  snapshot: LarkWorkflowCardSnapshot & { cardVersion: number },
): LarkCardJson {
  const presentation = statusPresentation(snapshot);
  const runningCount = snapshot.runs.filter((run) =>
    run.status === "running" || run.status === "launching" || run.status === "backgrounded"
  ).length;
  const completedCount = snapshot.runs.filter((run) => run.status === "completed").length;
  const elements: UnknownRecord[] = [
    {
      tag: "column_set",
      flex_mode: "none",
      horizontal_spacing: "8px",
      columns: [
        buildMetricColumn(presentation.label, "当前状态", presentation.accent),
        buildMetricColumn(`${completedCount}/${snapshot.runs.length}`, "子任务完成", presentation.accent),
        buildMetricColumn(formatUpdatedAt(snapshot.updatedAt), "最近更新", "grey"),
      ],
    },
  ];

  if (snapshot.prompt?.trim()) {
    elements.push({
      tag: "column_set",
      flex_mode: "none",
      columns: [{
        tag: "column",
        width: "weighted",
        weight: 1,
        background_style: "grey-50",
        padding: "12px",
        vertical_spacing: "4px",
        elements: [
          { tag: "markdown", content: "**任务目标**" },
          { tag: "markdown", content: compactText(snapshot.prompt, MAX_PROMPT_CHARS) },
        ],
      }],
    });
  }

  const visibleRuns = snapshot.runs.slice(0, MAX_RUNS);
  if (visibleRuns.length > 0) {
    elements.push({ tag: "markdown", content: `**执行进度**  <font color='grey'>${runningCount} 个运行中</font>` });
    elements.push(...visibleRuns.map(buildRunBlock));
  }

  if (snapshot.permission) {
    elements.push({
      tag: "column_set",
      flex_mode: "none",
      columns: [{
        tag: "column",
        width: "weighted",
        weight: 1,
        background_style: "yellow-50",
        padding: "12px",
        vertical_spacing: "4px",
        elements: [
          { tag: "markdown", content: "**需要你的确认**" },
          {
            tag: "markdown",
            content: `工具 **${compactText(snapshot.permission.toolName, 80)}** 请求继续执行。为避免泄露凭据，卡片不展示原始参数。`,
          },
        ],
      }],
    });
    elements.push(buildButtonRow([
      buildCallbackButton({
        text: "允许一次",
        type: "primary_filled",
        action: actionPayload(snapshot, snapshot.cardVersion, "permission_allow", {
          toolUseId: snapshot.permission.toolUseId,
        }),
      }),
      buildCallbackButton({
        text: "拒绝",
        type: "danger",
        action: actionPayload(snapshot, snapshot.cardVersion, "permission_deny", {
          toolUseId: snapshot.permission.toolUseId,
        }),
      }),
    ]));
  }

  if (snapshot.actionNotice?.trim()) {
    elements.push({
      tag: "column_set",
      flex_mode: "none",
      columns: [{
        tag: "column",
        width: "weighted",
        weight: 1,
        background_style: "blue-50",
        padding: "12px",
        elements: [{ tag: "markdown", content: `**操作已受理**\n${compactText(snapshot.actionNotice, 300)}` }],
      }],
    });
  }

  const terminalText = snapshot.error?.trim() || snapshot.assistantSummary?.trim();
  if (terminalText) {
    elements.push({
      tag: "collapsible_panel",
      expanded: snapshot.status !== "completed",
      background_color: snapshot.status === "error" ? "red-50" : "green-50",
      border: { color: snapshot.status === "error" ? "red-100" : "green-100", corner_radius: "8px" },
      padding: "12px",
      header: {
        title: {
          tag: "plain_text",
          content: snapshot.status === "error" ? "失败原因" : "交付摘要",
        },
      },
      elements: [{ tag: "markdown", content: compactText(terminalText, MAX_SUMMARY_CHARS) }],
    });
  }

  const actionButtons: UnknownRecord[] = [];
  if (snapshot.status === "running" && !snapshot.permission) {
    const activeRun = snapshot.runs.find((run) =>
      run.status === "running" || run.status === "launching" || run.status === "backgrounded"
    );
    if (activeRun) {
      actionButtons.push(buildCallbackButton({
        text: "停止此任务",
        type: "danger",
        action: actionPayload(snapshot, snapshot.cardVersion, "stop_task", { taskId: activeRun.taskId }),
        confirm: { title: "停止此任务？", text: "该子任务会停止，其他流程状态仍会保留。" },
      }));
    }
    actionButtons.push(buildCallbackButton({
      text: "停止流程",
      type: "danger_filled",
      action: actionPayload(snapshot, snapshot.cardVersion, "stop_session"),
      confirm: { title: "停止整个流程？", text: "当前会话和仍在运行的子任务将被终止。" },
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
  return {
    schema: "2.0",
    config: {
      update_multi: true,
      enable_forward: false,
      width_mode: "default",
      summary: { content: `${title} · ${presentation.label}` },
    },
    header: {
      title: { tag: "plain_text", content: title },
      subtitle: { tag: "plain_text", content: `Tech CC · ${formatUpdatedAt(snapshot.updatedAt)}` },
      template: presentation.template,
      icon: { tag: "standard_icon", token: "myai_colorful" },
      text_tag_list: [{
        tag: "text_tag",
        text: { tag: "plain_text", content: presentation.label },
        color: presentation.tagColor,
      }],
    },
    body: {
      direction: "vertical",
      padding: "12px 12px 20px 12px",
      vertical_spacing: "12px",
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
    "resume_run",
    "rerun_run",
  ];
  if (!action || !allowedActions.includes(action) || !sessionId || !cardVersion) return null;

  const taskId = asString(parsed.taskId);
  const workflowRunId = asString(parsed.workflowRunId);
  const toolUseId = asString(parsed.toolUseId);
  const payload: LarkWorkflowCardActionPayload = {
    v: 1,
    action,
    sessionId,
    cardVersion,
    ...(taskId ? { taskId } : {}),
    ...(workflowRunId ? { workflowRunId } : {}),
    ...(toolUseId ? { toolUseId } : {}),
  };
  if (action === "stop_task" && !payload.taskId) return null;
  if ((action === "permission_allow" || action === "permission_deny") && !payload.toolUseId) return null;
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
      let state = states.get(snapshot.sessionId);
      if (!state) {
        state = { target, version: 0, queue: Promise.resolve() };
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
            .update([target.rawConversationId, snapshot.sessionId].join("\0"))
            .digest("hex")
            .slice(0, 32);
          const result = await delivery.send(target, card, `techcc-card-${digest}`);
          currentState.messageId = result.messageId;
        }
        currentState.version = version;
        currentState.signature = signature;
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
