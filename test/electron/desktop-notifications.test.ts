import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDesktopNotificationAttentionCue,
  buildCronDesktopNotification,
  buildSessionDesktopNotification,
  buildTaskExecutionDesktopNotification,
  shouldShowDesktopNotification,
} from "../../src/electron/libs/desktop-notification-model.js";

test("desktop notifications stay quiet while a visible app window is focused", () => {
  assert.equal(
    shouldShowDesktopNotification([
      { focused: true, minimized: false, visible: true },
    ]),
    false,
  );
});

test("desktop notifications show when all app windows are backgrounded or minimized", () => {
  assert.equal(
    shouldShowDesktopNotification([
      { focused: false, minimized: false, visible: true },
      { focused: true, minimized: true, visible: true },
    ]),
    true,
  );
});

test("desktop notifications request stronger attention cues while app is backgrounded", () => {
  const intent = buildTaskExecutionDesktopNotification({
    taskId: "task-attention",
    sessionId: "session-attention",
    taskTitle: "Background task",
    status: "completed",
  });

  assert.ok(intent);
  assert.deepEqual(
    buildDesktopNotificationAttentionCue(intent, [
      { focused: false, minimized: false, visible: true },
    ]),
    {
      flashTaskbar: true,
      playSound: true,
      timeoutType: "never",
    },
  );
  assert.equal(
    buildDesktopNotificationAttentionCue(intent, [
      { focused: true, minimized: false, visible: true },
    ]),
    null,
  );
});

test("builds a completed task notification with a session click target", () => {
  assert.deepEqual(
    buildTaskExecutionDesktopNotification({
      taskId: "task-1",
      sessionId: "session-1",
      taskTitle: "修复登录",
      workspacePath: "D:/tool/tech-cc-hub",
      status: "completed",
    }),
    {
      body: "工作区：tech-cc-hub",
      dedupeKey: "task:task-1:completed",
      id: "task:task-1:completed",
      target: { type: "task", taskId: "task-1", sessionId: "session-1" },
      title: "任务完成：修复登录",
      urgency: "normal",
    },
  );
});

test("builds a failed task notification with the error summary", () => {
  assert.deepEqual(
    buildTaskExecutionDesktopNotification({
      taskId: "task-2",
      sessionId: "session-2",
      taskTitle: "同步飞书",
      workspacePath: "D:/workspace/kefu/boke-kefu-vue",
      status: "failed",
      error: "CLI exited with code 3",
    }),
    {
      body: "工作区：boke-kefu-vue\n错误：CLI exited with code 3",
      dedupeKey: "task:task-2:failed",
      id: "task:task-2:failed",
      target: { type: "task", taskId: "task-2", sessionId: "session-2" },
      title: "任务失败：同步飞书",
      urgency: "critical",
    },
  );
});

test("builds a completed session notification around the user request and workspace", () => {
  assert.deepEqual(
    buildSessionDesktopNotification({
      sessionId: "session-5",
      title: "CODE REVIEW REPORT",
      lastPrompt: "排查浏览器 MCP 断连",
      workspacePath: "D:/tool/tech-cc-hub",
      status: "completed",
    }),
    {
      body: "工作区：tech-cc-hub\n会话：CODE REVIEW REPORT",
      dedupeKey: "session:session-5:completed",
      id: "session:session-5:completed",
      target: { type: "session", sessionId: "session-5" },
      title: "完成：排查浏览器 MCP 断连",
      urgency: "normal",
    },
  );
});

test("does not build task notifications for user-cancelled executions", () => {
  assert.equal(
    buildTaskExecutionDesktopNotification({
      taskId: "task-3",
      sessionId: "session-3",
      taskTitle: "用户取消",
      status: "cancelled",
    }),
    null,
  );
});

test("suppresses generic session notifications for task-owned sessions", () => {
  assert.equal(
    buildSessionDesktopNotification({
      sessionId: "session-4",
      title: "[任务] 修复登录",
      status: "completed",
    }),
    null,
  );
});

test("builds cron completion notifications", () => {
  assert.deepEqual(
    buildCronDesktopNotification({
      jobId: "job-1",
      jobName: "每日巡检",
      conversationTitle: "系统工作区",
      workspacePath: "D:/tool/tech-cc-hub",
      status: "ok",
    }),
    {
      body: "工作区：tech-cc-hub\n会话：系统工作区",
      dedupeKey: "cron:job-1:ok",
      id: "cron:job-1:ok",
      target: { type: "cron", jobId: "job-1" },
      title: "定时完成：每日巡检",
      urgency: "normal",
    },
  );
});
