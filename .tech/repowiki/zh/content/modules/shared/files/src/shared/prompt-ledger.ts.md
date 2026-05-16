# src/shared/prompt-ledger.ts

> 模块：`shared` · 语言：`typescript` · 行数：470

## 文件职责

追踪 prompt 来源、估算 token 占用、提取历史消息内容用于优化和审计

## 关键符号

- `PromptLedgerBucket@0 - prompt 来源桶：包含 id、label、sourceKind、chars、tokenEstimate、ratio、sample`
- `PromptLedgerSegment@0 - prompt 段落：细粒度追踪，含 segmentKind、risks、optimizationHint`
- `estimatePromptLedgerTokens@0 - 估算字符对应的 token 数量，支持 CJK/空格差异计数`
- `buildPromptLedgerMessage@0 - 从多个来源构建完整的 prompt ledger 消息`
- `extractAssistantText@0 - 从 assistant 消息中提取文本内容`
- `extractToolResults@0 - 提取工具执行结果`

## 对外暴露

- `PromptLedgerSourceKind`
- `PromptLedgerSource`
- `PromptLedgerAttachmentSource`
- `PromptLedgerBucket`
- `PromptLedgerSegmentKind`
- `PromptLedgerRiskKind`
- `PromptLedgerSegment`
- `PromptLedgerMessage`
- `PromptLedgerBuildInput`
- `estimatePromptLedgerTokens`
- `buildPromptLedgerMessage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
const SEGMENT_TEXT_STORAGE_LIMIT = 2_000;
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
    if (kindOrder !== 0) return kindO
... (truncated)
```
