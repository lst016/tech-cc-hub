import { mkdirSync } from "fs";
import { isAbsolute, relative, resolve } from "path";

import type { StoredTask } from "./task-types.js";
import type { TaskWorkflowConfig } from "./task-workflow.js";

export function ensureTaskWorkspace(task: StoredTask, config: TaskWorkflowConfig): string {
  const root = resolve(config.workspace.root);
  const folderName = buildWorkspaceFolderName(task);
  const workspacePath = resolve(root, folderName);
  assertInsideRoot(workspacePath, root);
  mkdirSync(workspacePath, { recursive: true });
  return workspacePath;
}

function buildWorkspaceFolderName(task: StoredTask): string {
  const provider = sanitizeSegment(task.provider);
  const externalId = sanitizeSegment(task.externalId).slice(0, 48) || sanitizeSegment(task.id).slice(0, 16);
  const title = sanitizeSegment(task.title).slice(0, 48);
  return [provider, externalId, title].filter(Boolean).join("__");
}

function sanitizeSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function assertInsideRoot(targetPath: string, root: string): void {
  const relation = relative(root, targetPath);
  if (relation === "" || (!relation.startsWith("..") && !isAbsolute(relation))) return;
  throw new Error(`Task workspace escaped root: ${targetPath}`);
}
