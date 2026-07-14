export const CODEX_OAUTH_DEEP_LINK_SCHEME = "tech-cc-hub";
const CODEX_OAUTH_DEEP_LINK_PROTOCOL = `${CODEX_OAUTH_DEEP_LINK_SCHEME}:`;
const CODEX_OAUTH_DEEP_LINK_HOST = "oauth";
const CODEX_OAUTH_DEEP_LINK_PATH = "/codex";
const CODEX_OAUTH_DEEP_LINK_RESULT = "completed";
const ALLOWED_QUERY_KEYS = new Set(["attempt_id", "profile_id", "result"]);

export type CodexOAuthDeepLink = {
  attemptId: string;
  profileId: string;
};

export function buildCodexOAuthDeepLink(input: CodexOAuthDeepLink): string {
  const attemptId = input.attemptId.trim();
  const profileId = input.profileId.trim();
  if (!attemptId || !profileId) {
    throw new Error("Codex OAuth deep link requires an attempt and profile id.");
  }

  const url = new URL(`${CODEX_OAUTH_DEEP_LINK_PROTOCOL}//${CODEX_OAUTH_DEEP_LINK_HOST}${CODEX_OAUTH_DEEP_LINK_PATH}`);
  url.searchParams.set("attempt_id", attemptId);
  url.searchParams.set("profile_id", profileId);
  url.searchParams.set("result", CODEX_OAUTH_DEEP_LINK_RESULT);
  return url.toString();
}

export function parseCodexOAuthDeepLink(value: string): CodexOAuthDeepLink | null {
  try {
    const url = new URL(value);
    if (url.protocol !== CODEX_OAUTH_DEEP_LINK_PROTOCOL
      || url.hostname !== CODEX_OAUTH_DEEP_LINK_HOST
      || url.pathname !== CODEX_OAUTH_DEEP_LINK_PATH) {
      return null;
    }
    if ([...url.searchParams.keys()].some((key) => !ALLOWED_QUERY_KEYS.has(key))) {
      return null;
    }
    if (url.searchParams.get("result") !== CODEX_OAUTH_DEEP_LINK_RESULT) {
      return null;
    }
    const attemptId = url.searchParams.get("attempt_id")?.trim() ?? "";
    const profileId = url.searchParams.get("profile_id")?.trim() ?? "";
    return attemptId && profileId ? { attemptId, profileId } : null;
  } catch {
    return null;
  }
}

export function findCodexOAuthDeepLink(args: readonly string[]): CodexOAuthDeepLink | null {
  for (const arg of args) {
    const parsed = parseCodexOAuthDeepLink(arg);
    if (parsed) return parsed;
  }
  return null;
}
