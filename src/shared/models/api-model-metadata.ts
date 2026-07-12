export type ImportedApiModel = {
  name: string;
  contextWindow?: number;
};

const DIRECT_CONTEXT_KEYS = [
  "contextWindow",
  "context_window",
  "contextLength",
  "context_length",
  "maxContextWindow",
  "max_context_window",
  "maxContextLength",
  "max_context_length",
  "maxInputTokens",
  "max_input_tokens",
  "inputTokenLimit",
  "input_token_limit",
  "inputTokens",
  "input_tokens",
] as const;

const NESTED_CONTEXT_PATHS = [
  ["top_provider", "context_length"],
  ["topProvider", "contextLength"],
  ["limits", "context_window"],
  ["limits", "contextWindow"],
  ["limits", "context_length"],
  ["limits", "contextLength"],
  ["capabilities", "context_window"],
  ["capabilities", "contextWindow"],
  ["metadata", "context_window"],
  ["metadata", "contextWindow"],
] as const;

export function extractApiModelsFromListPayload(payload: unknown): ImportedApiModel[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) {
    return [];
  }

  const deduped = new Map<string, ImportedApiModel>();
  for (const item of data) {
    const model = normalizeApiModelItem(item);
    if (!model) {
      continue;
    }

    const previous = deduped.get(model.name);
    deduped.set(model.name, {
      name: model.name,
      contextWindow: previous?.contextWindow ?? model.contextWindow,
    });
  }

  return Array.from(deduped.values());
}

export function extractMiniMaxTextModelsFromListPayload(payload: unknown): ImportedApiModel[] {
  return extractApiModelsFromListPayload(payload).filter(({ name }) => /^minimax-m\d+(?:\.\d+)?(?:[-._].+)?$/i.test(name));
}

export function getImportedApiModelNames(models: readonly ImportedApiModel[]): string[] {
  return models.map((model) => model.name);
}

export function toImportedApiModels(modelNames: readonly string[], contextWindow?: number): ImportedApiModel[] {
  return Array.from(new Set(modelNames.map((name) => name.trim()).filter(Boolean)))
    .map((name) => ({
      name,
      contextWindow,
    }));
}

function normalizeApiModelItem(item: unknown): ImportedApiModel | null {
  if (typeof item === "string") {
    const name = item.trim();
    return name ? { name } : null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  const rawName = readFirstString(record, ["id", "name", "slug", "model"]);
  const name = rawName?.trim() ?? "";
  if (!name) {
    return null;
  }

  return {
    name,
    contextWindow: readContextWindow(record),
  };
}

function readFirstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function readContextWindow(record: Record<string, unknown>): number | undefined {
  for (const key of DIRECT_CONTEXT_KEYS) {
    const value = parseContextWindowValue(record[key]);
    if (value) {
      return value;
    }
  }

  for (const path of NESTED_CONTEXT_PATHS) {
    const value = parseContextWindowValue(readNestedValue(record, path));
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readNestedValue(record: Record<string, unknown>, path: readonly string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function parseContextWindowValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.floor(value);
    return normalized > 0 ? normalized : undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/[,_\s]/g, "");
  const match = normalized.match(/^(\d+(?:\.\d+)?)(k|m)?$/i);
  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  return Math.floor(amount * multiplier);
}
