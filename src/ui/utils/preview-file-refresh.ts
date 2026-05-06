const WRITE_TOOL_NAMES = new Set(['write', 'edit', 'multiedit']);

export type PreviewFileChangeEvent = {
  path: string;
  operationId: string;
};

type ToolUseContent = {
  type?: unknown;
  id?: unknown;
  name?: unknown;
  input?: unknown;
};

type ToolResultContent = {
  type?: unknown;
  tool_use_id?: unknown;
  is_error?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMessageContent(message: unknown): unknown[] {
  if (!isRecord(message)) return [];
  const rawMessage = message.message;
  if (!isRecord(rawMessage)) return [];
  const content = rawMessage.content;
  return Array.isArray(content) ? content : [content];
}

function getWriteToolPath(content: ToolUseContent): string | null {
  if (content.type !== 'tool_use') return null;
  if (typeof content.name !== 'string' || !WRITE_TOOL_NAMES.has(content.name.toLowerCase())) return null;
  if (!isRecord(content.input)) return null;

  const filePath = content.input.file_path;
  return typeof filePath === 'string' && filePath.trim() ? filePath.trim() : null;
}

export function normalizePreviewFilePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

export function collectCompletedPreviewFileChanges(messages: readonly unknown[]): PreviewFileChangeEvent[] {
  const pendingWriteToolPaths = new Map<string, string>();
  const changes: PreviewFileChangeEvent[] = [];
  const seenOperationIds = new Set<string>();

  for (const message of messages) {
    if (!isRecord(message) || typeof message.type !== 'string') continue;
    const contents = getMessageContent(message);

    if (message.type === 'assistant') {
      for (const content of contents) {
        if (!isRecord(content)) continue;
        const path = getWriteToolPath(content);
        if (!path || typeof content.id !== 'string') continue;
        pendingWriteToolPaths.set(content.id, path);
      }
      continue;
    }

    if (message.type !== 'user') continue;
    for (const content of contents) {
      if (!isRecord(content)) continue;
      const result = content as ToolResultContent;
      if (result.type !== 'tool_result' || typeof result.tool_use_id !== 'string') continue;
      if (result.is_error) continue;
      if (seenOperationIds.has(result.tool_use_id)) continue;

      const path = pendingWriteToolPaths.get(result.tool_use_id);
      if (!path) continue;
      changes.push({ path, operationId: result.tool_use_id });
      seenOperationIds.add(result.tool_use_id);
    }
  }

  return changes;
}
