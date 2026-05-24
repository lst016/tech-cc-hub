export type LinkedWorkspaceContext = {
  primaryCwd: string;
  linkedCwds: string[];
};

export const LINKED_WORKSPACE_BLOCK_TAG = "linked_workspaces";

export function normalizeWorkspacePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "/") return trimmed;
  return trimmed.replace(/[\\/]+$/g, "");
}

export function normalizeLinkedWorkspaceContext(input: {
  primaryCwd?: string;
  linkedCwds?: string[];
}): LinkedWorkspaceContext | null {
  const primaryCwd = normalizeWorkspacePath(input.primaryCwd ?? "");
  if (!primaryCwd) return null;

  const linkedCwds = Array.from(
    new Set(
      (input.linkedCwds ?? [])
        .map((item) => normalizeWorkspacePath(item))
        .filter((item) => item && item !== primaryCwd),
    ),
  );

  if (linkedCwds.length === 0) return null;
  return { primaryCwd, linkedCwds };
}

export function shellQuotePath(path: string): string {
  return `'${path.replace(/'/g, "'\\''")}'`;
}

export function buildLinkedWorkspacePromptAppend(context: LinkedWorkspaceContext | null | undefined): string {
  const normalized = context ? normalizeLinkedWorkspaceContext(context) : null;
  if (!normalized) return "";

  const commandExamples = normalized.linkedCwds.map((path) => `- ${path}: cd ${shellQuotePath(path)} && <command>`);

  // 这段是给 agent 的隐藏执行上下文，UI 历史里只保留用户原始输入。
  return [
    `<${LINKED_WORKSPACE_BLOCK_TAG}>`,
    `Primary workspace (cwd): ${normalized.primaryCwd}`,
    "Additional linked workspaces for this run:",
    ...normalized.linkedCwds.map((path) => `- ${path}`),
    "Command routing rule:",
    "- Keep the primary cwd for tasks that belong to the primary workspace.",
    "- When a request targets a linked workspace, run shell commands from that workspace instead of accidentally operating under the primary cwd.",
    "- Before editing a file, choose the workspace that owns the target path; do not create a duplicate under the primary cwd when the file belongs to a linked workspace.",
    "- If a command needs both workspaces, run it from the workspace that owns the tool/config being invoked and reference the other workspace by absolute path.",
    "Shell command examples for linked workspaces:",
    ...commandExamples,
    `</${LINKED_WORKSPACE_BLOCK_TAG}>`,
  ].join("\n");
}

export function mergePromptWithLinkedWorkspaceContext(prompt: string, context: LinkedWorkspaceContext | null | undefined): string {
  if (prompt.includes(`<${LINKED_WORKSPACE_BLOCK_TAG}>`)) return prompt;
  const linkedPrompt = buildLinkedWorkspacePromptAppend(context);
  if (!linkedPrompt) return prompt;
  return [prompt.trim(), linkedPrompt].filter(Boolean).join("\n\n");
}
