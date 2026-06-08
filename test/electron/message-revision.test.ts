import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("user message revision edits inline and does not use the composer scaffold", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const userStart = source.indexOf("const UserMessageCard");
  const assistantStart = source.indexOf("const AssistantTextCard");
  const assistantEnd = source.indexOf("const getToolLabel", assistantStart);

  assert.ok(userStart >= 0);
  assert.ok(assistantStart > userStart);
  assert.ok(assistantEnd > assistantStart);

  const userSection = source.slice(userStart, assistantStart);
  const assistantSection = source.slice(assistantStart, assistantEnd);

  assert.match(userSection, /const \[isEditing, setIsEditing\]/);
  assert.match(userSection, /<textarea/);
  assert.match(userSection, /取消/);
  assert.match(userSection, /发送/);
  assert.match(userSection, /buildRevisedPromptWithContext\(trimmedDraft, promptContextBlocks\)/);
  assert.match(userSection, /onRevisePrompt\(revisedPrompt, message\.attachments \?\? \[\], message\.historyId\)/);
  assert.match(source, /extractPromptContextBlocks/);
  assert.doesNotMatch(source, /buildRevisionComposerPrompt|appendRevisionRequestToComposer|请重新修改上方引用内容/);
  assert.doesNotMatch(assistantSection, /label="(?:重新)?修改"|<textarea|onRevisePrompt/);
});

test("inline revision reuses session continue without duplicating the user prompt", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const electronTypes = readFileSync("src/electron/types.ts", "utf8");
  const ipcHandlers = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(appSource, /displayUserPrompt:\s*false/);
  assert.match(appSource, /replaceHistoryId:\s*historyId/);
  assert.match(promptInputSource, /displayUserPrompt,\s*\n\s*replaceHistoryId,/);
  assert.match(electronTypes, /displayUserPrompt\?: boolean; replaceHistoryId\?: string/);
  assert.match(ipcHandlers, /replaceUserPromptAndPrune/);
  assert.match(ipcHandlers, /event\.payload\.displayUserPrompt !== false/);
});

test("session store replaces the existing user prompt row and prunes later rows", () => {
  const storeSource = readFileSync("src/electron/libs/session-store.ts", "utf8");

  assert.match(storeSource, /replaceUserPromptAndPrune/);
  assert.match(storeSource, /existing\.type !== "user_prompt"/);
  assert.match(storeSource, /update messages set data = \?/);
  assert.match(storeSource, /delete from messages where session_id = \? and rowid > \?/);
});
