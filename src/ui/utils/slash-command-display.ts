export type SlashCommandDisplayOption = {
  name: string;
  description?: string;
  aliasOf?: string;
};

export type SlashCommandDraftDisplay = {
  commandName: string;
  displayName: string;
  argument: string;
  prefixLength: number;
  known: boolean;
  description?: string;
  resolvedFrom?: string;
};

export type SlashCommandDisplayPart =
  | { type: "text"; text: string }
  | {
      type: "command";
      raw: string;
      commandName: string;
      displayName: string;
      known: boolean;
      description?: string;
      resolvedFrom?: string;
    };

const ACRONYMS = new Set(["ai", "api", "db", "json", "mcp", "ocr", "pdf", "qa", "rag", "sdk", "sql", "tdd", "ui", "url"]);

function titleCaseCommandPart(part: string) {
  const lower = part.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  if (!lower) return "";
  return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`;
}

export function formatSlashCommandDisplayName(commandName: string) {
  return commandName
    .replace(/^\//, "")
    .split(/[-_:.\s]+/)
    .filter(Boolean)
    .map(titleCaseCommandPart)
    .join(" ");
}

export function serializeSlashCommandDraft(commandName: string, argument: string) {
  const normalizedName = commandName.replace(/^\//, "").trim();
  const normalizedArgument = argument.replace(/^\s+/, "");
  return `/${normalizedName}${normalizedArgument ? ` ${normalizedArgument}` : " "}`;
}

// Local alias resolution: when the user types /simplify but the catalog has
// simplify.aliasOf = "code-review", surface the primary's name and description
// in the display. This mirrors scripts/claude-code-compat-sync-lib.mjs's
// resolveSlashCommandByName so the in-UI prompt reflects the renamed primary.
function resolveAlias(typedName: string, commands: SlashCommandDisplayOption[]): {
  resolvedName: string;
  description?: string;
  known: boolean;
  resolvedFrom?: string;
} {
  const needle = typedName.trim().replace(/^\/+/, "");
  if (!needle) return { resolvedName: typedName, known: false };
  const lower = needle.toLowerCase();
  const direct = commands.find((c) => c.name.toLowerCase() === lower);
  if (direct) {
    if (direct.aliasOf) {
      const primary = commands.find((c) => c.name.toLowerCase() === direct.aliasOf!.toLowerCase());
      if (primary) {
        return { resolvedName: primary.name, description: primary.description, known: true, resolvedFrom: direct.name };
      }
    }
    return { resolvedName: direct.name, description: direct.description, known: true };
  }
  return { resolvedName: typedName, known: false };
}

export function parseSlashCommandDraft(
  promptValue: string,
  commands: SlashCommandDisplayOption[] = [],
): SlashCommandDraftDisplay | null {
  if (!promptValue.startsWith("/")) return null;

  const match = promptValue.match(/^\/([A-Za-z0-9_.:-]+)(\s+)([\s\S]*)$/);
  if (!match) return null;

  const commandName = match[1]?.trim();
  const separator = match[2] ?? "";
  if (!commandName || commandName.includes("/") || commandName.includes("\\")) return null;

  const { resolvedName, description, known, resolvedFrom } = resolveAlias(commandName, commands);

  return {
    commandName: resolvedName,
    displayName: formatSlashCommandDisplayName(resolvedName),
    argument: match[3] ?? "",
    prefixLength: 1 + commandName.length + separator.length,
    known,
    description,
    resolvedFrom,
  };
}

function resolveCommand(commandName: string, commands: SlashCommandDisplayOption[]) {
  const { resolvedName, description, known, resolvedFrom } = resolveAlias(commandName, commands);
  return {
    commandName: resolvedName,
    displayName: formatSlashCommandDisplayName(resolvedName),
    known,
    description,
    resolvedFrom,
  };
}

export function buildSlashCommandDisplayParts(
  promptValue: string,
  commands: SlashCommandDisplayOption[] = [],
): SlashCommandDisplayPart[] {
  const parts: SlashCommandDisplayPart[] = [];
  const pattern = /(^|[\s([{"'`，。；：！？])\/([A-Za-z0-9_.:-]+)(?=\s)/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(promptValue))) {
    const prefix = match[1] ?? "";
    const commandName = match[2]?.trim() ?? "";
    if (!commandName || commandName.includes("/") || commandName.includes("\\")) continue;

    const commandStart = match.index + prefix.length;
    const commandEnd = commandStart + commandName.length + 1;
    if (commandStart > cursor) {
      parts.push({ type: "text", text: promptValue.slice(cursor, commandStart) });
    }
    parts.push({
      type: "command",
      raw: promptValue.slice(commandStart, commandEnd),
      ...resolveCommand(commandName, commands),
    });
    cursor = commandEnd;
  }

  if (cursor < promptValue.length) {
    parts.push({ type: "text", text: promptValue.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ type: "text", text: promptValue }];
}
