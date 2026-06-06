import { useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { CheckCircle2, ChevronDown } from "lucide-react";
import type { PermissionRequest } from "../store/useAppStore";
import { copyTextToClipboard } from "../utils/clipboard";

type AskUserQuestionInput = {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
  answers?: Record<string, string>;
  figmaAuthUrl?: string;
};

type SelectedOptionsByQuestion = Record<number, string[]>;
type OtherInputsByQuestion = Record<number, string>;

function QuestionStepIcon({ answered, index }: { answered: boolean; index: number }) {
  return answered ? (
    <span className="grid h-6 w-6 place-items-center rounded-full border border-accent/30 bg-accent text-white shadow-[0_6px_16px_rgba(210,106,61,0.22)]">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  ) : (
    <span className="grid h-6 w-6 place-items-center rounded-full border border-accent/30 bg-white text-[11px] font-semibold text-accent">
      {index + 1}
    </span>
  );
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
  const questions = input?.questions ?? [];
  const figmaAuthUrl = typeof input?.figmaAuthUrl === "string" ? input.figmaAuthUrl : "";
  const allowFreeformAnswer = !figmaAuthUrl;
  const requestKey = request.toolUseId;
  const [selectedOptionsByRequest, setSelectedOptionsByRequest] = useState<Record<string, SelectedOptionsByQuestion>>({});
  const [otherInputsByRequest, setOtherInputsByRequest] = useState<Record<string, OtherInputsByQuestion>>({});
  const [copiedAuthUrlByRequest, setCopiedAuthUrlByRequest] = useState<Record<string, boolean>>({});
  const [expandedByRequest, setExpandedByRequest] = useState<Record<string, boolean>>({});
  const selectedOptions = selectedOptionsByRequest[requestKey] ?? {};
  const otherInputs = otherInputsByRequest[requestKey] ?? {};
  const copiedAuthUrl = copiedAuthUrlByRequest[requestKey] ?? false;
  const expanded = expandedByRequest[requestKey] ?? true;

  const toggleOption = (qIndex: number, optionLabel: string, multiSelect?: boolean) => {
    setSelectedOptionsByRequest((prev) => {
      const currentRequestOptions = prev[requestKey] ?? {};
      const current = currentRequestOptions[qIndex] ?? [];
      if (multiSelect) {
        const next = current.includes(optionLabel)
          ? current.filter((label) => label !== optionLabel)
          : [...current, optionLabel];
        return { ...prev, [requestKey]: { ...currentRequestOptions, [qIndex]: next } };
      }
      return { ...prev, [requestKey]: { ...currentRequestOptions, [qIndex]: [optionLabel] } };
    });
  };

  const buildAnswers = () => {
    const answers: Record<string, string> = {};
    questions.forEach((q, qIndex) => {
      const selected = selectedOptions[qIndex] ?? [];
      const otherText = allowFreeformAnswer ? otherInputs[qIndex]?.trim() ?? "" : "";
      let value = "";
      if (q.multiSelect) {
        const combined = [...selected];
        if (otherText) combined.push(otherText);
        value = combined.join(", ");
      } else {
        value = otherText || selected[0] || "";
      }
      if (value) answers[q.question] = value;
    });
    return answers;
  };

  const canSubmit = questions.every((_, qIndex) => {
    const selected = selectedOptions[qIndex] ?? [];
    const otherText = allowFreeformAnswer ? otherInputs[qIndex]?.trim() ?? "" : "";
    return selected.length > 0 || otherText.length > 0;
  });

  const answeredQuestionCount = questions.reduce((count, _, qIndex) => {
    const selected = selectedOptions[qIndex] ?? [];
    const otherText = allowFreeformAnswer ? otherInputs[qIndex]?.trim() ?? "" : "";
    return selected.length > 0 || otherText.length > 0 ? count + 1 : count;
  }, 0);

  if (request.toolName === "AskUserQuestion" && questions.length > 0) {
    return (
      <div
        className={`flex flex-col rounded-xl border border-accent/18 bg-white/95 shadow-[0_18px_45px_rgba(30,38,52,0.10)] ring-1 ring-white/80 ${
          compact ? "p-3" : "p-4"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/6 pb-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_rgba(210,106,61,0.12)]" />
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">需要你选择</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-800">
                Agent 等待确认 · {answeredQuestionCount}/{questions.length}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-md border border-accent/18 bg-accent/8 px-2 py-1 text-[11px] font-semibold text-accent">
              步骤确认
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-black/8 bg-white text-ink-600 transition-colors hover:border-accent/28 hover:bg-accent/6 hover:text-accent"
              aria-label={expanded ? "收起确认面板" : "展开确认面板"}
              aria-expanded={expanded}
              title={expanded ? "收起" : "展开"}
              onClick={() => {
                setExpandedByRequest((prev) => ({ ...prev, [requestKey]: !(prev[requestKey] ?? true) }));
              }}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        {!expanded && (
          <div className="mt-2 truncate text-xs text-muted">
            {answeredQuestionCount > 0 ? `已选择 ${answeredQuestionCount}/${questions.length} 项` : `待选择 ${questions.length} 项`}
          </div>
        )}
        {expanded && (
          <>
            <div className="mt-3">
              {questions.map((q, qIndex) => {
                const selected = selectedOptions[qIndex] ?? [];
                const otherText = otherInputs[qIndex]?.trim() ?? "";
                const isAnswered = selected.length > 0 || otherText.length > 0;
                return (
                  <div key={qIndex} className={`grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 ${qIndex === 0 ? "" : "mt-3"}`}>
                    <div className="flex flex-col items-center pt-1.5">
                      <QuestionStepIcon answered={isAnswered} index={qIndex} />
                      {qIndex < questions.length - 1 && <div className="mt-1 h-full min-h-10 w-px bg-[linear-gradient(180deg,rgba(210,106,61,0.28),rgba(210,106,61,0.08))]" />}
                    </div>
                    <div className="min-w-0 rounded-lg border border-black/6 bg-[#FBFCFE] px-3 py-2.5 shadow-[0_8px_24px_rgba(30,38,52,0.04)]">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {q.header && (
                          <span className="max-w-full truncate rounded-md border border-black/6 bg-white px-2 py-0.5 text-[11px] font-medium text-muted">
                            {q.header}
                          </span>
                        )}
                        {q.multiSelect && <span className="rounded-md bg-accent/8 px-1.5 py-0.5 text-[11px] font-semibold text-accent">多选</span>}
                      </div>
                    <p className="mt-1.5 text-[13px] font-semibold leading-5 text-ink-800 [overflow-wrap:anywhere]">{q.question}</p>
                    {q.header && (
                      <span className="sr-only">
                        {q.header}
                      </span>
                    )}
                    <div className="mt-2.5 grid grid-cols-1 gap-2">
                      {(q.options ?? []).map((option, optIndex) => {
                        const isSelected = selected.includes(option.label);
                        return (
                          <button
                            key={optIndex}
                            type="button"
                            className={`relative min-w-0 overflow-hidden rounded-md border px-3 py-2.5 text-left text-[13px] leading-5 transition-colors [overflow-wrap:anywhere] ${
                              isSelected
                                ? "border-accent/40 bg-accent/[0.07] text-ink-800 shadow-[0_8px_18px_rgba(210,106,61,0.12)]"
                                : "border-black/8 bg-white text-ink-700 hover:border-accent/28 hover:bg-accent/5"
                            }`}
                            onClick={() => {
                              toggleOption(qIndex, option.label, q.multiSelect);
                            }}
                            aria-pressed={isSelected}
                          >
                            {isSelected && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
                            <span className={`block font-semibold ${isSelected ? "text-accent" : "text-ink-800"}`}>{option.label}</span>
                            {option.description && <span className="mt-0.5 block text-[11px] leading-4 text-muted">{option.description}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {(selected.length > 0 || otherText) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        <span>当前选择</span>
                        {[...selected, otherText].filter(Boolean).map((label) => (
                          <span key={label} className="rounded-md bg-white px-1.5 py-0.5 font-semibold text-accent shadow-[inset_0_0_0_1px_rgba(232,117,81,0.18)] [overflow-wrap:anywhere]">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {allowFreeformAnswer ? (
                      <div className="mt-2">
                        <label className="block text-[11px] font-medium text-muted">其他回答</label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-md border border-black/8 bg-white px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-accent/45 focus:bg-white focus:shadow-[0_0_0_3px_rgba(210,106,61,0.10)]"
                          placeholder="输入你的回答..."
                          value={otherInputs[qIndex] ?? ""}
                          onChange={(e) => {
                            setOtherInputsByRequest((prev) => ({
                              ...prev,
                              [requestKey]: { ...(prev[requestKey] ?? {}), [qIndex]: e.target.value },
                            }));
                          }}
                        />
                      </div>
                    ) : (
                      <div className="mt-2 rounded-md border border-accent/12 bg-white/62 px-2.5 py-2 text-xs leading-5 text-muted">
                        这一步不要粘贴 localhost callback URL。请直接选择上面的状态；如果 localhost 页面打不开，改用 Figma Desktop MCP。
                      </div>
                    )}
                    </div>
                  </div>
                );
              })}
              {figmaAuthUrl && (
                <div className={`${compact ? "mt-3" : "mt-4"} rounded-2xl border border-accent/18 bg-white/72 p-3`}>
                  <div className="text-xs font-bold uppercase tracking-[0.14em] text-accent">Figma OAuth</div>
                  <div className="mt-1 break-all text-xs text-muted">{figmaAuthUrl}</div>
                  <div className="mt-2 text-xs leading-5 text-ink-700">
                    请用外部浏览器打开授权链接。授权后如果 localhost 页面正常显示完成，就点「授权已完成」；不要把 callback 地址粘回这里。
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-accent-hover"
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
                      className="rounded-full border border-ink-900/10 bg-surface px-4 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-surface-tertiary"
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
            <div className={`${compact ? "mt-3" : "mt-5"} flex shrink-0 flex-wrap gap-3 border-t border-black/6 pt-3`}>
              <button
                className={`rounded-full px-5 py-2 text-sm font-medium text-white shadow-soft transition-colors ${
                  canSubmit ? "bg-accent hover:bg-accent-hover" : "bg-ink-400/40 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (!canSubmit) return;
                  onSubmit({ behavior: "allow", updatedInput: { ...(input as Record<string, unknown>), answers: buildAnswers() } });
                }}
                disabled={!canSubmit}
              >
                用已选项继续
              </button>
              <button
                className="rounded-full border border-ink-900/10 bg-surface px-5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-tertiary"
                onClick={() => onSubmit({ behavior: "deny", message: "User canceled the question" })}
              >
                取消
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent-subtle p-5">
      <div className="text-xs font-semibold text-accent">权限请求</div>
      <p className="mt-2 text-sm text-ink-700">
        Claude 想要使用：<span className="font-medium">{request.toolName}</span>
      </p>
      <div className="mt-3 rounded-xl bg-surface-tertiary p-3">
        <pre className="text-xs text-ink-600 font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
          {JSON.stringify(request.input, null, 2)}
        </pre>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition-colors"
          onClick={() => onSubmit({ behavior: "allow", updatedInput: request.input as Record<string, unknown> })}
        >
          允许
        </button>
        <button
          className="rounded-full border border-ink-900/10 bg-surface px-5 py-2 text-sm font-medium text-ink-700 hover:bg-surface-tertiary transition-colors"
          onClick={() => onSubmit({ behavior: "deny", message: "User denied the request" })}
        >
          拒绝
        </button>
      </div>
    </div>
  );
}
