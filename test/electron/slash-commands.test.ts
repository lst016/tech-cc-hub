import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  clearSlashCommandDiscoveryCache,
  discoverSkillDefinitionItemsInRoots,
  discoverSlashCommandDefinitionItemsInRoots,
  discoverSlashCommandItemsInRoots,
  discoverSlashCommandsInRoots,
} from "../../src/electron/libs/slash-command-discovery.js";
import { CLAUDE_CODE_BUILTIN_COMMAND_ITEMS } from "../../src/electron/libs/claude-code-builtin-commands.js";
import { extractSlashCommandsFromMessages, mergeSlashCommandLists } from "../../src/shared/slash-commands.js";

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

test("Claude Code built-in slash command seed includes stable default commands", () => {
  const names = CLAUDE_CODE_BUILTIN_COMMAND_ITEMS.map((item) => item.name);

  for (const expected of ["help", "init", "doctor", "model", "skills", "goal"]) {
    assert.ok(names.includes(expected), `expected /${expected} in built-in slash command seed`);
  }
});

test("slash command discovery returns cloned cached results", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-commands-"));

  try {
    const projectRoot = join(sandboxRoot, "project");
    mkdirSync(join(projectRoot, "commands"), { recursive: true });
    writeFileSync(join(projectRoot, "commands", "review.md"), "# /review\n", "utf8");

    clearSlashCommandDiscoveryCache();
    const first = discoverSlashCommandItemsInRoots({ project: projectRoot });
    assert.equal(first?.[0]?.name, "review");

    first?.push({ name: "mutated" });
    const second = discoverSlashCommandItemsInRoots({ project: projectRoot });

    assert.deepEqual(second?.map((item) => item.name), ["review"]);
  } finally {
    clearSlashCommandDiscoveryCache();
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("skill definition discovery returns the matched SKILL.md path", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-skill-definition-"));

  try {
    const userRoot = join(sandboxRoot, "user");
    const skillDir = join(userRoot, "skills", "test-scan");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\ndescription: test skill\n---\n# Test Scan\n", "utf8");

    const skills = discoverSkillDefinitionItemsInRoots({ user: userRoot });

    assert.deepEqual(skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      filePath: skill.filePath,
    })), [{
      name: "test-scan",
      description: "test skill",
      filePath: join(skillDir, "SKILL.md"),
    }]);
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("local Claude definition discovery keeps project and global command files usable", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-definition-scope-"));

  try {
    const userRoot = join(sandboxRoot, "user");
    const projectRoot = join(sandboxRoot, "project");
    const projectCommand = join(projectRoot, "commands", "review.md");
    const userCommand = join(userRoot, "commands", "review.md");
    const projectSkill = join(projectRoot, "skills", "project-scan", "SKILL.md");
    const userSkill = join(userRoot, "skills", "global-scan", "SKILL.md");

    mkdirSync(join(projectRoot, "commands"), { recursive: true });
    mkdirSync(join(userRoot, "commands"), { recursive: true });
    mkdirSync(join(projectRoot, "skills", "project-scan"), { recursive: true });
    mkdirSync(join(userRoot, "skills", "global-scan"), { recursive: true });
    writeFileSync(projectCommand, "# project review\n", "utf8");
    writeFileSync(userCommand, "# global review\n", "utf8");
    writeFileSync(projectSkill, "# project scan\n", "utf8");
    writeFileSync(userSkill, "# global scan\n", "utf8");

    const definitions = discoverSlashCommandDefinitionItemsInRoots({
      project: projectRoot,
      user: userRoot,
    });

    assert.deepEqual(definitions.map((definition) => ({
      name: definition.name,
      definitionKind: definition.definitionKind,
      filePath: definition.filePath,
    })), [
      { name: "review", definitionKind: "command", filePath: projectCommand },
      { name: "project-scan", definitionKind: "skill", filePath: projectSkill },
      { name: "review", definitionKind: "command", filePath: userCommand },
      { name: "global-scan", definitionKind: "skill", filePath: userSkill },
    ]);
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
