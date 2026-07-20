import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  clearSlashCommandDiscoveryCache,
  discoverSkillDefinitionItemsInRoots,
  discoverSlashCommandDefinitionItemsInRoots,
  discoverSlashCommandItemsInRoots,
  discoverSlashCommandsInRoots,
} from "../../src/electron/libs/slash-command-discovery.js";
import { CLAUDE_CODE_BUILTIN_COMMAND_ITEMS } from "../../src/electron/libs/claude/claude-code-builtin-commands.js";
import {
  applySlashCommandMessages,
  extractSlashCommandsFromMessages,
  mergeSlashCommandLists,
} from "../../src/shared/slash-commands.js";

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

test("Claude Code built-in slash command seed includes stable SDK commands", () => {
  const names = CLAUDE_CODE_BUILTIN_COMMAND_ITEMS.map((item) => item.name);

  for (const expected of [
    "help",
    "init",
    "doctor",
    "model",
    "skills",
    "goal",
    "code-review",
    "usage-credits",
    "workflows",
    "reload-skills",
    "__remote-workflow",
    "design",
    "design-consent",
    "design-revoke",
  ]) {
    assert.ok(names.includes(expected), `expected /${expected} in built-in slash command seed`);
  }
});

test("Claude Code built-in SDK descriptions are localized for the Chinese UI", () => {
  for (const command of CLAUDE_CODE_BUILTIN_COMMAND_ITEMS) {
    assert.match(command.description ?? "", /[\u3400-\u9fff]/u, `expected Chinese description for /${command.name}`);
    assert.doesNotMatch(command.description ?? "", /^Claude Code (?:built-in|bundled skill):/i);
  }
});

test("Claude Code built-in slash command seed keeps historical aliases for renamed commands", () => {
  const names = CLAUDE_CODE_BUILTIN_COMMAND_ITEMS.map((item) => item.name);

  assert.ok(names.includes("simplify"));
  assert.ok(names.includes("extra-usage"));
});

test("Claude Code /code-review seed tells agents to split oversized reviews", () => {
  const command = CLAUDE_CODE_BUILTIN_COMMAND_ITEMS.find((item) => item.name === "code-review");

  assert.ok(command);
  assert.match(command.description ?? "", /过大|大型|超长/);
  assert.match(command.description ?? "", /拆分/);
  assert.match(command.description ?? "", /汇总/);
});

test("project commands do not shadow Claude Code built-in /goal", () => {
  assert.equal(existsSync(join(process.cwd(), ".claude", "commands", "goal.md")), false);
  assert.equal(existsSync(join(process.cwd(), ".claude", "commands", "goal-plan.md")), true);
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

test("slash command discovery skips generated dependency directories", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-commands-ignore-"));

  try {
    const projectRoot = join(sandboxRoot, "project");
    mkdirSync(join(projectRoot, "commands", "dist"), { recursive: true });
    mkdirSync(join(projectRoot, "commands", "node_modules"), { recursive: true });
    mkdirSync(join(projectRoot, "commands", "src"), { recursive: true });
    writeFileSync(join(projectRoot, "commands", "src", "keep.md"), "# keep\n", "utf8");
    writeFileSync(join(projectRoot, "commands", "dist", "ignored.md"), "# ignored\n", "utf8");
    writeFileSync(join(projectRoot, "commands", "node_modules", "ignored.md"), "# ignored\n", "utf8");

    clearSlashCommandDiscoveryCache();
    const commands = discoverSlashCommandsInRoots({ project: projectRoot });

    assert.deepEqual(commands, ["src.keep"]);
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

test("skill discovery reads a quoted description from CRLF frontmatter", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-skill-crlf-"));

  try {
    const skillDir = join(sandboxRoot, "skills", ".curated", "sentry");
    const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="8" /></svg>';
    mkdirSync(skillDir, { recursive: true });
    mkdirSync(join(skillDir, "agents"), { recursive: true });
    mkdirSync(join(skillDir, "assets"), { recursive: true });
    writeFileSync(
      join(skillDir, "SKILL.md"),
      [
        "---",
        'name: "sentry"',
        'description: "Read-only Sentry observability"',
        "---",
        "",
        "# Sentry",
      ].join("\r\n"),
      "utf8",
    );
    writeFileSync(
      join(skillDir, "agents", "openai.yaml"),
      'interface:\n  icon_small: "./assets/sentry-small.svg"\n  icon_large: "./assets/sentry.png"\n',
      "utf8",
    );
    writeFileSync(join(skillDir, "assets", "sentry-small.svg"), iconSvg, "utf8");
    writeFileSync(join(skillDir, "assets", "sentry.png"), "large-icon", "utf8");

    const skills = discoverSkillDefinitionItemsInRoots({
      skillRoots: [join(sandboxRoot, "skills")],
    });

    assert.equal(skills[0]?.name, "sentry");
    assert.equal(skills[0]?.description, "Read-only Sentry observability");
    assert.equal(
      skills[0]?.icon,
      `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`,
    );
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("skill discovery does not read icons outside the skill directory", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-skill-icon-boundary-"));

  try {
    const skillDir = join(sandboxRoot, "skills", "safe-skill");
    mkdirSync(join(skillDir, "agents"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: safe-skill\n---\n", "utf8");
    writeFileSync(join(sandboxRoot, "outside.svg"), "<svg />", "utf8");
    writeFileSync(
      join(skillDir, "agents", "openai.yaml"),
      'interface:\n  icon_small: "../../outside.svg"\n',
      "utf8",
    );

    const skills = discoverSkillDefinitionItemsInRoots({
      skillRoots: [join(sandboxRoot, "skills")],
    });

    assert.equal(skills[0]?.icon, undefined);
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test("skill discovery falls back to icon_large when icon_small is unavailable", () => {
  const sandboxRoot = mkdtempSync(join(tmpdir(), "slash-skill-icon-fallback-"));

  try {
    const skillDir = join(sandboxRoot, "skills", "large-icon-skill");
    const iconBytes = Buffer.from("large-icon");
    mkdirSync(join(skillDir, "agents"), { recursive: true });
    mkdirSync(join(skillDir, "assets"), { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "---\nname: large-icon-skill\n---\n", "utf8");
    writeFileSync(
      join(skillDir, "agents", "openai.yaml"),
      'interface:\n  icon_small: "./assets/missing.svg"\n  icon_large: "./assets/large.png"\n',
      "utf8",
    );
    writeFileSync(join(skillDir, "assets", "large.png"), iconBytes);

    const skills = discoverSkillDefinitionItemsInRoots({
      skillRoots: [join(sandboxRoot, "skills")],
    });

    assert.equal(
      skills[0]?.icon,
      `data:image/png;base64,${iconBytes.toString("base64")}`,
    );
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

test("commands_changed atomically replaces command names and preserves metadata", () => {
  const catalog = applySlashCommandMessages(
    ["help", "removed"],
    undefined,
    [{
      type: "system",
      subtype: "commands_changed",
      commands: [{
        name: "/review",
        description: "Review the current changes",
        argumentHint: "[path]",
        aliases: ["audit", "/review"],
      }],
    }],
  );

  assert.deepEqual(catalog?.names, ["audit", "review"]);
  assert.deepEqual(catalog?.details, [{
    name: "review",
    description: "Review the current changes",
    argumentHint: "[path]",
    aliases: ["audit"],
  }]);
});

test("commands_changed treats an empty list as an authoritative empty snapshot", () => {
  const catalog = applySlashCommandMessages(
    ["help"],
    [{ name: "help", description: "Help" }],
    [{ type: "system", subtype: "commands_changed", commands: [] }],
  );

  assert.deepEqual(catalog, { names: [], details: [] });
  assert.deepEqual(extractSlashCommandsFromMessages([
    { type: "system", subtype: "commands_changed", commands: [] },
  ]), []);
});
