import { normalizePreviewFilePath } from './preview-file-refresh.js';

function trimTrailingPreviewSeparators(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '/' || /^[a-z]:[\\/]?$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/[\\/]+$/, '');
}

function getPreferredSeparator(path: string): '\\' | '/' {
  return path.includes('\\') ? '\\' : '/';
}

function appendPreviewPathSegment(basePath: string, segment: string): string {
  const separator = getPreferredSeparator(basePath);
  const needsSeparator = !basePath.endsWith('/') && !basePath.endsWith('\\');
  return `${basePath}${needsSeparator ? separator : ''}${segment}`;
}

export function isPreviewFileInsideWorkspace(workspace: string, filePath: string): boolean {
  const normalizedWorkspace = normalizePreviewFilePath(trimTrailingPreviewSeparators(workspace));
  const normalizedFilePath = normalizePreviewFilePath(trimTrailingPreviewSeparators(filePath));
  return normalizedFilePath === normalizedWorkspace || normalizedFilePath.startsWith(`${normalizedWorkspace}/`);
}

export function getPreviewFileAncestorDirectories(workspace: string, filePath: string): string[] {
  const workspaceRoot = trimTrailingPreviewSeparators(workspace);
  const targetPath = trimTrailingPreviewSeparators(filePath);
  if (!workspaceRoot || !targetPath || !isPreviewFileInsideWorkspace(workspaceRoot, targetPath)) {
    return [];
  }

  const normalizedWorkspace = normalizePreviewFilePath(workspaceRoot);
  const unifiedTargetPath = targetPath.replace(/\\/g, '/');
  const relativePath = unifiedTargetPath.slice(normalizedWorkspace.length).replace(/^\/+/, '');
  const segments = relativePath.split('/').filter(Boolean);
  const directories = [workspaceRoot];

  let currentPath = workspaceRoot;
  for (const segment of segments.slice(0, -1)) {
    currentPath = appendPreviewPathSegment(currentPath, segment);
    directories.push(currentPath);
  }

  return directories;
}
