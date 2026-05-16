# src/electron/libs/knowledge/wiki-model-client.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：86

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `joinEndpoint@17`
- `sanitizeWikiMarkdown@22`
- `completeWikiChat@32`
- `generateWikiMarkdown@73`
- `DEFAULT_WIKI_CALL_TIMEOUT_MS@15`
- `normalizedBase@19`
- `controller@38`
- `timer@39`
- `response@40`
- `rawText@54`
- `text@66`
- `OpenAIChatResponse@3`

## 依赖输入

- `./knowledge-types.js`
- `./repowiki/prompts.js`

## 对外暴露

- `completeWikiChat`
- `generateWikiMarkdown`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { WikiModelSettings } from "./knowledge-types.js";
import type { ChatMessage } from "./repowiki/prompts.js";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_WIKI_CALL_TIMEOUT_MS = Number(process.env.TECH_CC_HUB_WIKI_CALL_TIMEOUT_MS || 120_000);

function joinEndpoint(baseURL: string, path: string): string {
  const normalizedBase = baseURL.replace(/\/$/, "");
  return `${normalizedBase}${path}`;
}

function sanitizeWikiMarkdown(text: string): string {
  return text
    .trim()
    .replace(/&lt;think&gt;[\s\S]*?<\/think>/gi, "")
    .trim()
    .replace(/^```(?:markdown|md)?[^\S\r\n]*(?:\r?\n|$)/i, "")
    .replace(/\r?\n```[^\S\r\n]*$/i, "")
    .trim();
}

export async function completeWikiChat(
  settings: WikiModelSettings,
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_WIKI_CALL_TIMEOUT_MS);
  const response = await fetch(joinEndpoint(settings.baseURL, "/chat/completions"), {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? settings.maxOutputTokens,
    }),
  }).finally(() => clearTimeout(timer));

  const rawText = await response.text();
  let payload: OpenAIChatResponse;
  try {
    payload = rawText ? JSON.parse(rawText) as OpenAIChatResponse : {};
  } catch {
    throw new Error(`wiki model returned non-JSON response: ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || rawText || response.statusText);
  }

  const text = sanitizeWikiMarkdown(payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text || "");
  if (!text.trim()) {
    throw new Error("wiki model returned empty content");
  }
  return text;
}

export async function generateWikiMarkdown(settings: WikiModelSettings, prompt: string): Promise<string> {
  return completeWikiChat(settings, [
    {
      role: "system",
      content: "你是一个仓库 Wiki 生成器。只输出中文 Markdown，不要输出代码围栏外的解释。",
    },
    {
      role: "user",
      content: prompt,
    },
  ]);
}

```
