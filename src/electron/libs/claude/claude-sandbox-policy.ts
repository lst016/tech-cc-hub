import type { SandboxSettings } from "@anthropic-ai/claude-agent-sdk";

const CREDENTIAL_READ_DENY_PATTERNS = [
  "~/.ssh/**",
  "~/.aws/**",
  "~/.azure/**",
  "~/.config/gh/**",
  "~/.config/gcloud/**",
  "~/.docker/config.json",
  "~/.netrc",
  "/etc/shadow",
  "/etc/sudoers",
] as const;

export type ClaudeSandboxPolicyOptions = {
  enabled: boolean;
  workspaceRoot?: string;
};

function normalizeWorkspacePattern(workspaceRoot: string | undefined): string | null {
  const trimmed = workspaceRoot?.trim();
  if (!trimmed) return null;
  return `${trimmed.replace(/\\/g, "/").replace(/\/+$/, "")}/**`;
}

export function buildClaudeSandboxSettings(options: ClaudeSandboxPolicyOptions): SandboxSettings {
  const workspacePattern = normalizeWorkspacePattern(options.workspaceRoot);
  const allowWrite = workspacePattern ? [workspacePattern] : undefined;

  return {
    enabled: options.enabled,
    failIfUnavailable: false,
    autoAllowBashIfSandboxed: false,
    allowUnsandboxedCommands: !options.enabled,
    filesystem: {
      denyRead: [...CREDENTIAL_READ_DENY_PATTERNS],
      ...(allowWrite ? { allowWrite } : {}),
    },
    network: {
      allowLocalBinding: true,
      allowUnixSockets: [],
    },
  };
}
