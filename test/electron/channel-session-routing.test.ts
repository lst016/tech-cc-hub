import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

import {
  resolveChannelWorkspaceLocation,
  resolveChannelWorkspaceIds,
} from "../../src/electron/libs/channel/channel-workspace.js";
import { SessionStore } from "../../src/electron/libs/session-store.js";

test("Lark workspace identity uses the sender openId while conversation identity uses chatId", () => {
  const first = resolveChannelWorkspaceIds({
    provider: "lark",
    text: "first",
    senderId: "ou_alice",
    externalConversationId: "oc_direct",
  });
  const second = resolveChannelWorkspaceIds({
    provider: "lark",
    text: "second",
    senderId: "ou_alice",
    externalConversationId: "oc_project",
  });

  assert.deepEqual(first, {
    workspaceId: "ou_alice",
    conversationId: "oc_direct",
  });
  assert.deepEqual(second, {
    workspaceId: "ou_alice",
    conversationId: "oc_project",
  });
});

test("non-Lark channels preserve their conversation-scoped workspace behavior", () => {
  assert.deepEqual(resolveChannelWorkspaceIds({
    provider: "telegram",
    text: "hello",
    senderId: "user-1",
    externalConversationId: "chat-1",
  }), {
    workspaceId: "chat-1",
    conversationId: "chat-1",
  });
});

test("an existing chatId workspace is adopted instead of creating a new openId directory", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "techcc-channel-workspace-adoption-"));
  const legacyRoot = join(directory, "lark", "oc_direct");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(legacyRoot, { recursive: true });

  assert.deepEqual(resolveChannelWorkspaceLocation({
    provider: "lark",
    text: "hello",
    senderId: "ou_alice",
    externalConversationId: "oc_direct",
  }, directory), {
    workspaceId: "ou_alice",
    conversationId: "oc_direct",
    root: legacyRoot,
    adoptedLegacyConversationRoot: true,
  });

  assert.deepEqual(resolveChannelWorkspaceLocation({
    provider: "lark",
    text: "another chat",
    senderId: "ou_alice",
    externalConversationId: "oc_project",
  }, directory), {
    workspaceId: "ou_alice",
    conversationId: "oc_project",
    root: join(directory, "lark", "ou_alice"),
    adoptedLegacyConversationRoot: false,
  });
});

test("channel conversation routes keep different chatIds in different sessions inside one workspace", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "techcc-channel-routes-"));
  const databasePath = join(directory, "sessions.db");
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const workspaceRoot = join(directory, "channels", "lark", "ou_alice");
  const first = new SessionStore(databasePath);
  const directSession = first.createSession({ title: "Direct", cwd: workspaceRoot });
  const groupSession = first.createSession({ title: "Project", cwd: workspaceRoot });
  const workspaceRoute = first.getOrCreateChannelWorkspaceRoute({
    provider: "lark",
    workspaceId: "ou_alice",
    workspaceRoot,
  });
  const unchangedWorkspaceRoute = first.getOrCreateChannelWorkspaceRoute({
    provider: "lark",
    workspaceId: "ou_alice",
    workspaceRoot: join(directory, "should-not-replace"),
  });

  assert.equal(workspaceRoute.workspaceRoot, workspaceRoot);
  assert.equal(unchangedWorkspaceRoute.workspaceRoot, workspaceRoot);

  first.setChannelSessionRoute({
    provider: "lark",
    workspaceId: "ou_alice",
    conversationId: "oc_direct",
    workspaceRoot,
    sessionId: directSession.id,
  });
  first.setChannelSessionRoute({
    provider: "lark",
    workspaceId: "ou_alice",
    conversationId: "oc_project",
    workspaceRoot,
    sessionId: groupSession.id,
  });

  assert.equal(first.getChannelSessionRoute("lark", "ou_alice", "oc_direct")?.sessionId, directSession.id);
  assert.equal(first.getChannelSessionRoute("lark", "ou_alice", "oc_project")?.sessionId, groupSession.id);
  assert.equal(first.getChannelSessionRoute("lark", "ou_alice", "oc_direct")?.workspaceRoot, workspaceRoot);
  first.close();

  const reopened = new SessionStore(databasePath);
  assert.equal(
    reopened.getChannelWorkspaceRoute("lark", "ou_alice")?.workspaceRoot,
    workspaceRoot,
  );
  assert.equal(reopened.getChannelSessionRoute("lark", "ou_alice", "oc_direct")?.sessionId, directSession.id);
  assert.equal(reopened.getChannelSessionRoute("lark", "ou_alice", "oc_project")?.sessionId, groupSession.id);

  const replacement = reopened.createSession({ title: "Direct follow-up", cwd: workspaceRoot });
  reopened.setChannelSessionRoute({
    provider: "lark",
    workspaceId: "ou_alice",
    conversationId: "oc_direct",
    workspaceRoot,
    sessionId: replacement.id,
  });

  assert.equal(reopened.getChannelSessionRoute("lark", "ou_alice", "oc_direct")?.sessionId, replacement.id);
  assert.equal(reopened.getChannelSessionRoute("lark", "ou_alice", "oc_project")?.sessionId, groupSession.id);

  const otherWorkspaceRoot = join(directory, "channels", "lark", "ou_bob");
  const otherSession = reopened.createSession({ title: "Other member", cwd: otherWorkspaceRoot });
  reopened.setChannelSessionRoute({
    provider: "lark",
    workspaceId: "ou_bob",
    conversationId: "oc_project",
    workspaceRoot: otherWorkspaceRoot,
    sessionId: otherSession.id,
  });

  assert.equal(reopened.getChannelSessionRoute("lark", "ou_alice", "oc_project")?.sessionId, groupSession.id);
  assert.equal(reopened.getChannelSessionRoute("lark", "ou_bob", "oc_project")?.sessionId, otherSession.id);
  reopened.close();
});

test("channel message dispatch selects sessions by chatId route instead of workspace cwd", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(
    source,
    /getChannelSessionRoute\(\s*event\.payload\.provider,\s*workspace\.workspaceId,\s*workspace\.conversationId/,
  );
  assert.match(
    source,
    /channelRoute:\s*\{\s*provider:\s*event\.payload\.provider,\s*workspaceId:\s*workspace\.workspaceId,\s*conversationId:\s*workspace\.conversationId/,
  );
  assert.match(source, /if \(!route && adoptedLegacyConversationRoot\)/);
  assert.match(source, /find\(\(session\) => session\.id === route\.sessionId\)/);
});

test("legacy chat-only route tables migrate to composite openId and chatId routes", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "techcc-channel-route-migration-"));
  const databasePath = join(directory, "sessions.db");
  const workspaceRoot = join(directory, "channels", "lark", "ou_alice");
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  const seed = new SessionStore(databasePath);
  const legacySession = seed.createSession({ title: "Legacy route", cwd: workspaceRoot });
  seed.close();

  const legacy = new Database(databasePath);
  legacy.exec("drop table channel_session_routes");
  legacy.exec(
    `create table channel_session_routes (
      provider text not null,
      conversation_id text not null,
      workspace_root text not null,
      session_id text not null,
      updated_at integer not null,
      primary key (provider, conversation_id)
    )`,
  );
  legacy.prepare(
    `insert into channel_session_routes
      (provider, conversation_id, workspace_root, session_id, updated_at)
     values (?, ?, ?, ?, ?)`,
  ).run("lark", "oc_direct", workspaceRoot, legacySession.id, 123);
  legacy.close();

  const migrated = new SessionStore(databasePath);
  assert.deepEqual(
    migrated.getChannelSessionRoute("lark", "ou_alice", "oc_direct"),
    {
      provider: "lark",
      workspaceId: "ou_alice",
      conversationId: "oc_direct",
      workspaceRoot,
      sessionId: legacySession.id,
      updatedAt: 123,
    },
  );
  migrated.close();
});
