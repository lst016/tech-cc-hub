const WRITE_TOOL_NAMES = new Set([
  'apply_patch',
  'create',
  'edit',
  'multiedit',
  'patch',
  'str_replace_editor',
  'write',
  'write_file',
]);

const FILE_PATH_INPUT_KEYS = ['file_path', 'filePath', 'path', 'filename', 'file'];
const PATCH_FILE_HEADER_PATTERN = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;
const PATCH_MOVE_HEADER_PATTERN = /^\*\*\* Move to: (.+)$/gm;

export type PreviewFileChangeEvent = {
  path: string;
  operationId: string;
  operation: 'created' | 'edited' | 'deleted' | 'renamed' | 'written';
  additions: number;
  deletions: number;
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

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase().split(/[.:]/).pop() ?? name.trim().toLowerCase();
}

function isWriteToolName(name: string): boolean {
  const normalized = normalizeToolName(name);
  return WRITE_TOOL_NAMES.has(normalized) || normalized.endsWith('__write_file');
}

type PreviewFileChangeDraft = Omit<PreviewFileChangeEvent, 'operationId'>;

function countTextLines(value: unknown): number {
  if (typeof value !== 'string' || !value.length) return 0;
  return value.split(/\r\n|\r|\n/).length;
}

function pushUniquePath(paths: string[], path: unknown) {
  if (typeof path !== 'string') return;
  const trimmed = path.trim();
  if (!trimmed) return;
  if (!paths.some((existing) => normalizePreviewFilePath(existing) === normalizePreviewFilePath(trimmed))) {
    paths.push(trimmed);
  }
}

function mergeChangeDraft(changes: PreviewFileChangeDraft[], next: PreviewFileChangeDraft) {
  const normalizedPath = normalizePreviewFilePath(next.path);
  const existing = changes.find((change) => normalizePreviewFilePath(change.path) === normalizedPath);
  if (!existing) {
    changes.push(next);
    return;
  }

  existing.additions += next.additions;
  existing.deletions += next.deletions;
  existing.operation = next.operation;
}

function collectPatchFilePaths(patch: string): string[] {
  const paths: string[] = [];

  for (const pattern of [PATCH_FILE_HEADER_PATTERN, PATCH_MOVE_HEADER_PATTERN]) {
    pattern.lastIndex = 0;
    let match = pattern.exec(patch);
    while (match) {
      pushUniquePath(paths, match[1]);
      match = pattern.exec(patch);
    }
  }

  return paths;
}

function collectPatchFileChanges(patch: string): PreviewFileChangeDraft[] {
  const changes: PreviewFileChangeDraft[] = [];
  let current: PreviewFileChangeDraft | null = null;

  const commitCurrent = () => {
    if (!current) return;
    mergeChangeDraft(changes, current);
    current = null;
  };

  for (const line of patch.split(/\r\n|\r|\n/)) {
    const fileMatch = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    if (fileMatch) {
      commitCurrent();
      const action = fileMatch[1];
      current = {
        path: fileMatch[2]!.trim(),
        operation: action === 'Add' ? 'created' : action === 'Delete' ? 'deleted' : 'edited',
        additions: 0,
        deletions: 0,
      };
      continue;
    }

    const moveMatch = /^\*\*\* Move to: (.+)$/.exec(line);
    if (moveMatch) {
      if (current) {
        current.path = moveMatch[1]!.trim();
        current.operation = 'renamed';
      } else {
        current = {
          path: moveMatch[1]!.trim(),
          operation: 'renamed',
          additions: 0,
          deletions: 0,
        };
      }
      continue;
    }

    if (!current) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.additions += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.deletions += 1;
    }
  }

  commitCurrent();

  if (changes.length > 0) return changes;
  return collectPatchFilePaths(patch).map((path) => ({
    path,
    operation: 'edited',
    additions: 0,
    deletions: 0,
  }));
}

function collectEditStats(input: Record<string, unknown>): { additions: number; deletions: number } {
  let additions = countTextLines(input.new_string ?? input.newString ?? input.replacement ?? input.new_str);
  let deletions = countTextLines(input.old_string ?? input.oldString ?? input.old_str);

  const edits = input.edits;
  if (Array.isArray(edits)) {
    additions = 0;
    deletions = 0;
    for (const edit of edits) {
      if (!isRecord(edit)) continue;
      additions += countTextLines(edit.new_string ?? edit.newString ?? edit.replacement);
      deletions += countTextLines(edit.old_string ?? edit.oldString);
    }
  }

  return { additions, deletions };
}

function collectInputFileChanges(input: unknown, toolName: string): PreviewFileChangeDraft[] {
  const paths: string[] = [];
  if (typeof input === 'string') {
    return collectPatchFileChanges(input);
  }
  if (!isRecord(input)) return [];

  for (const key of FILE_PATH_INPUT_KEYS) {
    pushUniquePath(paths, input[key]);
  }

  if (Array.isArray(input.files)) {
    for (const item of input.files) {
      if (isRecord(item)) {
        for (const key of FILE_PATH_INPUT_KEYS) {
          pushUniquePath(paths, item[key]);
        }
      } else {
        pushUniquePath(paths, item);
      }
    }
  }

  const patch = input.patch ?? input.diff ?? input.content;
  if (typeof patch === 'string') {
    const patchChanges = collectPatchFileChanges(patch);
    if (patchChanges.length > 0) {
      return patchChanges;
    }
  }

  const normalizedToolName = normalizeToolName(toolName);
  const operation: PreviewFileChangeDraft['operation'] = normalizedToolName.includes('write') || normalizedToolName === 'create'
    ? 'written'
    : 'edited';
  const editStats = collectEditStats(input);
  const contentLineCount = operation === 'written' ? countTextLines(input.content) : 0;
  return paths.map((path) => ({
    path,
    operation,
    additions: Math.max(editStats.additions, contentLineCount),
    deletions: editStats.deletions,
  }));
}

function getWriteToolChanges(content: ToolUseContent): PreviewFileChangeDraft[] {
  if (content.type !== 'tool_use') return [];
  if (typeof content.name !== 'string' || !isWriteToolName(content.name)) return [];
  return collectInputFileChanges(content.input, content.name);
}

export function normalizePreviewFilePath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return /^[a-z]:\//i.test(normalized) ? normalized.toLowerCase() : normalized;
}

function isAbsolutePreviewFilePath(path: string): boolean {
  return /^[a-z]:[\\/]/i.test(path) || path.startsWith('/') || path.startsWith('\\\\');
}

function trimTrailingSeparators(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '/' || /^[a-z]:[\\/]?$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/[\\/]+$/, '');
}

function getPreviewPathSeparator(path: string): '\\' | '/' {
  return path.includes('\\') ? '\\' : '/';
}

export function resolvePreviewFileChangePath(workspace: string | undefined, path: string): string {
  const trimmedPath = path.trim();
  const trimmedWorkspace = workspace?.trim();
  if (!trimmedPath || !trimmedWorkspace || isAbsolutePreviewFilePath(trimmedPath)) {
    return trimmedPath;
  }

  const root = trimTrailingSeparators(trimmedWorkspace);
  const separator = getPreviewPathSeparator(root);
  const relativePath = trimmedPath.replace(/^[\\/]+/, '').replace(/^\.[\\/]/, '');
  return `${root}${root.endsWith('/') || root.endsWith('\\') ? '' : separator}${relativePath}`;
}

export function collectCompletedPreviewFileChanges(messages: readonly unknown[]): PreviewFileChangeEvent[] {
  const pendingWriteToolChanges = new Map<string, PreviewFileChangeDraft[]>();
  const changes: PreviewFileChangeEvent[] = [];
  const seenOperationIds = new Set<string>();

  for (const message of messages) {
    if (!isRecord(message) || typeof message.type !== 'string') continue;
    const contents = getMessageContent(message);

    if (message.type === 'assistant') {
      for (const content of contents) {
        if (!isRecord(content)) continue;
        const toolChanges = getWriteToolChanges(content);
        if (!toolChanges.length || typeof content.id !== 'string') continue;
        pendingWriteToolChanges.set(content.id, toolChanges);
      }
      continue;
    }

    if (message.type !== 'user') continue;
    for (const content of contents) {
      if (!isRecord(content)) continue;
      const result = content as ToolResultContent;
      if (result.type !== 'tool_result' || typeof result.tool_use_id !== 'string') continue;
      if (result.is_error) continue;
      const toolChanges = pendingWriteToolChanges.get(result.tool_use_id);
      if (!toolChanges?.length) continue;

      for (const change of toolChanges) {
        const operationId = toolChanges.length === 1
          ? result.tool_use_id
          : `${result.tool_use_id}:${normalizePreviewFilePath(change.path)}`;
        if (seenOperationIds.has(operationId)) continue;
        changes.push({ ...change, operationId });
        seenOperationIds.add(operationId);
      }
    }
  }

  return changes;
}
