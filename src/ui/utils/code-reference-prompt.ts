export type CodeReferencePromptSummary = {
  index: number;
  kind: 'comment' | 'selection';
  filePath?: string;
  fileName?: string;
  language?: string;
  rangeLabel?: string;
  startLine?: number;
  endLine?: number;
  comment?: string;
  selectionPreview?: string;
};

export type FileReferencePromptSummary = {
  index: number;
  kind: 'file' | 'directory';
  filePath?: string;
  fileName?: string;
  label?: string;
  workspaceRoot?: string;
};

export type MessageReferencePromptSummary = {
  index: number;
  kind: 'message' | 'selection';
  sourceRole?: 'user' | 'assistant' | 'tool' | 'system';
  sourceLabel?: string;
  capturedAt?: number;
  textPreview?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecordString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getRecordNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseJsonPayload(blockContent: string): Record<string, unknown> | null {
  const start = blockContent.indexOf('{');
  const end = blockContent.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(blockContent.slice(start, end + 1));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getReferenceItems(payload: Record<string, unknown> | null): unknown[] | null {
  return Array.isArray(payload?.items) ? payload.items : null;
}

function getReferenceFallbackCount(payload: Record<string, unknown> | null) {
  const count = payload?.count;
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 1;
}

function getFileNameFromPath(path?: string): string | undefined {
  if (!path) return undefined;
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function summarizeItem(item: unknown, index: number): CodeReferencePromptSummary {
  if (!isRecord(item)) {
    return { index: index + 1, kind: 'selection' };
  }

  const file = isRecord(item.file) ? item.file : undefined;
  const range = isRecord(item.range) ? item.range : undefined;
  const selection = isRecord(item.selection) ? item.selection : undefined;
  const filePath = getRecordString(file, 'path');
  const type = getRecordString(item, 'type');

  return {
    index: getRecordNumber(item, 'index') ?? index + 1,
    kind: type === 'code_comment' ? 'comment' : 'selection',
    filePath,
    fileName: getRecordString(file, 'name') ?? getFileNameFromPath(filePath),
    language: getRecordString(file, 'language'),
    rangeLabel: getRecordString(range, 'label'),
    startLine: getRecordNumber(range, 'startLine'),
    endLine: getRecordNumber(range, 'endLine'),
    comment: getRecordString(item, 'comment'),
    selectionPreview: getRecordString(selection, 'text'),
  };
}

function extractTaggedReferencesPrompt<T>(
  prompt: string,
  tagName: 'code_references' | 'file_references' | 'message_references',
  summarizeItem: (item: unknown, index: number) => T,
  buildFallback: (index: number) => T,
): {
  visiblePrompt: string;
  references: T[];
} {
  const blockPattern = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'g');
  const removePattern = new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, 'g');
  const blocks = Array.from(prompt.matchAll(blockPattern));
  if (blocks.length === 0) {
    return { visiblePrompt: prompt, references: [] };
  }

  const references = blocks.reduce<T[]>((items, block) => {
    const payload = parseJsonPayload(block[1]);
    const payloadItems = getReferenceItems(payload);
    if (payloadItems) {
      payloadItems.forEach((item) => {
        items.push(summarizeItem(item, items.length));
      });
      return items;
    }

    const count = getReferenceFallbackCount(payload);
    for (let index = 0; index < count; index += 1) {
      items.push(buildFallback(items.length));
    }
    return items;
  }, []);

  return {
    visiblePrompt: prompt.replace(removePattern, '').trim(),
    references,
  };
}

export function extractCodeReferencesPrompt(prompt: string): {
  visiblePrompt: string;
  codeReferences: CodeReferencePromptSummary[];
} {
  const result = extractTaggedReferencesPrompt<CodeReferencePromptSummary>(
    prompt,
    'code_references',
    summarizeItem,
    (index) => ({ index: index + 1, kind: 'selection' }),
  );

  return {
    visiblePrompt: result.visiblePrompt,
    codeReferences: result.references,
  };
}

function summarizeFileReferenceItem(item: unknown, index: number): FileReferencePromptSummary {
  if (!isRecord(item)) {
    return { index: index + 1, kind: 'file' };
  }

  const file = isRecord(item.file) ? item.file : undefined;
  const filePath = getRecordString(file, 'path');
  const itemType = getRecordString(item, 'type');
  const fileKind = getRecordString(file, 'kind');
  const kind = itemType === 'directory_reference' || fileKind === 'directory' ? 'directory' : 'file';

  return {
    index: getRecordNumber(item, 'index') ?? index + 1,
    kind,
    filePath,
    fileName: getRecordString(file, 'name') ?? getFileNameFromPath(filePath),
    label: getRecordString(file, 'label') ?? getRecordString(file, 'name') ?? getFileNameFromPath(filePath),
    workspaceRoot: getRecordString(file, 'workspaceRoot'),
  };
}

export function extractFileReferencesPrompt(prompt: string): {
  visiblePrompt: string;
  fileReferences: FileReferencePromptSummary[];
} {
  const result = extractTaggedReferencesPrompt<FileReferencePromptSummary>(
    prompt,
    'file_references',
    summarizeFileReferenceItem,
    (index) => ({ index: index + 1, kind: 'file' }),
  );

  return {
    visiblePrompt: result.visiblePrompt,
    fileReferences: result.references,
  };
}

function getSourceRole(value?: string): MessageReferencePromptSummary['sourceRole'] {
  return value === 'user' || value === 'assistant' || value === 'tool' || value === 'system'
    ? value
    : undefined;
}

function summarizeMessageReferenceItem(item: unknown, index: number): MessageReferencePromptSummary {
  if (!isRecord(item)) {
    return { index: index + 1, kind: 'message' };
  }

  const source = isRecord(item.source) ? item.source : undefined;
  const selection = isRecord(item.selection) ? item.selection : undefined;
  const itemType = getRecordString(item, 'type');

  return {
    index: getRecordNumber(item, 'index') ?? index + 1,
    kind: itemType === 'message_selection' ? 'selection' : 'message',
    sourceRole: getSourceRole(getRecordString(source, 'role')),
    sourceLabel: getRecordString(source, 'label'),
    capturedAt: getRecordNumber(source, 'capturedAt'),
    textPreview: getRecordString(selection, 'text'),
  };
}

export function extractMessageReferencesPrompt(prompt: string): {
  visiblePrompt: string;
  messageReferences: MessageReferencePromptSummary[];
} {
  const result = extractTaggedReferencesPrompt<MessageReferencePromptSummary>(
    prompt,
    'message_references',
    summarizeMessageReferenceItem,
    (index) => ({ index: index + 1, kind: 'message' }),
  );

  return {
    visiblePrompt: result.visiblePrompt,
    messageReferences: result.references,
  };
}
