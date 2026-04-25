import type { PromptAttachment, StreamMessage } from "./types.js";

export type SessionWorkingMemory = {
  currentGoal?: string;
  nextAction?: string;
  readFiles: string[];
  touchedFiles: string[];
  imageContextPaths: string[];
  userConstraints: string[];
  verification: string[];
  lastResult?: string;
  updatedAt: number;
};

const MAX_ITEMS = 12;
const MAX_TEXT = 180;

export function createEmptyWorkingMemory(): SessionWorkingMemory {
  return {
    readFiles: [],
    touchedFiles: [],
    imageContextPaths: [],
    userConstraints: [],
    verification: [],
    updatedAt: Date.now(),
  };
}

export function parseWorkingMemory(value: unknown): SessionWorkingMemory | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as Partial<SessionWorkingMemory>;
    return normalizeWorkingMemory(parsed);
  } catch {
    return undefined;
  }
}

export function normalizeWorkingMemory(value?: Partial<SessionWorkingMemory> | null): SessionWorkingMemory {
  return {
    currentGoal: sanitizeOptionalText(value?.currentGoal),
    nextAction: sanitizeOptionalText(value?.nextAction),
    readFiles: normalizeList(value?.readFiles),
    touchedFiles: normalizeList(value?.touchedFiles),
    imageContextPaths: normalizeList(value?.imageContextPaths),
    userConstraints: normalizeList(value?.userConstraints),
    verification: normalizeList(value?.verification),
    lastResult: sanitizeOptionalText(value?.lastResult),
    updatedAt: typeof value?.updatedAt === "number" ? value.updatedAt : Date.now(),
  };
}

export function serializeWorkingMemory(memory?: SessionWorkingMemory): string | undefined {
  if (!memory || isWorkingMemoryEmpty(memory)) {
    return undefined;
  }

  return JSON.stringify({
    ...memory,
    updatedAt: Date.now(),
  });
}

export function updateWorkingMemoryFromUserPrompt(
  current: SessionWorkingMemory | undefined,
  prompt: string,
  attachments?: PromptAttachment[],
): SessionWorkingMemory {
  const memory = normalizeWorkingMemory(current);
  const normalizedPrompt = sanitizeText(prompt);
  if (!normalizedPrompt) {
    return memory;
  }

  if (!isContinuationOnlyPrompt(normalizedPrompt)) {
    memory.currentGoal = memory.currentGoal || normalizedPrompt;
  }

  if (isConstraintLikePrompt(normalizedPrompt)) {
    memory.userConstraints = addUnique(memory.userConstraints, normalizedPrompt);
  }

  for (const attachment of attachments ?? []) {
    if (attachment.kind === "image" && attachment.storagePath) {
      memory.imageContextPaths = addUnique(memory.imageContextPaths, attachment.storagePath);
    }
  }

  memory.nextAction = isContinuationOnlyPrompt(normalizedPrompt)
    ? memory.nextAction || "继续当前任务，不要重新做项目探索。"
    : "按当前目标继续执行，优先复用已读文件和已定位上下文。";
  memory.updatedAt = Date.now();
  return memory;
}

export function updateWorkingMemoryFromStreamMessage(
  current: SessionWorkingMemory | undefined,
  message: StreamMessage,
): SessionWorkingMemory {
  const memory = normalizeWorkingMemory(current);
  const toolUses = extractToolUses(message);
  for (const toolUse of toolUses) {
    const filePath = extractFilePath(toolUse.input);
    if (filePath) {
      if (toolUse.name === "Read") {
        memory.readFiles = addUnique(memory.readFiles, filePath);
      }
      if (["Edit", "Write", "MultiEdit"].includes(toolUse.name)) {
        memory.touchedFiles = addUnique(memory.touchedFiles, filePath);
      }
    }

    if (toolUse.name.includes("图片转开发上下文")) {
      const manifestPath = extractStringField(toolUse.input, "manifestPath");
      if (manifestPath) {
        memory.imageContextPaths = addUnique(memory.imageContextPaths, manifestPath);
      }
    }
  }

  const resultText = extractSuccessfulResultText(message);
  if (resultText) {
    memory.lastResult = resultText;
    memory.nextAction = "基于最新结果继续，不要从头重读上下文。";
  }

  if (toolUses.length > 0 || resultText) {
    memory.updatedAt = Date.now();
  }
  return memory;
}

export function buildWorkingMemoryPrompt(memory?: SessionWorkingMemory): string {
  const normalized = normalizeWorkingMemory(memory);
  if (isWorkingMemoryEmpty(normalized)) {
    return "";
  }

  return [
    "## Session Working Memory（系统自动维护）",
    "",
    "这是同一会话的短工作记忆。继续任务时优先使用它；除非用户明确要求或信息明显过期，不要重新读取已列出的文档/文件。",
    "",
    normalized.currentGoal ? `当前目标：${normalized.currentGoal}` : "",
    normalized.nextAction ? `下一步：${normalized.nextAction}` : "",
    formatList("已读文件/文档", normalized.readFiles),
    formatList("已修改/待关注文件", normalized.touchedFiles),
    formatList("图片开发上下文", normalized.imageContextPaths),
    formatList("用户约束", normalized.userConstraints),
    formatList("验证记录", normalized.verification),
    normalized.lastResult ? `最近结果：${normalized.lastResult}` : "",
  ].filter(Boolean).join("\n");
}

export function appendWorkingMemoryToPrompt(prompt: string, memory?: SessionWorkingMemory): string {
  const memoryPrompt = buildWorkingMemoryPrompt(memory);
  if (!memoryPrompt) {
    return prompt;
  }

  if (prompt.includes("## Session Working Memory（系统自动维护）")) {
    return prompt;
  }

  return `${prompt.trim()}\n\n${memoryPrompt}`;
}

function isWorkingMemoryEmpty(memory: SessionWorkingMemory): boolean {
  return !memory.currentGoal &&
    !memory.nextAction &&
    !memory.lastResult &&
    memory.readFiles.length === 0 &&
    memory.touchedFiles.length === 0 &&
    memory.imageContextPaths.length === 0 &&
    memory.userConstraints.length === 0 &&
    memory.verification.length === 0;
}

function addUnique(items: string[], value: string): string[] {
  const normalized = sanitizeText(value);
  if (!normalized || items.includes(normalized)) {
    return items;
  }

  return [...items, normalized].slice(-MAX_ITEMS);
}

function normalizeList(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const result: string[] = [];
  for (const value of values) {
    const normalized = sanitizeText(value);
    if (normalized && !result.includes(normalized)) {
      result.push(normalized);
    }
  }
  return result.slice(-MAX_ITEMS);
}

function sanitizeOptionalText(value?: string): string | undefined {
  const normalized = sanitizeText(value ?? "");
  return normalized || undefined;
}

function sanitizeText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_TEXT) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_TEXT - 1).trimEnd()}…`;
}

function isContinuationOnlyPrompt(prompt: string): boolean {
  return /^(继续|继续吧|可以继续|开始|开始吧|go on|continue)$/i.test(prompt.trim());
}

function isConstraintLikePrompt(prompt: string): boolean {
  return /不要|别|必须|应该|需要|要求|问题是|不应该|优先/.test(prompt);
}

function formatList(label: string, values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  return `${label}：\n${values.map((value) => `- ${value}`).join("\n")}`;
}

function extractToolUses(message: StreamMessage): Array<{ name: string; input: unknown }> {
  if (message.type !== "assistant" || !("message" in message)) {
    return [];
  }

  const sdkMessage = message.message as { content?: unknown };
  if (!Array.isArray(sdkMessage.content)) {
    return [];
  }

  return sdkMessage.content.flatMap((item) => {
    if (!isRecord(item) || item.type !== "tool_use" || typeof item.name !== "string") {
      return [];
    }
    return [{ name: item.name, input: item.input }];
  });
}

function extractSuccessfulResultText(message: StreamMessage): string | undefined {
  if (message.type !== "result" || message.subtype !== "success" || typeof message.result !== "string") {
    return undefined;
  }
  return sanitizeOptionalText(message.result);
}

function extractFilePath(input: unknown): string | undefined {
  return extractStringField(input, "file_path");
}

function extractStringField(input: unknown, key: string): string | undefined {
  if (!isRecord(input) || typeof input[key] !== "string") {
    return undefined;
  }
  return sanitizeOptionalText(input[key]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
