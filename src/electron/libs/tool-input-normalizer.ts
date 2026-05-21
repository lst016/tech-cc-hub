export type ToolInputNormalizationResult = {
  input: Record<string, unknown>;
  fixes: string[];
  mutated: boolean;
};

const FIGMA_REST_MAX_BYTES = 500_000;
const BROWSER_QUERY_MAX_RESULTS = 50;
const BROWSER_FETCH_LOG_LIMIT = 200;
const FIGMA_EXPORT_MIN_SCALE = 0.01;
const FIGMA_EXPORT_MAX_SCALE = 4;

export function normalizeToolInputForKnownSchemas(
  toolName: string,
  toolInput: Record<string, unknown>,
): ToolInputNormalizationResult {
  const input: Record<string, unknown> = { ...toolInput };
  const fixes: string[] = [];

  if (matchesToolName(toolName, "Read")) {
    normalizeReadPages(input, fixes);
  }

  if (matchesToolName(toolName, "browser_console_logs")) {
    removeEmptyString(input, "waitFor", fixes, "Removed empty browser_console_logs.waitFor");
  }

  if (matchesToolName(toolName, "browser_query_nodes")) {
    clampNumber(input, "maxResults", 1, BROWSER_QUERY_MAX_RESULTS, fixes, "Clamped browser_query_nodes.maxResults");
  }

  if (matchesToolName(toolName, "browser_fetch_logs")) {
    clampNumber(input, "limit", 1, BROWSER_FETCH_LOG_LIMIT, fixes, "Clamped browser_fetch_logs.limit");
    removeEmptyString(input, "urlContains", fixes, "Removed empty browser_fetch_logs.urlContains");
  }

  if (isFigmaRestTool(toolName)) {
    clampNumber(input, "maxBytes", 10_000, FIGMA_REST_MAX_BYTES, fixes, "Clamped Figma maxBytes");
  }

  if (matchesToolName(toolName, "figma_export_node_images")) {
    clampNumber(input, "scale", FIGMA_EXPORT_MIN_SCALE, FIGMA_EXPORT_MAX_SCALE, fixes, "Clamped figma_export_node_images.scale");
  }

  if (
    matchesToolName(toolName, "design_compare_current_view") ||
    matchesToolName(toolName, "design_compare_element_to_reference") ||
    matchesToolName(toolName, "design_compare_images")
  ) {
    preferCompareTargetOverRegion(input, fixes);
    removeInvalidRegion(input, "region", fixes, "Removed invalid compare region");
    filterInvalidRegions(input, "ignoreRegions", fixes, "Removed invalid ignoreRegions entries");
  }

  return {
    input,
    fixes,
    mutated: fixes.length > 0,
  };
}

export function normalizeKnownToolInputsInMessage<T>(message: T): T {
  if (!isRecord(message)) {
    return message;
  }

  let nextMessage: Record<string, unknown> = message;
  let mutated = false;

  const directContent = normalizeToolUseContentArray(nextMessage.content);
  if (directContent.mutated) {
    nextMessage = { ...nextMessage, content: directContent.content };
    mutated = true;
  }

  const nestedMessage = nextMessage.message;
  if (isRecord(nestedMessage)) {
    const nestedContent = normalizeToolUseContentArray(nestedMessage.content);
    if (nestedContent.mutated) {
      nextMessage = {
        ...nextMessage,
        message: {
          ...nestedMessage,
          content: nestedContent.content,
        },
      };
      mutated = true;
    }
  }

  return mutated ? nextMessage as T : message;
}

function matchesToolName(toolName: string, baseName: string): boolean {
  return (
    toolName === baseName ||
    toolName.endsWith(`__${baseName}`) ||
    toolName.endsWith(`:${baseName}`) ||
    toolName.endsWith(`/${baseName}`)
  );
}

function isFigmaRestTool(toolName: string): boolean {
  return (
    toolName.includes("tech-cc-hub-figma") ||
    /^figma_/.test(toolName) ||
    /(?:__|:|\/)figma_/.test(toolName)
  );
}

function removeEmptyString(
  input: Record<string, unknown>,
  key: string,
  fixes: string[],
  message: string,
): void {
  const value = input[key];
  if (typeof value === "string" && value.trim().length === 0) {
    delete input[key];
    fixes.push(message);
  }
}

function normalizeReadPages(input: Record<string, unknown>, fixes: string[]): void {
  if (!("pages" in input)) {
    return;
  }

  const rawPages = input.pages;
  if (typeof rawPages !== "string") {
    delete input.pages;
    fixes.push("Removed non-string Read.pages");
    return;
  }

  const pages = rawPages.replace(/\s+/g, "").trim();
  if (!pages) {
    delete input.pages;
    fixes.push("Removed empty Read.pages");
    return;
  }

  const filePath = typeof input.file_path === "string" ? input.file_path.trim() : "";
  if (!/\.pdf$/i.test(filePath)) {
    delete input.pages;
    fixes.push("Removed Read.pages for non-PDF file");
    return;
  }

  if (!isValidReadPagesRange(pages)) {
    delete input.pages;
    fixes.push("Removed invalid Read.pages");
    return;
  }

  if (pages !== rawPages) {
    input.pages = pages;
    fixes.push("Normalized Read.pages");
  }
}

function isValidReadPagesRange(value: string): boolean {
  if (!/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(value)) {
    return false;
  }

  return value.split(",").every((part) => {
    const [startRaw, endRaw] = part.split("-", 2);
    const start = Number(startRaw);
    const end = endRaw === undefined ? start : Number(endRaw);
    return (
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start > 0 &&
      end >= start
    );
  });
}

function normalizeToolUseContentArray(content: unknown): { content: unknown; mutated: boolean } {
  if (!Array.isArray(content)) {
    return { content, mutated: false };
  }

  let mutated = false;
  const normalizedContent = content.map((item) => {
    if (!isRecord(item) || item.type !== "tool_use" || typeof item.name !== "string" || !isRecord(item.input)) {
      return item;
    }

    const result = normalizeToolInputForKnownSchemas(item.name, item.input);
    if (!result.mutated) {
      return item;
    }

    mutated = true;
    return {
      ...item,
      input: result.input,
    };
  });

  return {
    content: mutated ? normalizedContent : content,
    mutated,
  };
}

function clampNumber(
  input: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  fixes: string[],
  message: string,
): void {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return;
  }

  const clamped = Math.min(Math.max(value, min), max);
  if (clamped !== value) {
    input[key] = Number.isInteger(min) && Number.isInteger(max) ? Math.round(clamped) : clamped;
    fixes.push(`${message} to ${input[key]}`);
  }
}

function removeInvalidRegion(
  input: Record<string, unknown>,
  key: string,
  fixes: string[],
  message: string,
): void {
  const value = input[key];
  if (!isValidRegion(value)) {
    if (value !== undefined) {
      delete input[key];
      fixes.push(message);
    }
    return;
  }

  input[key] = normalizeRegionNumbers(value);
}

function filterInvalidRegions(
  input: Record<string, unknown>,
  key: string,
  fixes: string[],
  message: string,
): void {
  const value = input[key];
  if (!Array.isArray(value)) {
    return;
  }

  const filtered = value.filter(isValidRegion).map(normalizeRegionNumbers);
  if (filtered.length !== value.length) {
    input[key] = filtered;
    fixes.push(message);
  }
}

function preferCompareTargetOverRegion(input: Record<string, unknown>, fixes: string[]): void {
  const target = input.target;
  if (typeof target !== "string" || target.trim().length === 0 || input.region === undefined) {
    return;
  }

  delete input.region;
  fixes.push("Removed compare region because target selector takes precedence");
}

function isValidRegion(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonNegativeNumber(value.x) &&
    isNonNegativeNumber(value.y) &&
    isPositiveNumber(value.width) &&
    isPositiveNumber(value.height)
  );
}

function normalizeRegionNumbers(region: Record<string, unknown>): Record<string, unknown> {
  return {
    ...region,
    x: Number(region.x),
    y: Number(region.y),
    width: Number(region.width),
    height: Number(region.height),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
