import { homedir } from "os";
import { join } from "path";
import { readFileSync } from "fs";

import { app } from "electron";

import type { StreamMessage } from "../types.js";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../shared/slash-commands.js";
import {
  discoverSlashCommandDefinitionItemsInRoots,
  discoverSlashCommandItemsInRoots,
  discoverSlashCommandsInRoots,
  type SlashCommandDefinitionItem,
  type SlashCommandItem,
  type SlashCommandRoots,
} from "./slash-command-discovery.js";
import { CLAUDE_CODE_BUILTIN_COMMAND_ITEMS } from "./claude/claude-code-builtin-commands.js";
import { CLAUDE_CODE_COMPAT_COMMAND_ITEMS } from "./claude/claude-code-compat-registry.js";

const MAX_INVOKED_LOCAL_SLASH_DEFINITION_PROMPT_CHARS = 40_000;

export type InvokedLocalSlashDefinition = {
  name: string;
  filePath: string;
  content: string;
  definitionKind: SlashCommandDefinitionItem["definitionKind"];
};

export function resolveSlashCommandRoots(cwd?: string): SlashCommandRoots {
  const home = homedir();
  return {
    system: join(app.getPath("userData"), "system-claude"),
    user: join(home, ".claude"),
    project: cwd?.trim() ? join(cwd.trim(), ".claude") : undefined,
    skillRoots: [
      join(home, ".claude", "skills"),
      join(home, ".codex", "skills"),
      join(home, ".codex", "vendor_imports", "skills"),
      join(home, ".skills-manager", "skills"),
    ],
    skillRootContainers: [
      join(home, ".codex", "plugins", "cache"),
    ],
  };
}

export function buildSessionSlashCommands(options: {
  cwd?: string;
  messages?: StreamMessage[];
}): string[] | undefined {
  return mergeSlashCommandLists(
    CLAUDE_CODE_COMPAT_COMMAND_ITEMS.map((item) => item.name),
    CLAUDE_CODE_BUILTIN_COMMAND_ITEMS.map((item) => item.name),
    discoverSlashCommandsInRoots(resolveSlashCommandRoots(options.cwd)),
    extractSlashCommandsFromMessages(options.messages),
  );
}

export function buildSessionSlashCommandItems(options: {
  cwd?: string;
  messages?: StreamMessage[];
}): SlashCommandItem[] | undefined {
  const discoveredItems = discoverSlashCommandItemsInRoots(resolveSlashCommandRoots(options.cwd)) ?? [];
  const messageCommands = extractSlashCommandsFromMessages(options.messages) ?? [];
  const taggedDiscovered = discoveredItems.map((it) => ({ ...it, source: "local" as const }));
  const taggedBuiltin = CLAUDE_CODE_BUILTIN_COMMAND_ITEMS.map((it) => ({ ...it, source: "claude-code-builtin" as const }));
  const taggedMessage: SlashCommandItem[] = [];
  for (const name of messageCommands) {
    const normalized = name.trim().replace(/^\/+/, "");
    if (normalized) taggedMessage.push({ name: normalized, source: "message" });
  }

  // Priority: compat < builtin < local < message. We walk the groups in
  // order, so later (higher-priority) groups overwrite the slot. Description
  // backfills from the lower-priority slot when the higher-priority entry
  // is empty. The same algorithm lives in
  // scripts/claude-code-compat-sync-lib.mjs's mergeSlashCommandItemsByPriority
  // for .mjs-side testability; keep both copies in sync.
  const merged = new Map<string, SlashCommandItem>();
  const groups: SlashCommandItem[][] = [
    CLAUDE_CODE_COMPAT_COMMAND_ITEMS as SlashCommandItem[],
    taggedBuiltin,
    taggedDiscovered,
    taggedMessage,
  ];
  for (const items of groups) {
    for (const item of items) {
      if (!item || typeof item.name !== "string") continue;
      const key = item.name.trim().replace(/^\/+/, "").toLowerCase();
      if (!key) continue;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...item, name: item.name.trim().replace(/^\/+/, "") });
        continue;
      }
      merged.set(key, {
        ...existing,
        ...item,
        name: existing.name || item.name,
        description: item.description?.trim() || existing.description?.trim() || undefined,
        icon: item.icon?.trim() || existing.icon?.trim() || undefined,
      });
    }
  }
  const commands = Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
  return commands.length > 0 ? commands : undefined;
}

export function resolveInvokedLocalSlashDefinition(options: {
  cwd?: string;
  prompt: string;
}): InvokedLocalSlashDefinition | undefined {
  const commandName = extractInvokedSlashCommandName(options.prompt);
  if (!commandName) {
    return undefined;
  }

  const normalizedCommandName = normalizeSlashDefinitionName(commandName);
  const match = discoverSlashCommandDefinitionItemsInRoots(resolveSlashCommandRoots(options.cwd))
    .find((item) => normalizeSlashDefinitionName(item.name) === normalizedCommandName);

  if (!match) {
    return undefined;
  }

  try {
    return {
      name: match.name,
      filePath: match.filePath,
      content: readFileSync(match.filePath, "utf8"),
      definitionKind: match.definitionKind,
    };
  } catch {
    return undefined;
  }
}

export function buildInvokedLocalSlashDefinitionPromptAppend(prompt: string, cwd?: string): string | undefined {
  const invokedDefinition = resolveInvokedLocalSlashDefinition({ cwd, prompt });
  if (!invokedDefinition) {
    return undefined;
  }

  const content = invokedDefinition.content.length > MAX_INVOKED_LOCAL_SLASH_DEFINITION_PROMPT_CHARS
    ? `${invokedDefinition.content.slice(0, MAX_INVOKED_LOCAL_SLASH_DEFINITION_PROMPT_CHARS)}\n\n[Local Claude definition content truncated by tech-cc-hub.]`
    : invokedDefinition.content;
  const definitionLabel = invokedDefinition.definitionKind === "skill" ? "skill" : "slash command";

  return [
    "Local Claude slash definition invocation:",
    `The current user message invoked /${invokedDefinition.name}. tech-cc-hub found the matching local ${definitionLabel} definition at ${invokedDefinition.filePath}.`,
    "Follow this local Claude definition for the current turn. Do not claim it is unavailable just because Claude Code's built-in list omitted global or project .claude definitions under isolated settings.",
    "",
    "```markdown",
    content,
    "```",
  ].join("\n");
}

function extractInvokedSlashCommandName(prompt: string): string | null {
  const direct = prompt.match(/^\s*\/([A-Za-z0-9][A-Za-z0-9_.:-]*)(?=\s|$)/);
  if (direct?.[1]) {
    return direct[1];
  }

  const latestUserMessage = prompt.match(/(?:^|\n)Latest user message:\s*\/([A-Za-z0-9][A-Za-z0-9_.:-]*)(?=\s|$)/i);
  if (latestUserMessage?.[1]) {
    return latestUserMessage[1];
  }

  const attachmentWrapped = prompt.match(/(?:^|\n)User request after reading the attachments first:\s*\n\s*\/([A-Za-z0-9][A-Za-z0-9_.:-]*)(?=\s|$)/i);
  return attachmentWrapped?.[1] ?? null;
}

function normalizeSlashDefinitionName(name: string): string {
  return name.trim().replace(/^\/+/, "").toLowerCase();
}
