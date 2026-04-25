import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWorkingMemoryPrompt,
  createEmptyWorkingMemory,
  updateWorkingMemoryFromStreamMessage,
  updateWorkingMemoryFromUserPrompt,
} from "../../src/electron/session-working-memory.js";

test("records the first concrete user task as the current goal", () => {
  const memory = updateWorkingMemoryFromUserPrompt(
    createEmptyWorkingMemory(),
    "参考 spec 和设计图修复 WhatsApp 进线渠道 UI，不要重新读所有文档。",
  );

  assert.match(memory.currentGoal ?? "", /WhatsApp 进线渠道 UI/);
  assert.deepEqual(memory.userConstraints, ["参考 spec 和设计图修复 WhatsApp 进线渠道 UI，不要重新读所有文档。"]);
});

test("keeps the existing goal when the user only says continue", () => {
  const first = updateWorkingMemoryFromUserPrompt(createEmptyWorkingMemory(), "修复右侧 Prompt Ledger 布局");
  const second = updateWorkingMemoryFromUserPrompt(first, "继续");

  assert.equal(second.currentGoal, "修复右侧 Prompt Ledger 布局");
});

test("records read and edited files from tool calls", () => {
  const afterRead = updateWorkingMemoryFromStreamMessage(createEmptyWorkingMemory(), {
    type: "assistant",
    uuid: "assistant-1",
    message: {
      role: "assistant",
      content: [{
        type: "tool_use",
        id: "read-1",
        name: "Read",
        input: { file_path: "D:\\workspace\\docs\\spec.md" },
      }],
    },
  } as never);

  const afterEdit = updateWorkingMemoryFromStreamMessage(afterRead, {
    type: "assistant",
    uuid: "assistant-2",
    message: {
      role: "assistant",
      content: [{
        type: "tool_use",
        id: "edit-1",
        name: "Edit",
        input: { file_path: "D:\\workspace\\src\\App.tsx" },
      }],
    },
  } as never);

  assert.deepEqual(afterEdit.readFiles, ["D:\\workspace\\docs\\spec.md"]);
  assert.deepEqual(afterEdit.touchedFiles, ["D:\\workspace\\src\\App.tsx"]);
});

test("working memory prompt tells the agent not to restart discovery", () => {
  const memory = {
    ...createEmptyWorkingMemory(),
    currentGoal: "修复 WA UI",
    readFiles: ["D:\\workspace\\docs\\spec.md"],
    touchedFiles: ["D:\\workspace\\src\\App.tsx"],
    nextAction: "继续改 App.tsx 并运行验证",
  };

  const prompt = buildWorkingMemoryPrompt(memory);

  assert.match(prompt, /Session Working Memory/);
  assert.match(prompt, /不要重新读取/);
  assert.match(prompt, /D:\\workspace\\docs\\spec\.md/);
  assert.match(prompt, /继续改 App\.tsx/);
});
