export type AskUserQuestionInput = {
  questions?: unknown;
};

export type AskUserQuestionOption = { label: string; description?: string };

export type AskUserQuestion = {
  question: string;
  header?: string;
  options?: AskUserQuestionOption[];
  multiSelect?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAskUserQuestions(input?: AskUserQuestionInput | null): AskUserQuestion[] {
  const rawQuestions = input?.questions;
  const items = Array.isArray(rawQuestions)
    ? rawQuestions
    : rawQuestions && typeof rawQuestions === "object"
      ? [rawQuestions]
      : typeof rawQuestions === "string" && rawQuestions.trim()
        ? [{ question: rawQuestions }]
        : [];

  return items
    .map((item): AskUserQuestion | null => {
      if (typeof item === "string") {
        const question = item.trim();
        return question ? { question } : null;
      }

      if (!isRecord(item)) return null;

      const question = typeof item.question === "string" && item.question.trim()
        ? item.question.trim()
        : typeof item.prompt === "string" && item.prompt.trim()
          ? item.prompt.trim()
          : typeof item.text === "string" && item.text.trim()
            ? item.text.trim()
            : "";

      if (!question) return null;

      const options = Array.isArray(item.options)
        ? item.options
          .map((option): AskUserQuestionOption | null => {
            if (typeof option === "string") return { label: option };
            if (!isRecord(option) || typeof option.label !== "string" || !option.label.trim()) return null;
            return {
              label: option.label.trim(),
              description: typeof option.description === "string" ? option.description : undefined,
            };
          })
          .filter((option): option is AskUserQuestionOption => Boolean(option))
        : undefined;

      const normalized: AskUserQuestion = { question };
      if (typeof item.header === "string" && item.header.trim()) normalized.header = item.header.trim();
      if (options?.length) normalized.options = options;
      if (item.multiSelect === true) normalized.multiSelect = true;
      return normalized;
    })
    .filter((question): question is AskUserQuestion => Boolean(question));
}

export function getAskUserQuestionSignature(input?: AskUserQuestionInput | null) {
  const questions = normalizeAskUserQuestions(input);
  if (!questions.length) return "";
  return questions
    .map((question) => {
      const options = (question.options ?? []).map((option) => `${option.label}|${option.description ?? ""}`).join(",");
      return `${question.question}|${question.header ?? ""}|${question.multiSelect ? "1" : "0"}|${options}`;
    })
    .join("||");
}
