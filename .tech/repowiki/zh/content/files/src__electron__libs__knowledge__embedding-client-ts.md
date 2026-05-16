# src/electron/libs/knowledge/embedding-client.ts

> 模块：`knowledge-engine` · 语言：`typescript` · 行数：115

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `joinEndpoint@12`
- `sleep@17`
- `normalizeEmbeddingVector@21`
- `requestEmbeddings@35`
- `embedTexts@82`
- `embedTextBatches@97`
- `normalizedBase@14`
- `normalized@26`
- `response@40`
- `rawText@52`
- `byIndex@67`
- `index@70`
- `vector@75`
- `batch@101`
- `OpenAIEmbeddingResponse@2`

## 依赖输入

- `./knowledge-types.js`

## 对外暴露

- `embedTexts`
- `embedTextBatches`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { EmbeddingModelSettings } from "./knowledge-types.js";

type OpenAIEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
  error?: {
    message?: string;
  };
};

function joinEndpoint(baseURL: string, path: string): string {
  const normalizedBase = baseURL.replace(/\/$/, "");
  return `${normalizedBase}${path}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmbeddingVector(vector: unknown, expectedDimension: number): number[] {
  if (!Array.isArray(vector)) {
    throw new Error("embedding response missing vector");
  }
  const normalized = vector.map((item) => Number(item));
  if (normalized.some((item) => !Number.isFinite(item))) {
    throw new Error("embedding response contains non-numeric values");
  }
  if (normalized.length !== expectedDimension) {
    throw new Error(`embedding dimension mismatch: expected ${expectedDimension}, got ${normalized.length}`);
  }
  return normalized;
}

async function requestEmbeddings(settings: EmbeddingModelSettings, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const response = await fetch(joinEndpoint(settings.baseURL, "/embeddings"), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      input: texts,
    }),
  });

  const rawText = await response.text();
  let payload: OpenAIEmbeddingResponse;
  try {
    payload = rawText ? JSON.parse(rawText) as OpenAIEmbeddingResponse : {};
  } catch {
    throw new Error(`embedding API returned non-JSON response: ${rawText.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || rawText || response.statusText);
  }
  if (!Array.isArray(payload.data)) {
    throw new Error("embedding API response missing data[]");
  }

  const byIndex = new Map<number, number[]>();
  payload.data.forEach((item, fallbackIndex) => {
    const index = typeof item.index === "number" ? item.index : fallbackIndex;
    byIndex.set(index, normalizeEmbeddingVector(item.embedding, settings.dimension));
  });

  return texts.map((_, index) => {
    const vector = byIndex.get(index);
    if (!vector) {
      throw new Error(`embedding API response missing vector for input ${index}`);
    }
    return vector;
  });
}

export async function embedTexts(settings: EmbeddingModelSettings, texts: string[]): Promise<number[][]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestEmbeddings(settings, texts);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(350 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function embedTextBatches(settings: EmbeddingModelSettings, texts: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += settings.batchSize) {
    const batch = texts.slice(index, index + settings.batchSize);
    try {
      vectors.push(...await embedTexts(settings, batch));
    } catch (error) {
      if (batch.length === 1) {
        throw error;
      }
      for (const text of batch) {
        vectors.push(...await embedTexts(settings, [text]));
      }
    }
  }
  return vectors;
}

```
