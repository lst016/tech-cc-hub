export const REVISION_PROMPT_SCAFFOLD = "请重新修改上方引用内容。\n\n修改要求：\n- ";

export type RevisionReferenceSource = {
  kind: "selection" | "message";
  text: string;
  sourceLabel: string;
};

const normalizeRevisionText = (text?: string | null) => text?.trim() ?? "";

export function resolveRevisionReferenceSource({
  selectedText,
  fallbackText,
  fallbackLabel,
}: {
  selectedText?: string | null;
  fallbackText: string;
  fallbackLabel: string;
}): RevisionReferenceSource | null {
  const selected = normalizeRevisionText(selectedText);
  if (selected) {
    return {
      kind: "selection",
      text: selected,
      sourceLabel: `${fallbackLabel}选区`,
    };
  }

  const fallback = normalizeRevisionText(fallbackText);
  if (!fallback) return null;

  return {
    kind: "message",
    text: fallback,
    sourceLabel: fallbackLabel,
  };
}

export function buildRevisionComposerPrompt(existingPrompt: string) {
  const current = existingPrompt.trim();
  return current ? `${current}\n\n${REVISION_PROMPT_SCAFFOLD}` : REVISION_PROMPT_SCAFFOLD;
}
