export type StructuredOutputIntent = "explicit" | "prompt" | "none";

const STRUCTURED_OUTPUT_REQUEST_PATTERNS = [
  /(?:请|请你|请直接|务必|必须)?\s*(?:用|使用|按|以)\s*JSON(?:\s*Schema)?\s*(?:格式)?\s*(?:输出|返回|回复)/i,
  /(?:输出|返回|回复)\s*(?:为|成|使用)?\s*JSON(?:\s*格式)?/i,
  /\b(?:return|respond|reply|output|format)\b[^\r\n]{0,60}\b(?:as|in|with)\s+json\b/i,
  /\b(?:return|respond|reply|output)\s+json\b/i,
  /\buse\s+structured\s+output\b/i,
  /\b(?:use|follow)\s+(?:the\s+)?json\s+schema\b/i,
];

export function resolveStructuredOutputIntent(
  runtimeOutputFormat: string | undefined,
  currentDisplayPrompt: string,
): StructuredOutputIntent {
  if (runtimeOutputFormat === "none") return "none";
  if (runtimeOutputFormat === "json") return "explicit";

  return STRUCTURED_OUTPUT_REQUEST_PATTERNS.some((pattern) => pattern.test(currentDisplayPrompt))
    ? "prompt"
    : "none";
}
