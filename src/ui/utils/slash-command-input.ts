export function getSlashCommandQuery(promptValue: string): string | null {
  const value = promptValue.trimStart();
  if (!value.startsWith("/")) return null;

  const token = value.slice(1).split(/\s+/)[0]?.trim() ?? "";
  if (token.includes("/") || token.includes("\\")) return null;
  return token;
}

export function isDismissedSlashCommandQuery(
  promptValue: string,
  dismissedSlashQuery: string | null,
  showSlashBrowser: boolean,
): boolean {
  if (showSlashBrowser || !dismissedSlashQuery) return false;
  const slashQuery = getSlashCommandQuery(promptValue);
  return slashQuery !== null && slashQuery.toLowerCase() === dismissedSlashQuery;
}
