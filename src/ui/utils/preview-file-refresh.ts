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

function pushUniquePath(paths: string[], path: unknown) {
  if (typeof path !== 'string') return;
  const trimmed = path.trim();
  if (!trimmed) return;
  if (!paths.some((existing) => normalizePreviewFilePath(existing) === normalizePreviewFilePath(trimmed))) {
    paths.push(trimmed);
  }
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

function collectInputFilePaths(input: unknown): string[] {
  const paths: string[] = [];
  if (typeof input === 'string') {
    return collectPatchFilePaths(input);
  }
  if (!isRecord(input)) return paths;

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
    for (const path of collectPatchFilePaths(patch)) {
      pushUniquePath(paths, path);
    }
  }

  return paths;
}

function getWriteToolPaths(content: ToolUseContent): string[] {
  if (content.type !== 'tool_use') return [];
  if (typeof content.name !== 'string' || !isWriteToolName(content.name)) return [];
  return collectInputFilePaths(content.input);
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
  const pendingWriteToolPaths = new Map<string, string[]>();
  const changes: PreviewFileChangeEvent[] = [];
  const seenOperationIds = new Set<string>();

  for (const message of messages) {
    if (!isRecord(message) || typeof message.type !== 'string') continue;
    const contents = getMessageContent(message);

    if (message.type === 'assistant') {
      for (const content of contents) {
        if (!isRecord(content)) continue;
        const paths = getWriteToolPaths(content);
        if (!paths.length || typeof content.id !== 'string') continue;
        pendingWriteToolPaths.set(content.id, paths);
      }
      continue;
    }

    if (message.type !== 'user') continue;
    for (const content of contents) {
      if (!isRecord(content)) continue;
      const result = content as ToolResultContent;
      if (result.type !== 'tool_result' || typeof result.tool_use_id !== 'string') continue;
      if (result.is_error) continue;
      const paths = pendingWriteToolPaths.get(result.tool_use_id);
      if (!paths?.length) continue;

      for (const path of paths) {
        const operationId = paths.length === 1
          ? result.tool_use_id
          : `${result.tool_use_id}:${normalizePreviewFilePath(path)}`;
        if (seenOperationIds.has(operationId)) continue;
        changes.push({ path, operationId });
        seenOperationIds.add(operationId);
      }
    }
  }

  return changes;
}
