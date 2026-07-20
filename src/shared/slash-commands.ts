type SlashCommandLikeMessage = {
  type?: unknown;
  subtype?: unknown;
  slash_commands?: unknown;
  commands?: unknown;
};

export type SlashCommandDetail = {
  name: string;
  description?: string;
  argumentHint?: string;
  aliases?: string[];
};

export type SlashCommandCatalog = {
  names: string[];
  details: SlashCommandDetail[];
};

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

function normalizeSlashCommandDetail(value: unknown): SlashCommandDetail | null {
  if (typeof value === "string") {
    const name = normalizeSlashCommandName(value);
    return name ? { name } : null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const rawName = readOptionalString(record.name);
  const name = rawName ? normalizeSlashCommandName(rawName) : null;
  if (!name) return null;
  const aliases = Array.isArray(record.aliases)
    ? Array.from(new Set(record.aliases.flatMap((alias) => {
        const normalized = typeof alias === "string" ? normalizeSlashCommandName(alias) : null;
        return normalized && normalized.toLowerCase() !== name.toLowerCase() ? [normalized] : [];
      })))
    : undefined;

  return {
    name,
    description: readOptionalString(record.description),
    argumentHint: readOptionalString(record.argumentHint),
    ...(aliases && aliases.length > 0 ? { aliases } : {}),
  };
}

function mergeSlashCommandDetails(
  current: readonly SlashCommandDetail[],
  incoming: readonly SlashCommandDetail[],
): SlashCommandDetail[] {
  const merged = new Map<string, SlashCommandDetail>();
  for (const detail of [...current, ...incoming]) {
    const key = detail.name.toLowerCase();
    const existing = merged.get(key);
    merged.set(key, existing ? {
      name: existing.name,
      description: detail.description ?? existing.description,
      argumentHint: detail.argumentHint ?? existing.argumentHint,
      aliases: mergeSlashCommandLists(existing.aliases, detail.aliases),
    } : detail);
  }
  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function buildSlashCommandNames(details: readonly SlashCommandDetail[]): string[] {
  return mergeSlashCommandLists(details.flatMap((detail) => [detail.name, ...(detail.aliases ?? [])])) ?? [];
}

/**
 * Applies SDK slash-command events in stream order. `commands_changed` is a
 * full snapshot (including an empty one), while legacy init lists retain their
 * merge behavior for compatibility with local command discovery.
 */
export function applySlashCommandMessages(
  currentNames: readonly string[] | undefined,
  currentDetails: readonly SlashCommandDetail[] | undefined,
  messages: readonly SlashCommandLikeMessage[],
): SlashCommandCatalog | undefined {
  let changed = false;
  const normalizedCurrentDetails = (currentDetails ?? [])
    .map(normalizeSlashCommandDetail)
    .filter((item): item is SlashCommandDetail => Boolean(item));
  const namesCoveredByDetails = new Set(normalizedCurrentDetails.flatMap((detail) => (
    [detail.name, ...(detail.aliases ?? [])].map((name) => name.toLowerCase())
  )));
  let details = mergeSlashCommandDetails(
    normalizedCurrentDetails,
    (currentNames ?? [])
      .map(normalizeSlashCommandDetail)
      .filter((item): item is SlashCommandDetail => (
        Boolean(item) && !namesCoveredByDetails.has(item?.name.toLowerCase() ?? "")
      )),
  );

  for (const message of messages) {
    if (message?.type !== "system") continue;
    if (message.subtype === "init" && Array.isArray(message.slash_commands)) {
      const incoming = message.slash_commands
        .map(normalizeSlashCommandDetail)
        .filter((item): item is SlashCommandDetail => Boolean(item));
      details = mergeSlashCommandDetails(details, incoming);
      changed = true;
      continue;
    }
    if (message.subtype === "commands_changed" && Array.isArray(message.commands)) {
      details = message.commands
        .map(normalizeSlashCommandDetail)
        .filter((item): item is SlashCommandDetail => Boolean(item))
        .sort((left, right) => left.name.localeCompare(right.name));
      changed = true;
    }
  }

  return changed ? { names: buildSlashCommandNames(details), details } : undefined;
}

export function extractSlashCommandsFromMessages(messages?: SlashCommandLikeMessage[]): string[] | undefined {
  if (!messages?.length) {
    return undefined;
  }
  return applySlashCommandMessages(undefined, undefined, messages)?.names;
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
