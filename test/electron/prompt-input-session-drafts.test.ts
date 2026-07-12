import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("prompt text drafts are scoped to the active session", () => {
  const storeSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");

  assert.match(storeSource, /promptDraftsBySessionId: Record<string, string>;/);
  assert.match(storeSource, /const sessionKey = getPromptDraftSessionKey\(state\.activeSessionId\);/);
  assert.match(storeSource, /promptDraftsBySessionId: nextDrafts/);
  assert.match(
    storeSource,
    /setActiveSessionId: \(id\) => set\(\(state\) => \(\{\s*activeSessionId: id,\s*prompt: state\.promptDraftsBySessionId\[getPromptDraftSessionKey\(id\)\] \?\? "",\s*\}\)\),/s,
  );
});

test("prompt input attachments are scoped to the active session draft", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

  assert.match(promptInputSource, /const \[attachmentsBySessionId, setAttachmentsBySessionId\] = useState<Record<string, PromptAttachment\[\]>>\(\{\}\);/);
  assert.match(promptInputSource, /const composerDraftSessionKey = getPromptDraftSessionKey\(activeSessionId\);/);
  assert.match(promptInputSource, /const localAttachments = attachmentsBySessionId\[composerDraftSessionKey\] \?\? EMPTY_ATTACHMENTS;/);
  assert.match(promptInputSource, /const attachments = controller\?\.attachments \?\? localAttachments;/);
  assert.match(promptInputSource, /\[composerDraftSessionKey\]: resolvedAttachments/);
});

test("image-generation configuration is scoped to the active session draft", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

  assert.match(promptInputSource, /imageGenerationConfigsBySession/);
  assert.match(promptInputSource, /imageGenerationConfigsBySession\[composerDraftSessionKey\]/);
  assert.match(promptInputSource, /\[composerDraftSessionKey\]: nextConfig/);
});
