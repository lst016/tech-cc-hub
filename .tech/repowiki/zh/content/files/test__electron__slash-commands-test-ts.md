# test/electron/slash-commands.test.ts

> 模块：`test` · 语言：`typescript` · 行数：95

## 文件职责

测试斜杠命令的发现、缓存和合并功能，验证项目/user级别命令目录扫描、嵌套目录支持、技能命令识别、缓存克隆一致性

## 关键符号

- `discoverSlashCommandsInRoots@0 - 在指定根目录发现斜杠命令markdown文件`
- `mergeSlashCommandLists@0 - 合并本地发现的命令与运行时初始化命令`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `fs`
- `path`
- `os`
- `../../src/electron/libs/slash-command-discovery.js`
- `../../src/shared/slash-commands.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import {
  clearSlashCommandDiscoveryCache,
  discoverSlashCommandItemsInRoots,
  discoverSlashCommandsInRoots,
} from "../../src/electron/libs/slash-command-discovery.js";
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

test("extractSlashCommandsFromMessages ignores non-init messages", () => {
  const commands = extractSlashCommandsFromMessages([
    { type: "assistant", subtype: "message", slash_commands: ["/ignored"] },
    { type: "system", subtype: "init", slash_commands: ["/valid", "/second"] },
  ]);

  assert.deepEqual(commands, ["second", "valid"]);
});

```
