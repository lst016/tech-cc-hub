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
  data?: string | null;
};

export type PromptEditorInputCursorOptions = {
  inputType?: string;
  isComposing?: boolean;
  compositionRecentlyEnded?: boolean;
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

export function shouldSuppressPromptAutoReplacement(
  event: PromptBeforeInputEventLike,
  isComposing = false,
) {
  if (event.inputType !== "insertReplacementText") return false;
  if (isComposing || event.isComposing) return false;
  if (typeof event.data !== "string" || event.data.length <= 1) return false;
  const normalized = event.data.normalize("NFKC");
  return /^[A-Za-z][A-Za-z'’-]*$/.test(normalized);
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

function getPromptChangeRange(previousPrompt: string, nextPrompt: string) {
  let start = 0;
  const sharedLength = Math.min(previousPrompt.length, nextPrompt.length);
  while (start < sharedLength && previousPrompt[start] === nextPrompt[start]) {
    start += 1;
  }

  let previousEnd = previousPrompt.length;
  let nextEnd = nextPrompt.length;
  while (
    previousEnd > start
    && nextEnd > start
    && previousPrompt[previousEnd - 1] === nextPrompt[nextEnd - 1]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  return { start, nextEnd };
}

function isCompositionCursorInput(options?: PromptEditorInputCursorOptions) {
  const inputType = options?.inputType ?? "";
  return Boolean(
    options?.isComposing
    || options?.compositionRecentlyEnded
    || inputType === "insertCompositionText"
    || inputType === "deleteCompositionText"
    || inputType === "insertFromComposition",
  );
}

export function resolvePromptEditorInputCursor(
  previousPrompt: string,
  nextPrompt: string,
  measuredCursorIndex: number,
  options?: PromptEditorInputCursorOptions,
) {
  const safeCursor = Math.max(0, Math.min(measuredCursorIndex, nextPrompt.length));

  if (
    nextPrompt.length > previousPrompt.length
    && nextPrompt.startsWith(previousPrompt)
    && safeCursor <= previousPrompt.length
  ) {
    return nextPrompt.length;
  }

  if (isCompositionCursorInput(options) && previousPrompt !== nextPrompt) {
    const change = getPromptChangeRange(previousPrompt, nextPrompt);
    if (safeCursor <= change.start && change.nextEnd > change.start) {
      return change.nextEnd;
    }
  }

  return safeCursor;
}
