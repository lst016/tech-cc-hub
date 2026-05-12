import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toTextToolResult(payload: unknown, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function toPlainTextToolResult(text: string, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text }],
  };
}