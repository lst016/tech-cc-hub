import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/ui/components/prompt-input/PromptComposerContextChips.tsx", "utf8");

test("queued message panel exposes a collapse toggle", () => {
  assert.match(source, /const \[collapsed,\s*setCollapsed\] = useState\(false\)/);
  assert.match(source, /setCollapsed\(\(value\) => !value\)/);
  assert.match(source, /aria-expanded=\{!collapsed\}/);
  assert.match(source, /\{collapsed \? "展开" : "收起"\}/);
  assert.match(source, /\{!collapsed && \(/);
});

test("collapsed queued message panel keeps the next item discoverable", () => {
  assert.match(source, /下一条：\{nextLabel\}/);
  assert.match(source, /onClick=\{\(\) => onEdit\(nextQueuedMessage\)\}/);
  assert.match(source, /max-h-\[216px\]/);
});

test("queued message rows expose status and actions without relying on icon shape", () => {
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label="待发送队列"/);
  assert.match(source, /data-queue-next=\{index === 0 \? "true" : undefined\}/);
  assert.match(source, /aria-current=\{index === 0 \? "true" : undefined\}/);
  assert.match(source, /aria-label=\{`编辑排队消息 \$\{index \+ 1\}`\}/);
  assert.match(source, /aria-label=\{`移除排队消息 \$\{index \+ 1\}`\}/);
  assert.match(source, /queued-messages-scroll/);
});

test("queued message rows fork through the stable protocol and continue after the branch appears", () => {
  const inputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const promptActionsSource = readFileSync("src/ui/components/prompt-input/usePromptActions.ts", "utf8");
  const eventSource = readFileSync("src/ui/events.ts", "utf8");
  const handlerSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  const devShimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");

  assert.match(source, /GitFork/);
  assert.match(source, /onFork\(queuedMessage\)/);
  assert.match(source, /Fork 执行/);
  assert.match(source, /aria-label=\{`Fork 执行排队消息 \$\{index \+ 1\}`\}/);
  assert.match(source, /disabled=\{!canFork \|\| isAnyForking\}/);
  assert.match(promptActionsSource, /type: "session\.fork"/);
  assert.match(promptActionsSource, /pendingForkExecutionRef/);
  assert.match(promptActionsSource, /type: "session\.continue"/);
  assert.match(promptActionsSource, /PROMPT_FORK_RESULT_EVENT/);
  assert.match(promptActionsSource, /FORK_EXECUTION_TIMEOUT_MS/);
  assert.doesNotMatch(promptActionsSource, /session\.fork\.execute/);
  assert.match(inputSource, /PROMPT_FORK_RESULT_EVENT/);
  assert.match(eventSource, /PromptForkResultDetail/);
  assert.doesNotMatch(handlerSource, /session\.fork\.execute/);
  assert.doesNotMatch(handlerSource, /session\.fork\.result/);
  assert.match(devShimSource, /event\.payload\.sessionId !== browserPreviewSessionId/);
});
