import test from "node:test";
import assert from "node:assert/strict";
import {
  getPromptParagraphInputAction,
  insertTextIntoPrompt,
  resolvePromptEditorInputCursor,
  shouldInsertPromptNewline,
  shouldSubmitPromptOnEnter,
} from "../../src/ui/utils/prompt-editor-keyboard.js";

test("plain Enter submits the prompt", () => {
  assert.equal(shouldSubmitPromptOnEnter({ key: "Enter" }, false), true);
});

test("Shift+Enter inserts a newline instead of submitting", () => {
  const event = { key: "Enter", shiftKey: true };
  assert.equal(shouldSubmitPromptOnEnter(event, false), false);
  assert.equal(shouldInsertPromptNewline(event), true);
});

test("Enter is ignored only while IME composition is active", () => {
  assert.equal(shouldSubmitPromptOnEnter({ key: "Enter", nativeEvent: { isComposing: true } }, false), false);
  assert.equal(shouldSubmitPromptOnEnter({ key: "Enter" }, true), false);
  assert.equal(shouldSubmitPromptOnEnter({ key: "Enter" }, false), true);
});

test("Enter is blocked briefly after IME composition ends", () => {
  assert.equal(shouldSubmitPromptOnEnter({ key: "Enter" }, false, true), false);
  assert.equal(shouldSubmitPromptOnEnter({ key: "Enter" }, false, false), true);
});

test("contentEditable paragraph input submits when keydown does not catch Enter", () => {
  assert.equal(getPromptParagraphInputAction({ inputType: "insertParagraph" }, false, false), "submit");
});

test("contentEditable paragraph input is blocked during IME composition", () => {
  assert.equal(getPromptParagraphInputAction({ inputType: "insertParagraph", isComposing: true }, false, false), "block");
  assert.equal(getPromptParagraphInputAction({ inputType: "insertParagraph" }, true, false), "block");
  assert.equal(getPromptParagraphInputAction({ inputType: "insertParagraph" }, false, false, true), "block");
});

test("contentEditable paragraph input is blocked while command palettes own Enter", () => {
  assert.equal(getPromptParagraphInputAction({ inputType: "insertParagraph" }, false, true), "block");
});

test("contentEditable non-paragraph input remains native", () => {
  assert.equal(getPromptParagraphInputAction({ inputType: "insertText" }, false, false), "allow");
  assert.equal(getPromptParagraphInputAction({ inputType: "insertLineBreak" }, false, false), "allow");
});

test("newline insertion preserves raw slash commands and cursor position", () => {
  assert.deepEqual(insertTextIntoPrompt("/acpx sai-image-gen /ss", "\n", 5), {
    prompt: "/acpx\n sai-image-gen /ss",
    cursorIndex: 6,
  });
});

test("input cursor resolves to the end when contentEditable reports the pre-insert offset", () => {
  assert.equal(resolvePromptEditorInputCursor("tee wst ", "tee wst /", "tee wst ".length), "tee wst /".length);
  assert.equal(resolvePromptEditorInputCursor("tee wst ", "tee wst /", "tee wst /".length), "tee wst /".length);
});

test("input cursor preserves true middle edits", () => {
  assert.equal(resolvePromptEditorInputCursor("tee wst", "tee west", 5), 5);
});
