import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { discoverSlashCommandsInRoots } from "./libs/slash-command-discovery.js";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../shared/slash-commands.js";

test("discoverSlashCommandsInRoots collects project and user markdown command files", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-commands-"));

  try {
    const userRoot = join(sandboxRoot, "user");
    const projectRoot = join(sandboxRoot, "project");
    mkdirSync(join(userRoot, "commands"), { recursive: true });
    mkdirSync(join(projectRoot, "commands", "nested"), { recursive: true });
    mkdirSync(join(projectRoot, "skills", "speckit-specify"), { recursive: true });

    writeFileSync(join(userRoot, "commands", "review.md"), "# /review\n", "utf8");
    writeFileSync(join(projectRoot, "commands", "speckit.specify.md"), "# /speckit.specify\n", "utf8");
    writeFileSync(join(projectRoot, "commands", "nested", "quality.md"), "# /nested.quality\n", "utf8");
    writeFileSync(join(projectRoot, "skills", "speckit-specify", "SKILL.md"), "# skill\n", "utf8");

    const commands = discoverSlashCommandsInRoots({
      user: userRoot,
      project: projectRoot,
    });

    assert.deepEqual(commands, ["nested.quality", "review", "speckit-specify", "speckit.specify"]);
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("slash command sources merge local commands with runtime init commands", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-commands-"));

  try {
    const projectRoot = join(sandboxRoot, "project");
    mkdirSync(join(projectRoot, "commands"), { recursive: true });
    writeFileSync(join(projectRoot, "commands", "speckit.specify.md"), "# /speckit.specify\n", "utf8");

    const commands = mergeSlashCommandLists(
      discoverSlashCommandsInRoots({ project: projectRoot }),
      extractSlashCommandsFromMessages([
        {
          type: "system",
          subtype: "init",
          slash_commands: ["/debug", "speckit.specify"],
        },
      ]),
    );

    assert.deepEqual(commands, ["debug", "speckit.specify"]);
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("extractSlashCommandsFromMessages ignores non-init messages", () => {
  const commands = extractSlashCommandsFromMessages([
    { type: "assistant", subtype: "message", slash_commands: ["/ignored"] },
    { type: "system", subtype: "init", slash_commands: ["/valid", "/second"] },
  ]);

  assert.deepEqual(commands, ["second", "valid"]);
});
