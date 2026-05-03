import { homedir } from "os";
import { join } from "path";

import { app } from "electron";

import type { StreamMessage } from "../types.js";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../shared/slash-commands.js";
import { discoverSlashCommandItemsInRoots, discoverSlashCommandsInRoots, type SlashCommandItem, type SlashCommandRoots } from "./slash-command-discovery.js";

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

  for (const item of discoveredItems) {
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
