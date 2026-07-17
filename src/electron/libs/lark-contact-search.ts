export type LarkContactOption = {
  openId: string;
  name: string;
  department?: string;
};

type LarkCliResponse = {
  ok?: boolean;
  data?: {
    users?: Array<{
      open_id?: unknown;
      localized_name?: unknown;
      department?: unknown;
      is_activated?: unknown;
    }>;
  };
  error?: {
    message?: unknown;
  };
};

export type LarkContactCliConfig = {
  command: string;
  runtimeEnv: NodeJS.ProcessEnv;
};

export type LarkContactCliInvoker = (
  command: string,
  args: string[],
  runtimeEnv: NodeJS.ProcessEnv,
) => Promise<{ stdout: string; stderr: string }>;

type LarkCliAuthStatus = {
  ok?: unknown;
  identity?: unknown;
  verified?: unknown;
  tokenStatus?: unknown;
  scope?: unknown;
  identities?: {
    user?: unknown;
  };
  error?: {
    message?: unknown;
  };
};

const CONTACT_SEARCH_TIMEOUT_MS = 8_000;
const CONTACT_SEARCH_LIMIT = 20;
const CONTACT_SEARCH_SCOPE = "contact:user:search";
const LARK_CLI_SETUP_HINT = "请运行 lark-cli config init，并执行 lark-cli auth login --scope \"contact:user:search\"。";

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function resolveLarkCliConfig() {
  const { getGlobalRuntimeEnvConfig } = await import("./claude/claude-settings.js");
  const runtimeEnv = getGlobalRuntimeEnvConfig();

  return {
    command: "lark-cli",
    runtimeEnv,
  };
}

async function invokeLarkCli(command: string, args: string[], runtimeEnv: NodeJS.ProcessEnv) {
  const { runExternalCli } = await import("./external-cli.js");
  return runExternalCli(command, args, {
    timeout: CONTACT_SEARCH_TIMEOUT_MS,
    env: {
      ...process.env,
      ...runtimeEnv,
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
    },
  });
}

export function normalizeLarkContactQuery(query: unknown): string {
  const normalized = typeof query === "string" ? query.trim() : "";
  return Array.from(normalized).slice(0, 100).join("");
}

export function parseLarkContactSearchResponse(raw: string): LarkContactOption[] {
  let payload: LarkCliResponse;
  try {
    payload = JSON.parse(raw) as LarkCliResponse;
  } catch {
    throw new Error("飞书联系人搜索返回了无法解析的数据。");
  }

  if (payload.ok !== true) {
    const message = asText(payload.error?.message);
    throw new Error(message ? `飞书联系人搜索失败：${message}` : "飞书联系人搜索失败。");
  }

  const contacts: LarkContactOption[] = [];
  const seenOpenIds = new Set<string>();
  for (const user of payload.data?.users ?? []) {
    const openId = asText(user.open_id);
    const name = asText(user.localized_name);
    if (!openId || !name || user.is_activated === false || seenOpenIds.has(openId)) continue;

    seenOpenIds.add(openId);
    contacts.push({
      openId,
      name,
      department: asText(user.department),
    });
    if (contacts.length >= CONTACT_SEARCH_LIMIT) break;
  }
  return contacts;
}

function assertLarkCliUserAuthReady(raw: string) {
  let status: LarkCliAuthStatus;
  try {
    status = JSON.parse(raw) as LarkCliAuthStatus;
  } catch {
    throw new Error(`无法确认 lark-cli 配置状态，已跳过联系人搜索。${LARK_CLI_SETUP_HINT}`);
  }

  if (status.ok === false) {
    const message = asText(status.error?.message);
    throw new Error(`lark-cli 配置不可用${message ? `：${message}` : ""}，已跳过联系人搜索。${LARK_CLI_SETUP_HINT}`);
  }
  const userIdentity = isRecord(status.identities?.user) ? status.identities.user : undefined;
  const identity = asText(status.identity) ?? (userIdentity ? "user" : undefined);
  const verified = status.verified === true || userIdentity?.verified === true;
  const tokenStatus = asText(status.tokenStatus) ?? asText(userIdentity?.tokenStatus);
  if (identity !== "user" || !verified || tokenStatus !== "valid") {
    throw new Error(`lark-cli 未完成配置或用户登录，已跳过联系人搜索。${LARK_CLI_SETUP_HINT}`);
  }

  const scope = asText(status.scope) ?? asText(userIdentity?.scope) ?? "";
  const scopes = new Set(scope.split(/\s+/).filter(Boolean));
  if (!scopes.has(CONTACT_SEARCH_SCOPE)) {
    throw new Error(`lark-cli 缺少 ${CONTACT_SEARCH_SCOPE} 权限，已跳过联系人搜索。请运行 lark-cli auth login --scope "${CONTACT_SEARCH_SCOPE}"。`);
  }
}

function larkCliInvocationError(action: "检查配置" | "搜索联系人") {
  return new Error(`lark-cli ${action}失败，已跳过联系人搜索。${LARK_CLI_SETUP_HINT}`);
}

export async function searchLarkContactsWithCli(
  query: unknown,
  config: LarkContactCliConfig,
  invoke: LarkContactCliInvoker,
): Promise<LarkContactOption[]> {
  const normalizedQuery = normalizeLarkContactQuery(query);
  if (!normalizedQuery) return [];

  let statusOutput: string;
  try {
    const { stdout } = await invoke(
      config.command,
      ["auth", "status", "--verify"],
      config.runtimeEnv,
    );
    statusOutput = stdout;
  } catch {
    throw larkCliInvocationError("检查配置");
  }
  assertLarkCliUserAuthReady(statusOutput);

  const args = [
    "contact",
    "+search-user",
    "--query",
    normalizedQuery,
    "--as",
    "user",
    "--format",
    "json",
  ];
  try {
    const { stdout } = await invoke(config.command, args, config.runtimeEnv);
    return parseLarkContactSearchResponse(stdout);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("飞书联系人搜索")) throw error;
    throw larkCliInvocationError("搜索联系人");
  }
}

export async function searchLarkContacts(query: unknown): Promise<LarkContactOption[]> {
  const config = await resolveLarkCliConfig();
  return searchLarkContactsWithCli(query, config, invokeLarkCli);
}
