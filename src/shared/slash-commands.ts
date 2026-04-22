type SlashCommandLikeMessage = {
  type?: unknown;
  subtype?: unknown;
  slash_commands?: unknown;
};

export function extractSlashCommandsFromMessages(messages?: SlashCommandLikeMessage[]): string[] | undefined {
  if (!messages?.length) {
    return undefined;
  }

  for (const message of messages) {
    if (
      message?.type === "system" &&
      message.subtype === "init" &&
      Array.isArray(message.slash_commands)
    ) {
      return mergeSlashCommandLists(message.slash_commands);
    }
  }

  return undefined;
}

export function mergeSlashCommandLists(...lists: Array<readonly unknown[] | undefined>): string[] | undefined {
  const merged = new Map<string, string>();

  for (const list of lists) {
    if (!list?.length) {
      continue;
    }

    for (const value of list) {
      if (typeof value !== "string") {
        continue;
      }

      const normalized = normalizeSlashCommandName(value);
      if (!normalized) {
        continue;
      }

      const key = normalized.toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, normalized);
      }
    }
  }

  const commands = Array.from(merged.values()).sort((left, right) => left.localeCompare(right));
  return commands.length > 0 ? commands : undefined;
}

function normalizeSlashCommandName(value: string): string | null {
  const normalized = value.trim().replace(/^\/+/, "").replace(/\.+/g, ".").replace(/^\.+|\.+$/g, "");
  return normalized || null;
}
