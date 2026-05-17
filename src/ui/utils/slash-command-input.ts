export type SlashCommandInputContext = {
  start: number;
  end: number;
  query: string;
};

export function getSlashCommandContext(promptValue: string, cursorIndex = promptValue.length): SlashCommandInputContext | null {
  const safeCursor = Math.max(0, Math.min(cursorIndex, promptValue.length));
  const beforeCursor = promptValue.slice(0, safeCursor);
  const match = beforeCursor.match(/(^|[\s([{"'`，。；：！？])\/([A-Za-z0-9_.:-]*)$/u);
  if (!match) return null;

  const query = match[2] ?? "";
  if (query.includes("/") || query.includes("\\")) return null;
  return {
    start: safeCursor - query.length - 1,
    end: safeCursor,
    query,
  };
}

export function isCompletedSlashCommandContext(promptValue: string, context: SlashCommandInputContext | null): boolean {
  if (!context) return false;
  return /\s/u.test(promptValue[context.end] ?? "");
}

function getLeadingSlashCommandQuery(promptValue: string): string | null {
  const value = promptValue.trimStart();
  if (!value.startsWith("/")) return null;

  const token = value.slice(1).split(/\s+/)[0]?.trim() ?? "";
  if (token.includes("/") || token.includes("\\")) return null;
  return token;
}

export function getSlashCommandQuery(promptValue: string, cursorIndex?: number): string | null {
  if (typeof cursorIndex !== "number") {
    return getLeadingSlashCommandQuery(promptValue);
  }
  const context = getSlashCommandContext(promptValue, cursorIndex);
  if (isCompletedSlashCommandContext(promptValue, context)) return null;
  return context?.query ?? null;
}

export function isDismissedSlashCommandQuery(
  promptValue: string,
  dismissedSlashQuery: string | null,
  showSlashBrowser: boolean,
  cursorIndex?: number,
): boolean {
  if (showSlashBrowser || !dismissedSlashQuery) return false;
  const slashQuery = getSlashCommandQuery(promptValue, cursorIndex);
  return slashQuery !== null && slashQuery.toLowerCase() === dismissedSlashQuery;
}
