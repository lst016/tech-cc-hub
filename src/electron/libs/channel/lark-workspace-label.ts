import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

type UnknownRecord = Record<string, unknown>;

export type LarkWorkspaceConversation = {
  conversationId: string;
  senderId?: string;
  senderName?: string;
  channelName?: string;
};

export type LarkWorkspaceLabelCliConfig = {
  command: string;
  runtimeEnv: NodeJS.ProcessEnv;
};

export type LarkWorkspaceLabelCliInvoker = (
  command: string,
  args: string[],
  runtimeEnv: NodeJS.ProcessEnv,
) => Promise<{ stdout: string; stderr: string }>;

export type ChannelWorkspaceDisplayNameDependencies = {
  now?: () => number;
  resolveLarkLabel?: (conversation: LarkWorkspaceConversation) => Promise<string | undefined>;
};

type LarkChatDetails = {
  name?: string;
  chatMode?: string;
  ownerId?: string;
};

type CachedWorkspaceLabel = {
  label: string;
  resolvedAt: number;
};

const LARK_WORKSPACE_LABEL_CACHE_FILE = "workspace-label.json";
const LARK_WORKSPACE_LABEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LARK_WORKSPACE_LABEL_TIMEOUT_MS = 8_000;
const MAX_WORKSPACE_LABEL_REQUESTS = 200;
const LARK_WORKSPACE_LABEL_CONCURRENCY = 4;
const GENERIC_LARK_CHAT_NAMES = new Set(["chat", "group", "p2p"]);
const pendingWorkspaceLabels = new Map<string, Promise<string | undefined>>();

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseJsonRecord(raw: string): UnknownRecord {
  const normalized = raw.trim();
  const jsonStart = normalized.indexOf("{");
  const jsonEnd = normalized.lastIndexOf("}");
  for (const candidate of [
    normalized,
    jsonStart >= 0 && jsonEnd > jsonStart ? normalized.slice(jsonStart, jsonEnd + 1) : "",
  ]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (isRecord(parsed)) return parsed;
    } catch {
      // Try an object embedded after CLI informational output next.
    }
  }
  throw new Error("Lark CLI returned an invalid workspace label response.");
}

export function parseLarkChatDetails(raw: string): LarkChatDetails {
  const payload = parseJsonRecord(raw);
  if (payload.ok !== true) throw new Error("Lark chat lookup failed.");
  const data = isRecord(payload.data) ? payload.data : {};
  const i18nNames = isRecord(data.i18n_names) ? data.i18n_names : {};
  return {
    name: asText(data.name) ?? asText(i18nNames.zh_cn) ?? asText(i18nNames.en_us),
    chatMode: asText(data.chat_mode),
    ownerId: asText(data.owner_id),
  };
}

export function parseLarkUserName(raw: string): string | undefined {
  const payload = parseJsonRecord(raw);
  if (payload.ok !== true) throw new Error("Lark user lookup failed.");
  const data = isRecord(payload.data) ? payload.data : {};
  const user = isRecord(data.user) ? data.user : {};
  const i18nName = isRecord(user.i18n_name) ? user.i18n_name : {};
  return asText(user.name) ?? asText(i18nName.zh_cn) ?? asText(i18nName.en_us);
}

function formatLarkWorkspaceLabel(name: string | undefined): string | undefined {
  const normalized = name?.trim();
  return normalized ? `飞书-${normalized}` : undefined;
}

function getNonGenericChannelName(channelName: string | undefined): string | undefined {
  const normalized = channelName?.trim();
  if (!normalized || GENERIC_LARK_CHAT_NAMES.has(normalized.toLowerCase())) return undefined;
  return normalized;
}

export async function resolveLarkConversationDisplayNameWithCli(
  conversation: LarkWorkspaceConversation,
  config: LarkWorkspaceLabelCliConfig,
  invoke: LarkWorkspaceLabelCliInvoker,
): Promise<string | undefined> {
  let chatDetails: LarkChatDetails | undefined;
  for (const identity of ["user", "bot"] as const) {
    try {
      const { stdout } = await invoke(config.command, [
        "im",
        "chats",
        "get",
        "--chat-id",
        conversation.conversationId,
        "--as",
        identity,
        "--format",
        "json",
      ], config.runtimeEnv);
      chatDetails = parseLarkChatDetails(stdout);
      break;
    } catch {
      // User and bot identities have different visibility; try the other identity.
    }
  }

  const chatLabel = formatLarkWorkspaceLabel(chatDetails?.name);
  if (chatLabel) return chatLabel;

  const senderLabel = formatLarkWorkspaceLabel(conversation.senderName);
  if (senderLabel) return senderLabel;

  const chatMode = chatDetails?.chatMode?.toLowerCase() ?? conversation.channelName?.toLowerCase();
  const userId = conversation.senderId ?? chatDetails?.ownerId;
  if (userId && chatMode !== "group") {
    try {
      const { stdout } = await invoke(config.command, [
        "contact",
        "+get-user",
        "--user-id",
        userId,
      ], config.runtimeEnv);
      const userLabel = formatLarkWorkspaceLabel(parseLarkUserName(stdout));
      if (userLabel) return userLabel;
    } catch {
      // Contact visibility is optional; keep the stable workspace ID as the fallback.
    }
  }

  return formatLarkWorkspaceLabel(getNonGenericChannelName(conversation.channelName));
}

function getLarkWorkspaceRoot(workspaceRoot: string, channelsRoot: string): string | undefined {
  const requestedLarkRoot = resolve(channelsRoot, "lark");
  const requestedWorkspaceRoot = resolve(workspaceRoot);
  if (!existsSync(requestedLarkRoot) || !existsSync(requestedWorkspaceRoot)) return undefined;

  let larkRoot: string;
  let absoluteWorkspaceRoot: string;
  try {
    larkRoot = realpathSync(requestedLarkRoot);
    absoluteWorkspaceRoot = realpathSync(requestedWorkspaceRoot);
  } catch {
    return undefined;
  }
  const relativeWorkspaceRoot = relative(larkRoot, absoluteWorkspaceRoot);
  if (
    !relativeWorkspaceRoot
    || relativeWorkspaceRoot === ".."
    || relativeWorkspaceRoot.startsWith(`..${sep}`)
    || isAbsolute(relativeWorkspaceRoot)
    || relativeWorkspaceRoot.includes(sep)
  ) {
    return undefined;
  }
  return absoluteWorkspaceRoot;
}

function readLastInboundConversation(workspaceRoot: string): LarkWorkspaceConversation {
  const conversationId = basename(workspaceRoot);
  const messagesPath = join(workspaceRoot, ".channel", "messages.jsonl");
  if (!existsSync(messagesPath)) return { conversationId };

  try {
    const lines = readFileSync(messagesPath, "utf8").split(/\r?\n/);
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index]?.trim();
      if (!line) continue;
      const value = JSON.parse(line) as unknown;
      if (!isRecord(value) || value.direction !== "inbound" || value.provider !== "lark") continue;
      return {
        conversationId: asText(value.conversationId) ?? conversationId,
        senderId: asText(value.senderId),
        senderName: asText(value.senderName),
        channelName: asText(value.channelName),
      };
    }
  } catch {
    // A missing or partially written log must not break sidebar rendering.
  }
  return { conversationId };
}

function readCachedWorkspaceLabel(workspaceRoot: string): CachedWorkspaceLabel | undefined {
  const cachePath = join(workspaceRoot, ".channel", LARK_WORKSPACE_LABEL_CACHE_FILE);
  if (!existsSync(cachePath)) return undefined;
  try {
    const value = JSON.parse(readFileSync(cachePath, "utf8")) as unknown;
    if (!isRecord(value)) return undefined;
    const label = asText(value.label);
    const resolvedAt = typeof value.resolvedAt === "number" ? value.resolvedAt : Number.NaN;
    return label && Number.isFinite(resolvedAt) ? { label, resolvedAt } : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedWorkspaceLabel(workspaceRoot: string, label: string, resolvedAt: number): void {
  try {
    writeFileSync(
      join(workspaceRoot, ".channel", LARK_WORKSPACE_LABEL_CACHE_FILE),
      `${JSON.stringify({ label, resolvedAt }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // The resolved label is still useful for the current render if persistence fails.
  }
}

async function resolveDefaultCliConfig(): Promise<LarkWorkspaceLabelCliConfig> {
  const { getGlobalRuntimeEnvConfig } = await import("../claude/claude-settings.js");
  return {
    command: "lark-cli",
    runtimeEnv: getGlobalRuntimeEnvConfig(),
  };
}

async function invokeDefaultCli(
  command: string,
  args: string[],
  runtimeEnv: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  const { runExternalCli } = await import("../external-cli.js");
  return runExternalCli(command, args, {
    timeout: LARK_WORKSPACE_LABEL_TIMEOUT_MS,
    env: {
      ...process.env,
      ...runtimeEnv,
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
    },
  });
}

async function resolveWorkspaceLabel(
  workspaceRoot: string,
  now: number,
  resolveLabel: (conversation: LarkWorkspaceConversation) => Promise<string | undefined>,
): Promise<string | undefined> {
  const cached = readCachedWorkspaceLabel(workspaceRoot);
  if (cached && now - cached.resolvedAt < LARK_WORKSPACE_LABEL_CACHE_TTL_MS) return cached.label;

  const pending = pendingWorkspaceLabels.get(workspaceRoot);
  if (pending) return pending;

  const resolution = resolveLabel(readLastInboundConversation(workspaceRoot))
    .then((label) => {
      if (label) writeCachedWorkspaceLabel(workspaceRoot, label, now);
      return label ?? cached?.label;
    })
    .catch(() => cached?.label)
    .finally(() => pendingWorkspaceLabels.delete(workspaceRoot));
  pendingWorkspaceLabels.set(workspaceRoot, resolution);
  return resolution;
}

export async function resolveChannelWorkspaceDisplayNames(
  input: unknown,
  channelsRoot: string,
  dependencies: ChannelWorkspaceDisplayNameDependencies = {},
): Promise<Record<string, string>> {
  const requestedRoots = Array.isArray(input)
    ? input
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .slice(0, MAX_WORKSPACE_LABEL_REQUESTS)
    : [];
  const workspaceRoots = Array.from(new Set(requestedRoots));
  if (workspaceRoots.length === 0) return {};

  const larkWorkspaces = workspaceRoots
    .map((requestedRoot) => ({
      requestedRoot,
      workspaceRoot: getLarkWorkspaceRoot(requestedRoot, channelsRoot),
    }))
    .filter((entry): entry is { requestedRoot: string; workspaceRoot: string } => Boolean(entry.workspaceRoot));
  if (larkWorkspaces.length === 0) return {};

  let configPromise: Promise<LarkWorkspaceLabelCliConfig> | undefined;
  const now = dependencies.now?.() ?? Date.now();
  const entries: Array<readonly [string, string] | undefined> = [];
  for (let index = 0; index < larkWorkspaces.length; index += LARK_WORKSPACE_LABEL_CONCURRENCY) {
    const batch = larkWorkspaces.slice(index, index + LARK_WORKSPACE_LABEL_CONCURRENCY);
    entries.push(...await Promise.all(batch.map(async ({ requestedRoot, workspaceRoot }) => {
      const label = await resolveWorkspaceLabel(
        workspaceRoot,
        now,
        async (conversation) => {
          if (dependencies.resolveLarkLabel) return dependencies.resolveLarkLabel(conversation);
          configPromise ??= resolveDefaultCliConfig();
          const config = await configPromise;
          return resolveLarkConversationDisplayNameWithCli(conversation, config, invokeDefaultCli);
        },
      );
      return label ? [requestedRoot, label] as const : undefined;
    })));
  }

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
}
