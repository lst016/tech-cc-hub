# test/electron/session-archive.test.ts

> 模块：`session-engine` · 语言：`typescript` · 行数：35

## 文件职责

测试Session归档和恢复功能

## 关键符号

- `test@0 - 验证archiveSession/unarchiveSession的正确性和listSessions过滤`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`
- `node:path`
- `node:os`
- `../../src/electron/libs/session-store.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { SessionStore } from "../../src/electron/libs/session-store.js";

test("SessionStore archives sessions outside the default list and restores them", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-archive-"));
  const store = new SessionStore(join(dir, "sessions.db"));

  try {
    const active = store.createSession({ title: "Active session", cwd: dir });
    const archived = store.createSession({ title: "Archived session", cwd: dir });

    const archivedSession = store.archiveSession(archived.id);

    assert.equal(archivedSession?.id, archived.id);
    assert.equal(typeof archivedSession?.archivedAt, "number");
    assert.deepEqual(store.listSessions().map((session) => session.id), [active.id]);
    assert.deepEqual(store.listSessions({ archived: true }).map((session) => session.id), [archived.id]);

    const restoredSession = store.unarchiveSession(archived.id);

    assert.equal(restoredSession?.id, archived.id);
    assert.equal(restoredSession?.archivedAt, undefined);
    assert.deepEqual(new Set(store.listSessions().map((session) => session.id)), new Set([active.id, archived.id]));
    assert.deepEqual(store.listSessions({ archived: true }), []);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

```
