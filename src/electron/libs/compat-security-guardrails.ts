// src/electron/libs/compat-security-guardrails.ts
// -----------------------------------------------------------------------------
// Phase 6 of the Claude Code 2.1.161 compatibility workflow.
// Security guardrails: secret redaction, executable config path detection,
// and dangerous shell command detection. Mirrors the guardrail surface
// the Claude Code CLI has been tightening (deprecation of unsafe envs,
// secret scanning in tool output, etc.).
// -----------------------------------------------------------------------------

export const SECRET_KEY_PATTERNS: RegExp[] = [
  /\bapi[_-]?key\b/i,
  /\bsecret\b/i,
  /\btoken\b/i,
  /\bpassword\b/i,
  /\bauthorization\b/i,
  /\bOPENAI_API_KEY\b/,
  /\bANTHROPIC_API_KEY\b/,
  /\bGITHUB_TOKEN\b/,
  /\bAWS_SECRET_ACCESS_KEY\b/,
];

const SECRET_VALUE_HINT = /(?<![A-Za-z0-9])[A-Za-z0-9_\-]{20,}(?![A-Za-z0-9])/;

const REDACTED = "[REDACTED]";

export function looksLikeSecretKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  return SECRET_KEY_PATTERNS.some((p) => p.test(key));
}

// Recursively redact secret values from strings, objects, and arrays.
// Strings that look like secret keys (e.g., "ANTHROPIC_API_KEY") have their
// value replaced; long opaque tokens (20+ chars) are also redacted to be
// safe even when the key is non-standard.
export function redactSecrets<T>(input: T, depth = 0): T {
  if (depth > 12) return input;
  if (input == null) return input;
  if (typeof input === "string") {
    return redactString(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((v) => redactSecrets(v, depth + 1)) as unknown as T;
  }
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (looksLikeSecretKey(k)) {
        out[k] = REDACTED;
      } else {
        out[k] = redactSecrets(v, depth + 1);
      }
    }
    return out as unknown as T;
  }
  return input;
}

function redactString(text: string): string {
  if (!text) return text;
  // 1) key=value / key: value patterns with secret-named keys
  let out = text.replace(
    /([A-Za-z_][A-Za-z0-9_]*(?:api[_-]?key|secret|token|password|authorization))(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;]+)/gi,
    (_m, key, sep) => `${key}${sep}${REDACTED}`,
  );
  // 2) standalone long opaque tokens (20+ alnum/_/-) in non-empty text
  if (SECRET_VALUE_HINT.test(out)) {
    out = out.replace(SECRET_VALUE_HINT, REDACTED);
  }
  return out;
}

export const EXECUTABLE_CONFIG_PATTERNS: RegExp[] = [
  /(?:^|[\\/])\.npmrc$/i,
  /(?:^|[\\/])\.yarnrc$/i,
  /(?:^|[\\/])\.yarnrc\.yml$/i,
  /(?:^|[\\/])\.pnpmrc$/i,
  /(?:^|[\\/])\.pre-commit-config\.yaml$/i,
  /(?:^|[\\/])\.husky[\\/]/i,
  /(?:^|[\\/])\.devcontainer[\\/]/i,
  /(?:^|[\\/])(?:\.bashrc|\.bash_profile|\.zshrc|\.zprofile|\.profile|\.zshenv)$/i,
  /(?:^|[\\/])PowerShell[\\/]Microsoft\.PowerShell_profile\.ps1$/i,
  /(?:^|[\\/])\.ps1$/i,
];

export function isExecutableConfigPath(path: string): boolean {
  if (!path) return false;
  const normalized = path.replace(/\\/g, "/");
  return EXECUTABLE_CONFIG_PATTERNS.some((p) => p.test(normalized));
}

// Dangerous delete patterns: any rm -rf outside the workspace or with root
// targeting is treated as confirmation-required. We do NOT silently block —
// the runner can escalate to a user prompt with the reason.
const DANGEROUS_DELETE_PATTERN = /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-rf|-fr)\b/;

export type DangerousCommandResult = {
  dangerous: boolean;
  reason?: string;
  requiresConfirmation: boolean;
};

export function classifyDangerousCommand(command: string, workspaceRoot: string): DangerousCommandResult {
  if (!command) return { dangerous: false, requiresConfirmation: false };
  if (DANGEROUS_DELETE_PATTERN.test(command)) {
    // Check whether the command targets inside the workspace.
    const targets = extractDeleteTargets(command);
    const outside = targets.filter((t) => !t.startsWith(workspaceRoot) && !t.startsWith("."));
    if (outside.length > 0) {
      return {
        dangerous: true,
        reason: `rm -rf targets outside workspace: ${outside.join(", ")}`,
        requiresConfirmation: true,
      };
    }
    return {
      dangerous: true,
      reason: "rm -rf inside workspace still escalates to confirmation",
      requiresConfirmation: true,
    };
  }
  return { dangerous: false, requiresConfirmation: false };
}

function extractDeleteTargets(command: string): string[] {
  const tokens = command.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    if (tok.startsWith("-")) continue;
    if (tok === "rm" || tok === "sudo" || tok === "&&" || tok === "||" || tok === ";") continue;
    out.push(tok.replace(/^['"]|['"]$/g, ""));
  }
  return out;
}
