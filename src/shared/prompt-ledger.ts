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
  segmentIds?: string[];
};

export type PromptLedgerSegmentKind =
  | "source"
  | "current_prompt"
  | "attachment"
  | "history_user_prompt"
  | "history_assistant_output"
  | "history_tool_input"
  | "history_tool_output";

export type PromptLedgerRiskKind =
  | "long_content"
  | "repeated_content"
  | "ambiguous_reference"
  | "missing_acceptance"
  | "tool_payload";

export type PromptLedgerSegment = {
  id: string;
  bucketId: string;
  label: string;
  sourceKind: PromptLedgerSourceKind;
  segmentKind: PromptLedgerSegmentKind;
  chars: number;
  tokenEstimate: number;
  ratio: number;
  sample: string;
  text?: string;
  sourcePath?: string;
  round?: number;
  messageId?: string;
  nodeId?: string;
  toolName?: string;
  risks: PromptLedgerRiskKind[];
  optimizationHint?: string;
};

export type PromptLedgerMessage = {
  type: "prompt_ledger";
  phase: "start" | "continue";
  model?: string;
  cwd?: string;
  totalChars: number;
  totalTokenEstimate: number;
  buckets: PromptLedgerBucket[];
  segments: PromptLedgerSegment[];
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
type SegmentDraft = Omit<PromptLedgerSegment, "ratio">;

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
  const segments: SegmentDraft[] = [];

  addSources(buckets, segments, input.promptSources ?? [], "source");
  addSources(buckets, segments, input.memorySources ?? [], "source");
  addSourceWithSegment(buckets, segments, {
    id: "current-prompt",
    label: "当前用户输入",
    sourceKind: "current",
    text: input.prompt,
  }, "current_prompt");

  if (input.attachments?.length) {
    addSourceWithSegment(buckets, segments, {
      id: "current-attachments",
      label: "当前附件",
      sourceKind: "attachment",
      chars: input.attachments.reduce((sum, attachment) => sum + attachment.chars, 0),
      sample: input.attachments.map((attachment) => `${attachment.name}(${attachment.kind})`).join(", "),
    }, "attachment");
  }

  addHistoryBuckets(buckets, segments, input.historyMessages ?? []);

  const ordered = Array.from(buckets.values()).sort((left, right) => {
    const kindOrder = SOURCE_ORDER.indexOf(left.sourceKind) - SOURCE_ORDER.indexOf(right.sourceKind);
    if (kindOrder !== 0) return kindOrder;
    return right.chars - left.chars;
  });
  const totalChars = ordered.reduce((sum, bucket) => sum + bucket.chars, 0);
  const finalizedSegments = segments.map((segment) => ({
    ...segment,
    ratio: totalChars > 0 ? segment.chars / totalChars : 0,
  }));

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
    segments: finalizedSegments,
  };
}

function addSources(
  buckets: Map<string, BucketDraft>,
  segments: SegmentDraft[],
  sources: PromptLedgerSource[],
  segmentKind: PromptLedgerSegmentKind,
): void {
  for (const source of sources) {
    addSourceWithSegment(buckets, segments, source, segmentKind);
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
    if (source.id && !existing.segmentIds?.includes(source.id)) {
      existing.segmentIds = [...(existing.segmentIds ?? []), source.id];
    }
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
    segmentIds: [source.id],
  });
}

function addSourceWithSegment(
  buckets: Map<string, BucketDraft>,
  segments: SegmentDraft[],
  source: PromptLedgerSource,
  segmentKind: PromptLedgerSegmentKind,
  metadata?: Partial<Pick<PromptLedgerSegment, "round" | "messageId" | "nodeId" | "toolName">>,
): void {
  addSource(buckets, source);

  const text = source.text ?? "";
  const chars = Math.max(0, source.chars ?? text.length);
  const sample = source.sample ?? compressSample(text);
  if (chars <= 0 && !sample) return;

  const id = `${source.id}-segment-${segments.length + 1}`;
  segments.push({
    id,
    bucketId: source.id,
    label: source.label,
    sourceKind: source.sourceKind,
    segmentKind,
    chars,
    tokenEstimate: estimatePromptLedgerTokens(chars || sample),
    sample,
    text,
    sourcePath: source.sourcePath,
    risks: inferSegmentRisks(segmentKind, source.sourceKind, text || sample, chars),
    optimizationHint: inferOptimizationHint(segmentKind, source.sourceKind, chars),
    ...metadata,
  });

  const bucket = buckets.get(source.id);
  if (bucket) {
    bucket.segmentIds = [...(bucket.segmentIds ?? []).filter((item) => item !== source.id), id];
  }
}

function addHistoryBuckets(
  buckets: Map<string, BucketDraft>,
  segments: SegmentDraft[],
  messages: unknown[],
): void {
  let round = 0;

  for (const message of messages) {
    if (!isRecord(message)) continue;
    if (message.type === "user_prompt" && typeof message.prompt === "string") {
      round += 1;
      addSourceWithSegment(buckets, segments, {
        id: "history-user-prompt",
        label: "历史用户输入",
        sourceKind: "history",
        text: message.prompt,
      }, "history_user_prompt", {
        round,
        messageId: getMessageId(message),
        nodeId: getMessageId(message),
      });
      continue;
    }

    if (message.type === "assistant") {
      const text = extractAssistantText(message);
      if (text.length > 0) {
        addSourceWithSegment(buckets, segments, {
          id: "history-assistant-output",
          label: "历史 AI 输出",
          sourceKind: "history",
          text,
        }, "history_assistant_output", {
          round,
          messageId: getMessageId(message),
          nodeId: getMessageId(message),
        });
      }

      for (const toolInput of extractToolInputs(message)) {
        addSourceWithSegment(buckets, segments, {
          id: "history-tool-input",
          label: "历史工具输入",
          sourceKind: "tool",
          text: toolInput.text,
          sample: compressSample(toolInput.text, HISTORY_TOOL_OUTPUT_LIMIT),
        }, "history_tool_input", {
          round,
          messageId: getMessageId(message),
          nodeId: toolInput.id,
          toolName: toolInput.name,
        });
      }
      continue;
    }

    if (message.type === "user") {
      const toolResults = extractToolResults(message);
      for (const output of toolResults) {
        addSourceWithSegment(buckets, segments, {
          id: "history-tool-output",
          label: "历史工具输出",
          sourceKind: "tool",
          text: output,
          sample: compressSample(output, HISTORY_TOOL_OUTPUT_LIMIT),
        }, "history_tool_output", {
          round,
          messageId: getMessageId(message),
          nodeId: getToolResultId(message),
        });
      }
    }
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

function extractToolInputs(message: Record<string, unknown>): Array<{ id: string; name: string; text: string }> {
  const sdkMessage = isRecord(message.message) ? message.message : {};
  const content = Array.isArray(sdkMessage.content) ? sdkMessage.content : [];
  return content
    .map((item) => {
      if (!isRecord(item) || item.type !== "tool_use") return null;
      const id = typeof item.id === "string" ? item.id : getMessageId(message);
      const name = typeof item.name === "string" ? item.name : "tool";
      const input = "input" in item ? item.input : {};
      return {
        id,
        name,
        text: `${name} ${formatSegmentText(input)}`.trim(),
      };
    })
    .filter((item): item is { id: string; name: string; text: string } => Boolean(item?.text));
}

function getMessageId(message: Record<string, unknown>): string | undefined {
  for (const key of ["historyId", "uuid"]) {
    if (typeof message[key] === "string" && message[key].length > 0) {
      return message[key];
    }
  }
  return undefined;
}

function getToolResultId(message: Record<string, unknown>): string | undefined {
  const sdkMessage = isRecord(message.message) ? message.message : {};
  const content = Array.isArray(sdkMessage.content) ? sdkMessage.content : [sdkMessage.content];
  const result = content.find((item) => isRecord(item) && item.type === "tool_result");
  return isRecord(result) && typeof result.tool_use_id === "string" ? result.tool_use_id : getMessageId(message);
}

function formatSegmentText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function inferSegmentRisks(
  segmentKind: PromptLedgerSegmentKind,
  sourceKind: PromptLedgerSourceKind,
  text: string,
  chars: number,
): PromptLedgerRiskKind[] {
  const risks: PromptLedgerRiskKind[] = [];
  if (chars >= 4000) risks.push("long_content");
  if (/(它|他|她|这个|那个|上面|下面|刚才|之前)/.test(text) && chars < 180) {
    risks.push("ambiguous_reference");
  }
  if (sourceKind === "current" && !/(验收|验证|测试|成功|完成|标准|预期|acceptance|verify|test)/i.test(text)) {
    risks.push("missing_acceptance");
  }
  if (segmentKind === "history_tool_input" || segmentKind === "history_tool_output") {
    risks.push("tool_payload");
  }
  return risks;
}

function inferOptimizationHint(
  segmentKind: PromptLedgerSegmentKind,
  sourceKind: PromptLedgerSourceKind,
  chars: number,
): string | undefined {
  if (segmentKind === "history_tool_output" && chars >= 1200) {
    return "工具返回较长，优先压缩为结论摘要和关键证据。";
  }
  if (segmentKind === "history_tool_input" && chars >= 800) {
    return "工具输入较长，可保留工具名、目标文件和关键参数，原始 JSON 按需展开。";
  }
  if (sourceKind === "history" && chars >= 1200) {
    return "历史内容偏长，适合折叠成最近决策和未完成事项。";
  }
  if (sourceKind === "current") {
    return "当前输入可补齐目标、约束和验收标准，让后续执行更稳。";
  }
  return undefined;
}

function compressSample(value: string, max = 160): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= max) return singleLine;
  return `${singleLine.slice(0, max - 3).trimEnd()}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
