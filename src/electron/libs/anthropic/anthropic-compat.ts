import {
  logToolSchemaNormalizationIssue,
  normalizeToolJsonSchema,
} from "../tool-schema-normalizer.js";

type AnthropicCompatConfig = {
  provider?: string;
  baseURL: string;
};

export function shouldUseAnthropicCompatProxy(config: AnthropicCompatConfig): boolean {
  if (config.provider === "codex") {
    return false;
  }
  try {
    return new URL(config.baseURL).hostname !== "api.anthropic.com";
  } catch {
    return true;
  }
}

export function sanitizeAnthropicMessagesPayload(payload: unknown): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.messages)) {
    return payload;
  }

  const systemParts = normalizeSystemParts(payload.system);
  const messages: unknown[] = [];

  for (const message of payload.messages) {
    if (!isRecord(message)) {
      continue;
    }

    const role = stringValue(message.role);
    if (role === "system") {
      const text = normalizeContentText(message.content);
      if (text) {
        systemParts.push(text);
      }
      continue;
    }

    if (role !== "user" && role !== "assistant") {
      continue;
    }

    messages.push(message);
  }

  return {
    ...payload,
    ...(systemParts.length > 0 ? { system: systemParts.join("\n\n") } : {}),
    messages,
    ...(Array.isArray(payload.tools) ? { tools: normalizeAnthropicTools(payload.tools) } : {}),
  };
}

function normalizeAnthropicTools(tools: unknown[]): unknown[] {
  return tools.map((tool, index) => {
    if (!isRecord(tool) || !("input_schema" in tool)) {
      return tool;
    }

    const toolName = stringValue(tool.name) || `<unnamed-tool-${index}>`;
    return {
      ...tool,
      input_schema: normalizeToolJsonSchema(
        tool.input_schema,
        (issue) => logToolSchemaNormalizationIssue(toolName, issue),
      ),
    };
  });
}

function normalizeSystemParts(system: unknown): string[] {
  if (typeof system === "string") {
    return system.trim() ? [system.trim()] : [];
  }
  if (!Array.isArray(system)) {
    return [];
  }
  return system
    .map((item) => normalizeContentText(item))
    .filter(Boolean);
}

function normalizeContentText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (isRecord(item) && stringValue(item.type) === "text") return stringValue(item.text);
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (isRecord(content) && stringValue(content.type) === "text") {
    return stringValue(content.text);
  }
  return "";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
