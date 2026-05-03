import { app } from "electron";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

export type ChannelProviderId =
  | "telegram"
  | "lark"
  | "dingtalk"
  | "wechat"
  | "wecom"
  | "slack"
  | "discord";

export type ChannelInboundMessage = {
  provider: ChannelProviderId;
  text: string;
  externalConversationId?: string;
  externalMessageId?: string;
  senderId?: string;
  senderName?: string;
  channelName?: string;
  title?: string;
  receivedAt?: number;
};

export type ChannelWorkspace = {
  root: string;
  provider: ChannelProviderId;
  conversationId: string;
  label: string;
};

export type ChannelReplyTarget = {
  provider: ChannelProviderId;
  conversationId: string;
  rawConversationId: string;
  senderId?: string;
  senderName?: string;
  channelName?: string;
  workspaceRoot: string;
};

const CHANNEL_LABELS: Record<ChannelProviderId, string> = {
  telegram: "Telegram",
  lark: "飞书",
  dingtalk: "钉钉",
  wechat: "微信",
  wecom: "企业微信",
  slack: "Slack",
  discord: "Discord",
};

function sanitizePathSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/:\0]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/g, "")
    .slice(0, 80);

  return normalized || "default";
}

function getChannelConversationId(message: ChannelInboundMessage): string {
  return sanitizePathSegment(
    message.externalConversationId?.trim()
      || message.channelName?.trim()
      || message.senderId?.trim()
      || "default",
  );
}

function buildReadme(workspace: ChannelWorkspace): string {
  return [
    `# ${workspace.label}`,
    "",
    "这是 tech-cc-hub 自动创建的渠道会话工作区。",
    "",
    `- 渠道：${CHANNEL_LABELS[workspace.provider]}`,
    `- Conversation：${workspace.conversationId}`,
    "- 原始消息日志：`.channel/messages.jsonl`",
    "",
    "通过 Telegram、飞书/Lark、lark-cli 或其他渠道进入的聊天会使用这里作为 cwd，因此左侧工作区和右侧预览都能看到同一份记录。",
  ].join("\n");
}

export function getChannelsRoot(): string {
  return join(app.getPath("userData"), "channels");
}

export function ensureChannelWorkspace(message: ChannelInboundMessage): ChannelWorkspace {
  const provider = message.provider;
  const conversationId = getChannelConversationId(message);
  const root = join(getChannelsRoot(), sanitizePathSegment(provider), conversationId);
  const label = `${CHANNEL_LABELS[provider]} · ${message.channelName?.trim() || message.senderName?.trim() || conversationId}`;
  const workspace: ChannelWorkspace = { root, provider, conversationId, label };

  mkdirSync(join(root, ".channel"), { recursive: true });

  const readmePath = join(root, "README.md");
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, buildReadme(workspace), "utf8");
  }

  return workspace;
}

export function recordChannelInboundMessage(workspace: ChannelWorkspace, message: ChannelInboundMessage): void {
  const payload = {
    direction: "inbound",
    provider: workspace.provider,
    conversationId: workspace.conversationId,
    externalMessageId: message.externalMessageId,
    senderId: message.senderId,
    senderName: message.senderName,
    channelName: message.channelName,
    text: message.text,
    receivedAt: message.receivedAt ?? Date.now(),
  };
  appendFileSync(join(workspace.root, ".channel", "messages.jsonl"), `${JSON.stringify(payload)}\n`, "utf8");
}

export function recordChannelOutboundMessage(workspaceRoot: string, target: ChannelReplyTarget, text: string): void {
  const payload = {
    direction: "outbound",
    provider: target.provider,
    conversationId: target.conversationId,
    rawConversationId: target.rawConversationId,
    text,
    sentAt: Date.now(),
  };
  appendFileSync(join(workspaceRoot, ".channel", "messages.jsonl"), `${JSON.stringify(payload)}\n`, "utf8");
}

export function buildChannelSessionTitle(message: ChannelInboundMessage, workspace: ChannelWorkspace): string {
  if (message.title?.trim()) {
    return message.title.trim();
  }

  const source = message.channelName?.trim() || message.senderName?.trim() || workspace.conversationId;
  const compactText = message.text.replace(/\s+/g, " ").trim();
  const preview = compactText ? `：${compactText.slice(0, 16)}` : "";
  return `${CHANNEL_LABELS[workspace.provider]} · ${source}${preview}`;
}

export function buildChannelReplyTarget(message: ChannelInboundMessage, workspace: ChannelWorkspace): ChannelReplyTarget {
  return {
    provider: workspace.provider,
    conversationId: workspace.conversationId,
    rawConversationId: message.externalConversationId?.trim() || message.channelName?.trim() || message.senderId?.trim() || workspace.conversationId,
    senderId: message.senderId,
    senderName: message.senderName,
    channelName: message.channelName,
    workspaceRoot: workspace.root,
  };
}
