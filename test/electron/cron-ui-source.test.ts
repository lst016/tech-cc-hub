import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");
const pageSource = readFileSync("src/ui/components/cron/ScheduledTasksPage.tsx", "utf8");
const dialogSource = readFileSync("src/ui/components/cron/CreateTaskDialog.tsx", "utf8");

test("cron browser preview fixture covers populated, empty, and error states", () => {
  assert.match(shimSource, /get\("qaCron"\)/);
  assert.match(shimSource, /qaCronScenario === "empty"/);
  assert.match(shimSource, /qaCronScenario === "error"/);
  assert.match(shimSource, /qa-cron-daily-brief/);
  assert.match(shimSource, /qa-cron-weekly-review/);
  assert.match(shimSource, /qa-cron-health-check/);
  assert.match(shimSource, /lastStatus: "error"/);
  assert.match(shimSource, /if \(browserPreviewEnabled\) \{\s*return \{ commands: browserPreviewSlashCommands \}/);
});

test("cron browser preview mutations preserve the renderer IPC contract", () => {
  for (const channel of [
    "cron:list-jobs",
    "cron:list-jobs-by-conversation",
    "cron:get-job",
    "cron:add-job",
    "cron:update-job",
    "cron:remove-job",
    "cron:run-now",
    "cron:pause-job",
    "cron:resume-job",
  ]) {
    assert.match(shimSource, new RegExp(`channel === ["']${channel}["']`), `${channel} should be mocked`);
  }

  assert.match(shimSource, /qaCronJobs = \[created, \.\.\.qaCronJobs\]/);
  assert.match(shimSource, /return updateQaCronJob\(jobId, updates\) as T/);
  assert.match(shimSource, /qaCronJobs = qaCronJobs\.filter\(\(job\) => job\.id !== jobId\)/);
  assert.match(shimSource, /return \{ conversationId: job\.metadata\.conversationId \} as T/);
});

test("scheduled task cards use native keyboard and switch semantics", () => {
  assert.match(pageSource, /<button[\s\S]*?aria-label=\{`查看任务 \$\{job\.name\}`\}/);
  assert.match(pageSource, /role="switch"/);
  assert.match(pageSource, /checked=\{job\.enabled\}/);
  assert.match(pageSource, /aria-label=\{`\$\{job\.enabled \? "暂停" : "启用"\}任务 \$\{job\.name\}`\}/);
});

test("scheduled task page keeps summary and filter states visible", () => {
  assert.match(pageSource, /(?:总任务|全部任务)/);
  assert.match(pageSource, /(?:运行中|已启用)/);
  assert.match(pageSource, /已暂停/);
  assert.match(pageSource, /异常/);

  assert.match(pageSource, /searchQuery/);
  assert.match(pageSource, /statusFilter/);
  assert.match(pageSource, /placeholder="搜索任务/);
  assert.match(pageSource, /value:\s*"active"/);
  assert.match(pageSource, /value:\s*"paused"/);
  assert.match(pageSource, /value:\s*"error"/);
});

test("all task deletion paths require the shared confirmation dialog", () => {
  assert.match(pageSource, /onDelete=\{setConfirmDeleteId\}/);
  assert.match(pageSource, /onRequestDelete=\{\(\) => setConfirmDeleteId\(detailJob\.id\)\}/);
  assert.match(pageSource, /<AppModalOverlay[\s\S]*?role="alertdialog"[\s\S]*?aria-labelledby="cron-delete-title"/);
  assert.match(pageSource, /永久删除/);
  assert.match(pageSource, /onClick=\{\(\) => void handleDelete\(confirmDeleteId\)\}/);
  assert.doesNotMatch(pageSource, /invoke\("cron:remove-job"/);
});

test("create and edit dialog exposes its modal and schedule summary", () => {
  assert.match(dialogSource, /<AppModalOverlay[\s\S]*?aria-label=\{isEditMode \? "编辑定时任务" : "新建定时任务"\}/);
  assert.match(dialogSource, /aria-label="关闭/);
  assert.match(dialogSource, /任务内容/);
  assert.match(dialogSource, /运行位置/);
  assert.match(dialogSource, /调度计划/);
  assert.match(dialogSource, /计划摘要/);
});
