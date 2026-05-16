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

export async function embedTextBatches(
  settings: EmbeddingModelSettings,
  texts: string[],
  onProgress?: (progress: { completed: number; total: number }) => void,
): Promise<number[][]> {
  const vectors: number[][] = [];
  onProgress?.({ completed: 0, total: texts.length });
  for (let index = 0; index < texts.length; index += settings.batchSize) {
    const batch = texts.slice(index, index + settings.batchSize);
    try {
      vectors.push(...await embedTexts(settings, batch));
      onProgress?.({ completed: Math.min(texts.length, vectors.length), total: texts.length });
    } catch (error) {
      if (batch.length === 1) {
        throw error;
      }
      for (const text of batch) {
        vectors.push(...await embedTexts(settings, [text]));
        onProgress?.({ completed: Math.min(texts.length, vectors.length), total: texts.length });
      }
    }
  }
  return vectors;
}
