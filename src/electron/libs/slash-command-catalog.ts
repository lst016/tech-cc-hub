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
import { CLAUDE_CODE_BUILTIN_COMMAND_ITEMS } from "./claude-code-builtin-commands.js";
import { CLAUDE_CODE_COMPAT_COMMAND_ITEMS } from "./claude-code-compat-registry.js";

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
  const merged = new Map<string, SlashCommandItem>();

  for (const item of CLAUDE_CODE_COMPAT_COMMAND_ITEMS) {
    merged.set(item.name.toLowerCase(), item);
  }

  for (const item of discoveredItems) {
    merged.set(item.name.toLowerCase(), item);
  }

  for (const item of CLAUDE_CODE_BUILTIN_COMMAND_ITEMS) {
    merged.set(item.name.toLowerCase(), item);
  }

  for (const name of messageCommands) {
    const normalized = name.trim().replace(/^\/+/, "");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, { name: normalized });
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
