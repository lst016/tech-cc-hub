import { useRef, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { CheckCircle2, ChevronDown, ChevronUp, MessageSquare, Sparkles } from "lucide-react";
import type { PermissionRequest } from "../store/useAppStore";
import {
  normalizeAskUserQuestions,
  type AskUserQuestion,
} from "../utils/ask-user-question";
import { copyTextToClipboard } from "../utils/clipboard";

type AskUserQuestionInput = {
  questions?: unknown;
  answers?: Record<string, string>;
  figmaAuthUrl?: string;
};

type SelectedOptionsByQuestion = Record<number, string[]>;
type OtherInputsByQuestion = Record<number, string>;

const OPTION_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function clampQuestionIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}

function isQuestionAnswered(
  qIndex: number,
  selectedOptions: SelectedOptionsByQuestion,
  otherInputs: OtherInputsByQuestion,
  allowFreeformAnswer: boolean,
): boolean {
  const selected = selectedOptions[qIndex] ?? [];
  const otherText = allowFreeformAnswer ? otherInputs[qIndex]?.trim() ?? "" : "";
  return selected.length > 0 || otherText.length > 0;
}

function getCurrentQuestionIndex(
  questions: AskUserQuestion[],
  selectedOptions: SelectedOptionsByQuestion,
  otherInputs: OtherInputsByQuestion,
  allowFreeformAnswer: boolean,
): number {
  const firstUnanswered = questions.findIndex((_, qIndex) => (
    !isQuestionAnswered(qIndex, selectedOptions, otherInputs, allowFreeformAnswer)
  ));
  return firstUnanswered >= 0 ? firstUnanswered : Math.max(questions.length - 1, 0);
}

function QuestionStepIcon({ answered, index }: { answered: boolean; index: number }) {
  return answered ? (
    <span className="grid h-6 w-6 place-items-center rounded-md border border-[#c7ead6] bg-[#f2fbf5] text-[#1f9d4d]">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  ) : (
    <span className="grid h-6 w-6 place-items-center rounded-md border border-[#d6dbe3] bg-white text-[12px] font-semibold text-ink-700">
      {index + 1}
    </span>
  );
}

function buildAnswers(
  questions: AskUserQuestion[],
  selectedOptions: SelectedOptionsByQuestion,
  otherInputs: OtherInputsByQuestion,
  allowFreeformAnswer: boolean,
) {
  const answers: Record<string, string> = {};

  questions.forEach((q, qIndex) => {
    const selected = selectedOptions[qIndex] ?? [];
    const otherText = allowFreeformAnswer ? otherInputs[qIndex]?.trim() ?? "" : "";
    const value = q.multiSelect
      ? [...selected, otherText].filter(Boolean).join(", ")
      : otherText || selected[0] || "";

    if (value) {
      answers[q.question] = value;
    }
  });

  return answers;
}

export function DecisionPanel({
  request,
  onSubmit,
  compact = false,
}: {
  request: PermissionRequest;
  onSubmit: (result: PermissionResult) => void;
  compact?: boolean;
}) {
  const input = request.input as AskUserQuestionInput | null;
  const questions = normalizeAskUserQuestions(input);
  const figmaAuthUrl = typeof input?.figmaAuthUrl === "string" ? input.figmaAuthUrl : "";
  const allowFreeformAnswer = !figmaAuthUrl;
  const requestKey = request.toolUseId;
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const questionRefs = useRef<Array<HTMLElement | null>>([]);
  const [selectedOptionsByRequest, setSelectedOptionsByRequest] = useState<Record<string, SelectedOptionsByQuestion>>({});
  const [otherInputsByRequest, setOtherInputsByRequest] = useState<Record<string, OtherInputsByQuestion>>({});
  const [copiedAuthUrlByRequest, setCopiedAuthUrlByRequest] = useState<Record<string, boolean>>({});
  const [expandedByRequest, setExpandedByRequest] = useState<Record<string, boolean>>({});
  const selectedOptions = selectedOptionsByRequest[requestKey] ?? {};
  const otherInputs = otherInputsByRequest[requestKey] ?? {};
  const copiedAuthUrl = copiedAuthUrlByRequest[requestKey] ?? false;
  const expanded = expandedByRequest[requestKey] ?? true;
  const currentQuestionIndex = getCurrentQuestionIndex(questions, selectedOptions, otherInputs, allowFreeformAnswer);

  const scrollToQuestion = (qIndex: number) => {
    const nextIndex = clampQuestionIndex(qIndex, questions.length);
    window.requestAnimationFrame(() => {
      questionRefs.current[nextIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const answeredQuestionCount = questions.reduce((count, _, qIndex) => (
    isQuestionAnswered(qIndex, selectedOptions, otherInputs, allowFreeformAnswer) ? count + 1 : count
  ), 0);

  const canSubmit = questions.length > 0 && answeredQuestionCount === questions.length;

  const handleOptionClick = (qIndex: number, optionLabel: string, multiSelect?: boolean) => {
    setSelectedOptionsByRequest((prev) => {
      const currentRequestOptions = prev[requestKey] ?? {};
      const current = currentRequestOptions[qIndex] ?? [];
      const next = multiSelect
        ? current.includes(optionLabel)
          ? current.filter((label) => label !== optionLabel)
          : [...current, optionLabel]
        : [optionLabel];
      return { ...prev, [requestKey]: { ...currentRequestOptions, [qIndex]: next } };
    });

    if (!multiSelect) {
      setOtherInputsByRequest((prev) => {
        const currentRequestInputs = prev[requestKey] ?? {};
        if (!currentRequestInputs[qIndex]) return prev;
        return { ...prev, [requestKey]: { ...currentRequestInputs, [qIndex]: "" } };
      });
      if (qIndex < questions.length - 1) {
        window.setTimeout(() => scrollToQuestion(qIndex + 1), 80);
      }
    }
  };

  const handleOtherInputChange = (qIndex: number, value: string) => {
    setOtherInputsByRequest((prev) => ({
      ...prev,
      [requestKey]: { ...(prev[requestKey] ?? {}), [qIndex]: value },
    }));

    if (value.trim()) {
      setSelectedOptionsByRequest((prev) => {
        const currentRequestOptions = prev[requestKey] ?? {};
        if (!currentRequestOptions[qIndex]?.length) return prev;
        return { ...prev, [requestKey]: { ...currentRequestOptions, [qIndex]: [] } };
      });
    }
  };

  if (request.toolName === "AskUserQuestion" && questions.length > 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-[#dfe3ea] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
        <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-[#eef1f4] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <MessageSquare className="h-4 w-4 shrink-0 text-[#5f6772]" aria-hidden="true" />
            <span className="truncate text-[15px] font-medium text-ink-800">请回答以下问题</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm text-muted">
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-ink-700 transition hover:bg-[#f4f6f8]"
              aria-label="上一题"
              title="上一题"
              onClick={() => scrollToQuestion(currentQuestionIndex - 1)}
            >
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-10 text-center tabular-nums">
              {currentQuestionIndex + 1} / {questions.length}
            </span>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-ink-700 transition hover:bg-[#f4f6f8]"
              aria-label="下一题"
              title="下一题"
              onClick={() => scrollToQuestion(currentQuestionIndex + 1)}
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="ml-1 rounded-md border border-[#dfe3ea] bg-white px-2 py-1 text-[12px] font-medium text-muted transition hover:bg-[#f7f8fa] hover:text-ink-800"
              aria-expanded={expanded}
              onClick={() => setExpandedByRequest((prev) => ({ ...prev, [requestKey]: !(prev[requestKey] ?? true) }))}
            >
              {expanded ? "收起" : "展开"}
            </button>
          </div>
        </div>

        {!expanded && (
          <div className="px-4 py-3 text-sm text-muted">
            已回答 {answeredQuestionCount} / {questions.length} 个问题
          </div>
        )}

        {expanded && (
          <>
            <div
              ref={scrollContainerRef}
              className={`scroll-smooth overflow-y-auto px-4 ${compact ? "max-h-[min(42vh,330px)] py-3" : "max-h-[min(52vh,440px)] py-4"}`}
            >
              <div className="grid gap-5">
                {questions.map((q, qIndex) => {
                  const selected = selectedOptions[qIndex] ?? [];
                  const otherText = otherInputs[qIndex] ?? "";
                  const isAnswered = isQuestionAnswered(qIndex, selectedOptions, otherInputs, allowFreeformAnswer);
                  const customOptionLabel = OPTION_LABELS[(q.options?.length ?? 0)] ?? "自定义";

                  return (
                    <section
                      key={`${q.question}-${qIndex}`}
                      ref={(node) => {
                        questionRefs.current[qIndex] = node;
                      }}
                      className="scroll-mt-3"
                    >
                      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                        <QuestionStepIcon answered={isAnswered} index={qIndex} />
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-[15px] font-semibold leading-6 text-ink-900">
                              {qIndex + 1}.
                            </span>
                            <h3 className="min-w-0 flex-1 text-[15px] font-semibold leading-6 text-ink-900 [overflow-wrap:anywhere]">
                              {q.question}
                            </h3>
                            {q.header && (
                              <span className="shrink-0 rounded-md border border-[#e1e5eb] bg-[#f7f8fa] px-2 py-0.5 text-[11px] text-muted">
                                {q.header}
                              </span>
                            )}
                            {q.multiSelect && (
                              <span className="shrink-0 rounded-md bg-[#eef7ff] px-2 py-0.5 text-[11px] font-medium text-[#0969da]">
                                多选
                              </span>
                            )}
                          </div>

                          <div className="mt-3 grid gap-2">
                            {(q.options ?? []).map((option, optIndex) => {
                              const isSelected = selected.includes(option.label);
                              return (
                                <button
                                  key={`${option.label}-${optIndex}`}
                                  type="button"
                                  className={`group flex min-w-0 items-start gap-3 rounded-md border px-3 py-2 text-left transition ${
                                    isSelected
                                      ? "border-[#cfd8e3] bg-[#f3f7fb] text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.02)]"
                                      : "border-transparent bg-white text-ink-800 hover:border-[#dfe3ea] hover:bg-[#fafbfc]"
                                  }`}
                                  onClick={() => handleOptionClick(qIndex, option.label, q.multiSelect)}
                                  aria-pressed={isSelected}
                                >
                                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-[13px] font-medium ${
                                    isSelected
                                      ? "border-[#b8c4d1] bg-white text-ink-900"
                                      : "border-[#d7dce3] bg-white text-muted group-hover:text-ink-800"
                                  }`}>
                                    {OPTION_LABELS[optIndex] ?? optIndex + 1}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[15px] leading-6 [overflow-wrap:anywhere]">{option.label}</span>
                                    {option.description && (
                                      <span className="mt-0.5 block text-[12px] leading-5 text-muted [overflow-wrap:anywhere]">
                                        {option.description}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}

                            {allowFreeformAnswer && (
                              <label className="flex min-w-0 items-start gap-3 rounded-md border border-transparent bg-white px-3 py-2 text-left transition focus-within:border-[#dfe3ea] focus-within:bg-[#fafbfc]">
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-[#d7dce3] bg-white text-[13px] font-medium text-muted">
                                  {customOptionLabel}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[15px] leading-6 text-ink-800">或输入自定义答案</span>
                                  <input
                                    type="text"
                                    className="mt-1 w-full border-0 bg-transparent px-0 py-1 text-[14px] leading-5 text-ink-800 outline-none placeholder:text-[#a6a8ad]"
                                    placeholder="输入后可继续选择下一题"
                                    value={otherText}
                                    onChange={(event) => handleOtherInputChange(qIndex, event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" && otherText.trim() && qIndex < questions.length - 1) {
                                        event.preventDefault();
                                        scrollToQuestion(qIndex + 1);
                                      }
                                    }}
                                  />
                                </span>
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>

              {figmaAuthUrl && (
                <div className="mt-5 rounded-lg border border-[#dfe3ea] bg-[#fafbfc] p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Figma OAuth</div>
                  <div className="mt-2 break-all text-xs leading-5 text-ink-700">{figmaAuthUrl}</div>
                  <div className="mt-2 text-xs leading-5 text-muted">
                    请用外部浏览器打开授权链接。授权完成后，直接在上方问题里选择对应状态；不要把 localhost callback 地址粘回这里。
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-[#111111] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-black"
                      onClick={() => {
                        void (window.electron as typeof window.electron & { invoke?: (channel: string, ...args: unknown[]) => Promise<unknown> })
                          .invoke?.("shell:openExternal", figmaAuthUrl)
                          .catch(() => window.open(figmaAuthUrl, "_blank", "noopener,noreferrer"));
                      }}
                    >
                      打开授权链接
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-[#dfe3ea] bg-white px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-[#f4f6f8]"
                      onClick={() => {
                        void copyTextToClipboard(figmaAuthUrl).then(() => {
                          setCopiedAuthUrlByRequest((prev) => ({ ...prev, [requestKey]: true }));
                        });
                      }}
                    >
                      {copiedAuthUrl ? "已复制" : "复制授权链接"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#eef1f4] px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted">
                <Sparkles className="h-4 w-4 shrink-0 text-ink-700" aria-hidden="true" />
                <span className="truncate">推荐选项</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-[#f4f6f8] hover:text-ink-800"
                  onClick={() => onSubmit({ behavior: "deny", message: "User canceled the question" })}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white transition ${
                    canSubmit ? "bg-[#111111] hover:bg-black" : "cursor-not-allowed bg-[#c9ced6]"
                  }`}
                  onClick={() => {
                    if (!canSubmit) return;
                    onSubmit({
                      behavior: "allow",
                      updatedInput: {
                        ...(input as Record<string, unknown>),
                        answers: buildAnswers(questions, selectedOptions, otherInputs, allowFreeformAnswer),
                      },
                    });
                  }}
                  disabled={!canSubmit}
                >
                  继续
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#dfe3ea] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.10)]">
      <div className="text-xs font-semibold text-muted">权限请求</div>
      <p className="mt-2 text-sm text-ink-700">
        Agent 想要使用：<span className="font-medium">{request.toolName}</span>
      </p>
      <div className="mt-3 rounded-md bg-[#f6f8fa] p-3">
        <pre className="max-h-40 whitespace-pre-wrap break-words font-mono text-xs text-ink-600">
          {JSON.stringify(request.input, null, 2)}
        </pre>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-[#111111] px-4 py-2 text-sm font-medium text-white transition hover:bg-black"
          onClick={() => onSubmit({ behavior: "allow", updatedInput: request.input as Record<string, unknown> })}
        >
          允许
        </button>
        <button
          type="button"
          className="rounded-md border border-[#dfe3ea] bg-white px-4 py-2 text-sm font-medium text-ink-700 transition hover:bg-[#f4f6f8]"
          onClick={() => onSubmit({ behavior: "deny", message: "User denied the request" })}
        >
          拒绝
        </button>
      </div>
    </div>
  );
}
