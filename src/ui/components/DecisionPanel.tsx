import { useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { CheckCircle2, ChevronDown, Circle } from "lucide-react";
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

function QuestionStepIcon({ answered }: { answered: boolean }) {
  return answered
    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
    : <Circle className="h-4 w-4 text-accent" aria-hidden="true" />;
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
        className={`flex flex-col overflow-hidden rounded-xl border border-accent/18 bg-[#FFF8F5] shadow-[0_12px_30px_rgba(30,38,52,0.08)] ${
          compact ? "max-h-[min(42vh,360px)] p-2.5" : "max-h-[min(58vh,540px)] p-3"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-accent/12 pb-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">需要你选择</div>
            <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-800">
              Agent 等待确认 · {answeredQuestionCount}/{questions.length}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-md border border-accent/18 bg-white/80 px-2 py-1 text-[11px] font-semibold text-accent">
              StepForm
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-accent/18 bg-white/80 text-accent transition-colors hover:bg-white"
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
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              {questions.map((q, qIndex) => {
                const selected = selectedOptions[qIndex] ?? [];
                const otherText = otherInputs[qIndex]?.trim() ?? "";
                const isAnswered = selected.length > 0 || otherText.length > 0;
                return (
                  <div key={qIndex} className={`grid grid-cols-[22px_minmax(0,1fr)] gap-2 rounded-lg border border-black/6 bg-white/72 px-2.5 py-2 ${qIndex === 0 ? "" : "mt-2"}`}>
                    <div className="flex flex-col items-center pt-0.5">
                      <QuestionStepIcon answered={isAnswered} />
                      {qIndex < questions.length - 1 && <div className="mt-1 h-full min-h-6 w-px bg-accent/14" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className="rounded-md bg-accent/8 px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                          {qIndex + 1}
                        </span>
                        {q.header && (
                          <span className="max-w-full truncate rounded-md border border-black/6 bg-white px-1.5 py-0.5 text-[11px] text-muted">
                            {q.header}
                          </span>
                        )}
                        {q.multiSelect && <span className="text-[11px] text-muted">多选</span>}
                      </div>
                    <p className="mt-1 text-[13px] font-semibold leading-5 text-ink-800 [overflow-wrap:anywhere]">{q.question}</p>
                    {q.header && (
                      <span className="sr-only">
                        {q.header}
                      </span>
                    )}
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {(q.options ?? []).map((option, optIndex) => {
                        const isSelected = selected.includes(option.label);
                        return (
                          <button
                            key={optIndex}
                            type="button"
                            className={`min-w-0 rounded-md border px-2.5 py-2 text-left text-[13px] leading-5 transition-colors [overflow-wrap:anywhere] ${
                              isSelected
                                ? "border-accent/40 bg-white text-accent shadow-[0_6px_14px_rgba(232,117,81,0.12)]"
                                : "border-black/8 bg-white/65 text-ink-700 hover:border-accent/26 hover:bg-white"
                            }`}
                            onClick={() => {
                              toggleOption(qIndex, option.label, q.multiSelect);
                            }}
                            aria-pressed={isSelected}
                          >
                            <span className="block truncate font-semibold">{option.label}</span>
                            {option.description && <span className="block truncate text-[11px] text-muted">{option.description}</span>}
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
                          className="mt-1 w-full rounded-md border border-black/8 bg-white/78 px-2.5 py-1.5 text-sm text-ink-700 outline-none transition focus:border-accent/45 focus:bg-white"
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
            <div className={`${compact ? "mt-3" : "mt-5"} flex shrink-0 flex-wrap gap-3`}>
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
