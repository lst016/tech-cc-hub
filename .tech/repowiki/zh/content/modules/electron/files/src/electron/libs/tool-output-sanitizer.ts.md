# src/electron/libs/tool-output-sanitizer.ts

> 模块：`electron` · 语言：`typescript` · 行数：210

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `createTextToolOutputBlocks@22`
- `extractInlineBase64ImageFromToolResponse@26`
- `buildToolImageReplacementText@68`
- `buildOversizedTextToolOutputReplacement@96`
- `stripInlineBase64ImagesFromMessage@125`
- `extractTextToolResponse@164`
- `getContentBlocks@194`
- `isRecord@206`
- `DEFAULT_MAX_TEXT_TOOL_OUTPUT_CHARS@18`
- `TEXT_TOOL_OUTPUT_HEAD_CHARS@20`
- `TEXT_TOOL_OUTPUT_TAIL_CHARS@21`
- `contentBlocks@28`
- `base64Data@51`
- `lines@75`
- `normalizedTextContext@78`
- `normalizedSummary@83`
- `normalizedError@88`
- `text@102`
- `head@106`
- `tail@108`
- `omittedChars@109`
- `didSanitize@130`
- `nextContent@132`
- `imagePayload@136`
- `contentBlocks@169`
- `InlineBase64ToolImage@2`
- `OversizedTextToolOutput@8`
- `TextToolOutputBlock@13`

## 依赖输入

- `../types.js`

## 对外暴露

- `InlineBase64ToolImage`
- `OversizedTextToolOutput`
- `TextToolOutputBlock`
- `createTextToolOutputBlocks`
- `extractInlineBase64ImageFromToolResponse`
- `buildToolImageReplacementText`
- `buildOversizedTextToolOutputReplacement`
- `stripInlineBase64ImagesFromMessage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { StreamMessage } from "../types.js";

export type InlineBase64ToolImage = {
  mimeType: string;
  base64Data: string;
  textContext: string;
};

export type OversizedTextToolOutput = {
  originalChars: number;
  replacementText: string;
};

export type TextToolOutputBlock = {
  type: "text";
  text: string;
};

const DEFAULT_MAX_TEXT_TOOL_OUTPUT_CHARS = 18_000;
const TEXT_TOOL_OUTPUT_HEAD_CHARS = 9_000;
const TEXT_TOOL_OUTPUT_TAIL_CHARS = 4_000;

export function createTextToolOutputBlocks(text: string): TextToolOutputBlock[] {
  return [{ type: "text", text }];
}

export function extractInlineBase64ImageFromToolResponse(toolResponse: unknown): InlineBase64ToolImage | null {
  const contentBlocks = getContentBlocks(toolResponse);
  if (contentBlocks.length === 0) {
    return null;
  }

  const textParts: string[] = [];
  for (const block of contentBlocks) {
    if (!isRecord(block)) {
      continue;
    }

    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      textParts.push(block.text.trim());
      continue;
    }

    if (block.type !== "image" || !isRecord(block.source)) {
      continue;
    }

    if (block.source.type !== "base64" || typeof block.source.data !== "string") {
      continue;
    }

    const base64Data = block.source.data.replace(/\s+/g, "");
    if (!base64Data) {
      continue;
    }

    return {
      mimeType: typeof block.source.media_type === "string" && block.source.media_type.trim()
        ? block.source.media_type.trim()
        : "image/png",
      base64Data,
      textContext: textParts.join("\n"),
    };
  }

  return null;
}

export function buildToolImageReplacementText(options: {
  toolName: string;
  textContext?: string;
  summary?: string;
  error?: string;
}): string {
  const lines = [
    `Tool ${options.toolName} returned an image. The raw image was replaced with text to avoid context overflow.`,
  ];

  const normalizedTextContext = options.textContext?.trim();
  if (normalizedTextContext) {
    lines.push(`Tool note: ${normalizedTextContext}`);
  }

  const normalizedSummary = options.summary?.trim();
  if (normalizedSummary) {
    lines.push(normalizedSummary);
  }

  const normalizedError = options.error?.trim();
  if (normalizedError) {
    lines.push(`Image summary failed: ${normalizedError}`);
  }

  return lines.join("\n\n");
}

export function buildOversizedTextToolOutputReplacement(
  toolName: string,
  toolResponse: unknown,
  maxChars = DEFAULT_MAX_TEXT_TOOL_OUTPUT_CHARS,
): OversizedTextToolOutput | null {
  const text = extractTextToolResponse(toolResponse).trim();
  if (text.length <= maxChars) {
    return null;
  }

  const head = text.slice(0, TEXT_TOOL_OUTPUT_HEAD_CHARS).trimEnd();
  const tail = text.slice(-TEXT_TOOL_OUTPUT_TAIL_CHARS).trimStart();
  const omittedChars = Math.max(0, text.length - head.length - tail.length);

  return {
    originalChars: text.length,
    replacementText: [
      `Tool ${toolName} returned ${text.length} characters, which was truncated to avoid blowing the model context.`,
      "Use a narrower search, smaller Read offset/limit, or inspect a specific symbol/range if more detail is needed.",
      "",
      `--- BEGIN TRUNCATED ${toolName} OUTPUT HEAD ---`,
      head,
      `--- ${omittedChars} characters omitted ---`,
      tail,
      `--- END TRUNCATED ${toolName} OUTPUT ---`,
    ].join("\n"),
  };
}

export function stripInlineBase64ImagesFromMessage(message: StreamMessage): StreamMessage {
  if (message.type !== "user" || !("message" in message) || !isRecord(message.message) || !Array.isArray(message.message.content)) {
    return message;
  }

  let didSanitize = false;
  const nextContent = message.message.content.map((block) => {
    if (!isRecord(block) || block.type !== "tool_result") {
      return block;
    }

    const imagePayload = extractInlineBase64ImageFromToolResponse({ content: block.content });
    if (!imagePayload) {
      return block;
    }

    didSanitize = true;
    return {
      ...block,
      content: buildToolImageReplacementText({
        toolName: "tool_result",
        textContext: imagePayload.textContext,
      }),
    };
  });
... (truncated)
```
