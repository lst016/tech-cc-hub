import type { SandboxSettings } from "@anthropic-ai/claude-agent-sdk";

const CREDENTIAL_READ_DENY_PATTERNS = [
  "~/.ssh/**",
  "~/.aws/**",
  "~/.azure/**",
  "~/.config/gh/**",
  "~/.config/gcloud/**",
  "~/.docker/config.json",
  "~/.claude/.credentials.json",
  "~/.claude/credentials/**",
  "~/.claude.json",
  "~/.git-credentials",
  "~/.npmrc",
  "~/.netrc",
  "**/.env",
  "**/.env.*",
  "**/.mcp.json",
  "**/.npmrc",
  "/etc/shadow",
  "/etc/sudoers",
] as const;

const CREDENTIAL_ENV_DENY_NAMES = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "OPENAI_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AZURE_CLIENT_SECRET",
  "GOOGLE_API_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
] as const;

const CREDENTIAL_ENV_MASK_RULES = [
  { name: "GITHUB_TOKEN", mode: "mask", injectHosts: ["github.com", "api.github.com"] },
  { name: "GH_TOKEN", mode: "mask", injectHosts: ["github.com", "api.github.com"] },
  { name: "NPM_TOKEN", mode: "mask", injectHosts: ["registry.npmjs.org"] },
] as const;

const CREDENTIAL_PATH_PATTERN = /(?:^|[\\/])(?:\.ssh|\.aws|\.azure)(?:[\\/]|$)|(?:^|[\\/])\.config[\\/](?:gh|gcloud)(?:[\\/]|$)|(?:^|[\\/])\.docker[\\/]config\.json$|(?:^|[\\/])\.claude(?:[\\/](?:\.credentials\.json|credentials(?:[\\/]|$)))|(?:^|[\\/])(?:\.claude\.json|\.git-credentials|\.npmrc|\.netrc|\.mcp\.json|\.env(?:\.[^\\/]*)?)$|^[/\\]etc[/\\](?:shadow|sudoers)$/i;
const CREDENTIAL_ENV_NAME_PATTERN = new RegExp(
  `\\b(?:${[...CREDENTIAL_ENV_DENY_NAMES, ...CREDENTIAL_ENV_MASK_RULES.map(({ name }) => name)].join("|")})\\b`,
  "i",
);
const BROAD_ENVIRONMENT_READ_PATTERN = /(?:^|[;&|]\s*)(?:env|printenv|set)\s*(?:$|[;&|])|\bprocess\.env\b|\bos\.environ\b/i;

export type ClaudeSandboxPolicyOptions = {
  enabled: boolean;
  failIfUnavailable?: boolean;
  workspaceRoot?: string;
  additionalWriteRoots?: string[];
  environment?: Record<string, string | undefined>;
};

export function isLikelyCredentialEnvName(name: string): boolean {
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(name)) return false;
  const upper = name.toUpperCase();
  if (upper === "ANTHROPIC_BASE_URL" || upper === "ANTHROPIC_MODEL") return false;
  // Match complete underscore-delimited markers so ordinary runtime variables
  // such as PATH, CLASSPATH, and API_BASE_URL keep working inside the sandbox.
  const credentialMarker = /(?:^|_)(?:TOKEN|KEY|SECRET|PASSWORD|PASS|AUTH|CREDENTIALS?|BEARER|PAT)(?:_|$)/;
  const connectionCredentialMarker = /(?:^|_)(?:DSN|CONNECTION_STRING)(?:_|$)|(?:^|_)(?:DATABASE|POSTGRES(?:QL)?|MYSQL|MARIADB|MONGO(?:DB)?|REDIS|ELASTIC(?:SEARCH)?|KAFKA|RABBITMQ|AMQP|SMTP|SENTRY|JDBC)_(?:URL|URI)(?:_|$)/;
  return credentialMarker.test(upper) || connectionCredentialMarker.test(upper);
}

function normalizeWorkspacePattern(workspaceRoot: string | undefined): string | null {
  const trimmed = workspaceRoot?.trim();
  if (!trimmed) return null;
  return `${trimmed.replace(/\\/g, "/").replace(/\/+$/, "")}/**`;
}

export function buildClaudeSandboxSettings(options: ClaudeSandboxPolicyOptions): SandboxSettings {
  const workspacePattern = normalizeWorkspacePattern(options.workspaceRoot);
  const allowWrite = [
    workspacePattern,
    ...(options.additionalWriteRoots ?? []).map(normalizeWorkspacePattern),
  ].filter((pattern): pattern is string => Boolean(pattern));
  const maskedEnvNames = new Set<string>(CREDENTIAL_ENV_MASK_RULES.map(({ name }) => name));
  const credentialEnvDenyNames = [...new Set([
    ...CREDENTIAL_ENV_DENY_NAMES,
    ...Object.entries(options.environment ?? process.env)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([name]) => name)
      .filter(isLikelyCredentialEnvName)
      .filter((name) => !maskedEnvNames.has(name.toUpperCase())),
  ])];

  return {
    enabled: options.enabled,
    failIfUnavailable: options.failIfUnavailable ?? false,
    autoAllowBashIfSandboxed: false,
    allowUnsandboxedCommands: !options.enabled,
    filesystem: {
      denyRead: [...CREDENTIAL_READ_DENY_PATTERNS],
      ...(allowWrite.length > 0 ? { allowWrite: [...new Set(allowWrite)] } : {}),
    },
    network: {
      allowLocalBinding: true,
      allowUnixSockets: [],
    },
    credentials: {
      files: CREDENTIAL_READ_DENY_PATTERNS.map((path) => ({ path, mode: "deny" as const })),
      envVars: [
        ...credentialEnvDenyNames.map((name) => ({ name, mode: "deny" as const })),
        ...CREDENTIAL_ENV_MASK_RULES.map(({ name, mode, injectHosts }) => ({
          name,
          mode,
          injectHosts: [...injectHosts],
        })),
      ],
      allowPlaintextInject: false,
    },
  };
}

/**
 * Fail-closed credential guard for tool calls. Sandbox credential isolation can
 * gracefully degrade on unsupported hosts, so this remains active in every
 * permission mode.
 */
export function getClaudeCredentialAccessDenyMessage(
  toolName: string,
  input: Record<string, unknown>,
): string | undefined {
  const pathKeys = toolName === "Glob"
    ? ["path", "pattern"]
    : toolName === "Grep" || toolName === "Search"
      ? ["path"]
      : ["file_path", "path"];
  if (
    ["Read", "Edit", "Write", "MultiEdit", "Glob", "Grep", "Search"].includes(toolName)
    && pathKeys.some((key) => typeof input[key] === "string" && CREDENTIAL_PATH_PATTERN.test(input[key]))
  ) {
    return "Access to host credential files is blocked by the tech-cc-hub runtime policy.";
  }

  if (toolName === "Bash" && typeof input.command === "string") {
    if (
      CREDENTIAL_PATH_PATTERN.test(input.command)
      || CREDENTIAL_ENV_NAME_PATTERN.test(input.command)
      || BROAD_ENVIRONMENT_READ_PATTERN.test(input.command)
    ) {
      return "Shell access to host credentials is blocked by the tech-cc-hub runtime policy.";
    }
  }

  return undefined;
}
