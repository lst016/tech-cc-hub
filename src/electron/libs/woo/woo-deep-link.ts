export const WOO_AUTH_DEEP_LINK_SCHEME = "tech-cc-hub";
const WOO_AUTH_DEEP_LINK_PROTOCOL = `${WOO_AUTH_DEEP_LINK_SCHEME}:`;
const WOO_AUTH_DEEP_LINK_HOST = "woo";
const WOO_AUTH_DEEP_LINK_PATH = "/auth/callback";
const ALLOWED_QUERY_KEYS = new Set(["state", "result"]);

export type WooAuthDeepLink = {
  state: string;
  result: "completed" | "cancelled" | "failed";
};

export function parseWooAuthDeepLink(value: string): WooAuthDeepLink | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== WOO_AUTH_DEEP_LINK_PROTOCOL
      || url.hostname !== WOO_AUTH_DEEP_LINK_HOST
      || url.pathname !== WOO_AUTH_DEEP_LINK_PATH
    ) {
      return null;
    }
    if ([...url.searchParams.keys()].some((key) => !ALLOWED_QUERY_KEYS.has(key))) {
      return null;
    }

    const state = url.searchParams.get("state")?.trim() ?? "";
    const result = url.searchParams.get("result");
    if (!state || (result !== "completed" && result !== "cancelled" && result !== "failed")) {
      return null;
    }

    return { state, result };
  } catch {
    return null;
  }
}

export function findWooAuthDeepLink(args: readonly string[]): WooAuthDeepLink | null {
  for (const arg of args) {
    const parsed = parseWooAuthDeepLink(arg);
    if (parsed) return parsed;
  }
  return null;
}
