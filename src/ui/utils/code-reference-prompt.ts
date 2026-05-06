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

type CodeReferencesPayload = {
  count?: number;
  items?: unknown[];
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

function parseJsonPayload(blockContent: string): CodeReferencesPayload | null {
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

export function extractCodeReferencesPrompt(prompt: string): {
  visiblePrompt: string;
  codeReferences: CodeReferencePromptSummary[];
} {
  const blocks = Array.from(prompt.matchAll(/<code_references>\s*([\s\S]*?)\s*<\/code_references>/g));
  if (blocks.length === 0) {
    return { visiblePrompt: prompt, codeReferences: [] };
  }

  const codeReferences = blocks.reduce<CodeReferencePromptSummary[]>((items, block) => {
    const payload = parseJsonPayload(block[1]);
    if (payload && Array.isArray(payload.items)) {
      payload.items.forEach((item) => {
        items.push(summarizeItem(item, items.length));
      });
      return items;
    }

    const count = payload && typeof payload.count === 'number' ? payload.count : 1;
    for (let index = 0; index < count; index += 1) {
      items.push({ index: items.length + 1, kind: 'selection' });
    }
    return items;
  }, []);

  return {
    visiblePrompt: prompt.replace(/<code_references>[\s\S]*?<\/code_references>/g, '').trim(),
    codeReferences,
  };
}
