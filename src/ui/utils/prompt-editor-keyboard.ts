export type PromptKeyboardEventLike = {
  key: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  nativeEvent?: {
    isComposing?: boolean;
    keyCode?: number;
    which?: number;
  };
};

export type PromptBeforeInputEventLike = {
  inputType?: string;
  isComposing?: boolean;
};

export type PromptParagraphInputAction = "allow" | "block" | "submit";

export function shouldSubmitPromptOnEnter(
  event: PromptKeyboardEventLike,
  isComposing: boolean,
) {
  if (event.key !== "Enter" || event.shiftKey) return false;
  return !isComposing;
}

export function shouldBlockPromptEnterAfterComposition(
  event: PromptKeyboardEventLike,
  isComposing = false,
) {
  if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey) return false;
  return isComposing;
}

export function shouldInsertPromptNewline(event: PromptKeyboardEventLike) {
  return event.key === "Enter" && Boolean(event.shiftKey) && !event.metaKey && !event.ctrlKey;
}

export function getPromptParagraphInputAction(
  event: PromptBeforeInputEventLike,
  isComposing: boolean,
  paletteOpen: boolean,
  compositionEnterPending = false,
): PromptParagraphInputAction {
  if (event.inputType !== "insertParagraph") return "allow";
  if (isComposing || event.isComposing || paletteOpen || compositionEnterPending) return "block";
  return "submit";
}

export function insertTextIntoPrompt(
  prompt: string,
  text: string,
  selectionStart: number,
  selectionEnd = selectionStart,
) {
  const safeStart = Math.max(0, Math.min(selectionStart, prompt.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, prompt.length));
  return {
    prompt: `${prompt.slice(0, safeStart)}${text}${prompt.slice(safeEnd)}`,
    cursorIndex: safeStart + text.length,
  };
}

export function resolvePromptEditorInputCursor(
  previousPrompt: string,
  nextPrompt: string,
  measuredCursorIndex: number,
) {
  const safeCursor = Math.max(0, Math.min(measuredCursorIndex, nextPrompt.length));

  if (
    nextPrompt.length > previousPrompt.length
    && nextPrompt.startsWith(previousPrompt)
    && safeCursor <= previousPrompt.length
  ) {
    return nextPrompt.length;
  }

  return safeCursor;
}
