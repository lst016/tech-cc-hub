export type PromptLedgerSourceKind =
  | "system"
  | "project"
  | "skill"
  | "workflow"
  | "current"
  | "attachment"
  | "memory"
  | "history"
  | "tool"
  | "other";

export type PromptLedgerSource = {
  id: string;
  label: string;
  sourceKind: PromptLedgerSourceKind;
  text?: string;
  chars?: number;
  sample?: string;
  sourcePath?: string;
};

export type PromptLedgerAttachmentSource = {
  name: string;
  kind: "image" | "text";
  chars: number;
};

export type PromptLedgerBucket = {
  id: string;
  label: string;
  sourceKind: PromptLedgerSourceKind;
  chars: number;
  tokenEstimate: number;
  itemCount: number;
  ratio: number;
  sample: string;
  sourcePath?: string;
};

export type PromptLedgerMessage = {
  type: "prompt_ledger";
  phase: "start" | "continue";
  model?: string;
  cwd?: string;
  totalChars: number;
  totalTokenEstimate: number;
  buckets: PromptLedgerBucket[];
  capturedAt?: number;
  historyId?: string;
};

export type PromptLedgerBuildInput = {
  phase: "start" | "continue";
  model?: string;
  cwd?: string;
  prompt: string;
  attachments?: PromptLedgerAttachmentSource[];
  promptSources?: PromptLedgerSource[];
  memorySources?: PromptLedgerSource[];
  historyMessages?: unknown[];
};

type BucketDraft = Omit<PromptLedgerBucket, "ratio">;

const HISTORY_TOOL_OUTPUT_LIMIT = 120;
const SOURCE_ORDER: PromptLedgerSourceKind[] = [
  "system",
  "project",
  "skill",
  "workflow",
  "current",
  "attachment",
  "memory",
  "tool",
  "history",
  "other",
];

export function estimatePromptLedgerTokens(textOrChars: string | number): number {
  if (typeof textOrChars === "number") {
    return Math.ceil(Math.max(0, textOrChars) / 3);
  }

  let cjkCount = 0;
  let whitespaceCount = 0;
  for (const char of textOrChars) {
    if (/\s/.test(char)) {
      whitespaceCount += 1;
    } else if (/[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(char)) {
      cjkCount += 1;
    }
  }

  const otherCount = Math.max(0, textOrChars.length - cjkCount - whitespaceCount);
  return Math.ceil((cjkCount * 1.2) + (otherCount / 3) + (whitespaceCount * 0.15));
}

export function buildPromptLedgerMessage(input: PromptLedgerBuildInput): PromptLedgerMessage {
  const buckets = new Map<string, BucketDraft>();

  addSources(buckets, input.promptSources ?? []);
  addSources(buckets, input.memorySources ?? []);
  addSource(buckets, {
    id: "current-prompt",
    label: "当前用户输入",
    sourceKind: "current",
    text: input.prompt,
  });

  if (input.attachments?.length) {
    addSource(buckets, {
      id: "current-attachments",
      label: "当前附件",
      sourceKind: "attachment",
      chars: input.attachments.reduce((sum, attachment) => sum + attachment.chars, 0),
      sample: input.attachments.map((attachment) => `${attachment.name}(${attachment.kind})`).join(", "),
    });
  }

  addHistoryBuckets(buckets, input.historyMessages ?? []);

  const ordered = Array.from(buckets.values()).sort((left, right) => {
    const kindOrder = SOURCE_ORDER.indexOf(left.sourceKind) - SOURCE_ORDER.indexOf(right.sourceKind);
    if (kindOrder !== 0) return kindOrder;
    return right.chars - left.chars;
  });
  const totalChars = ordered.reduce((sum, bucket) => sum + bucket.chars, 0);

  return {
    type: "prompt_ledger",
    phase: input.phase,
    model: input.model,
    cwd: input.cwd,
    totalChars,
    totalTokenEstimate: ordered.reduce((sum, bucket) => sum + bucket.tokenEstimate, 0),
    buckets: ordered.map((bucket) => ({
      ...bucket,
      ratio: totalChars > 0 ? bucket.chars / totalChars : 0,
    })),
  };
}

function addSources(buckets: Map<string, BucketDraft>, sources: PromptLedgerSource[]): void {
  for (const source of sources) {
    addSource(buckets, source);
  }
}

function addSource(buckets: Map<string, BucketDraft>, source: PromptLedgerSource): void {
  const text = source.text ?? "";
  const chars = Math.max(0, source.chars ?? text.length);
  if (chars <= 0 && !source.sample) {
    return;
  }

  const sample = source.sample ?? compressSample(text);
  const existing = buckets.get(source.id);
  if (existing) {
    existing.chars += chars;
    existing.tokenEstimate += estimatePromptLedgerTokens(chars);
    existing.itemCount += 1;
    existing.sample = sample || existing.sample;
    return;
  }

  buckets.set(source.id, {
    id: source.id,
    label: source.label,
    sourceKind: source.sourceKind,
    chars,
    tokenEstimate: estimatePromptLedgerTokens(chars || sample),
    itemCount: 1,
    sample,
    sourcePath: source.sourcePath,
  });
}

function addHistoryBuckets(buckets: Map<string, BucketDraft>, messages: unknown[]): void {
  let toolOutputChars = 0;
  let assistantChars = 0;
  let userPromptChars = 0;
  const toolSamples: string[] = [];

  for (const message of messages) {
    if (!isRecord(message)) continue;
    if (message.type === "user_prompt" && typeof message.prompt === "string") {
      userPromptChars += message.prompt.length;
      continue;
    }

    if (message.type === "assistant") {
      assistantChars += extractAssistantText(message).length;
      continue;
    }

    if (message.type === "user") {
      const toolResults = extractToolResults(message);
      for (const output of toolResults) {
        toolOutputChars += output.length;
        if (toolSamples.length < 2) {
          toolSamples.push(compressSample(output, HISTORY_TOOL_OUTPUT_LIMIT));
        }
      }
    }
  }

  if (userPromptChars > 0) {
    addSource(buckets, {
      id: "history-user-prompt",
      label: "历史用户输入",
      sourceKind: "history",
      chars: userPromptChars,
      sample: "同会话历史里的用户输入",
    });
  }
  if (assistantChars > 0) {
    addSource(buckets, {
      id: "history-assistant-output",
      label: "历史 AI 输出",
      sourceKind: "history",
      chars: assistantChars,
      sample: "同会话历史里的 AI 输出",
    });
  }
  if (toolOutputChars > 0) {
    addSource(buckets, {
      id: "history-tool-output",
      label: "历史工具输出",
      sourceKind: "tool",
      chars: toolOutputChars,
      sample: toolSamples.join(" / "),
    });
  }
}

function extractAssistantText(message: Record<string, unknown>): string {
  const sdkMessage = isRecord(message.message) ? message.message : {};
  const content = Array.isArray(sdkMessage.content) ? sdkMessage.content : [];
  return content
    .map((item) => {
      if (isRecord(item) && item.type === "text" && typeof item.text === "string") {
        return item.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractToolResults(message: Record<string, unknown>): string[] {
  const sdkMessage = isRecord(message.message) ? message.message : {};
  const content = Array.isArray(sdkMessage.content) ? sdkMessage.content : [sdkMessage.content];
  return content
    .map((item) => {
      if (!isRecord(item) || item.type !== "tool_result") return "";
      const result = item.content;
      if (typeof result === "string") return result;
      try {
        return JSON.stringify(result);
      } catch {
        return String(result);
      }
    })
    .filter(Boolean);
}

function compressSample(value: string, max = 160): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, max - 3).trimEnd()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
