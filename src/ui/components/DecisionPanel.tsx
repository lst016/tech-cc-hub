import { useEffect, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { PermissionRequest } from "../store/useAppStore";

type AskUserQuestionInput = {
  questions?: Array<{
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
  answers?: Record<string, string>;
};

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
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>({});
  const [otherInputs, setOtherInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    setSelectedOptions({});
    setOtherInputs({});
  }, [request.toolUseId]);

  const toggleOption = (qIndex: number, optionLabel: string, multiSelect?: boolean) => {
    setSelectedOptions((prev) => {
      const current = prev[qIndex] ?? [];
      if (multiSelect) {
        const next = current.includes(optionLabel)
          ? current.filter((label) => label !== optionLabel)
          : [...current, optionLabel];
        return { ...prev, [qIndex]: next };
      }
      return { ...prev, [qIndex]: [optionLabel] };
    });
  };

  const buildAnswers = () => {
    const answers: Record<string, string> = {};
    questions.forEach((q, qIndex) => {
      const selected = selectedOptions[qIndex] ?? [];
      const otherText = otherInputs[qIndex]?.trim() ?? "";
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
    const otherText = otherInputs[qIndex]?.trim() ?? "";
    return selected.length > 0 || otherText.length > 0;
  });

  if (request.toolName === "AskUserQuestion" && questions.length > 0) {
    return (
      <div className={`rounded-[22px] border border-accent/18 bg-[rgba(253,244,241,0.88)] shadow-[0_18px_48px_rgba(30,38,52,0.08)] ${compact ? "p-3" : "p-5"}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">需要你选择</div>
            <div className="mt-1 text-sm font-semibold text-ink-800">Agent 正在等你的确认</div>
          </div>
          <span className="shrink-0 rounded-full border border-accent/18 bg-white/80 px-2.5 py-1 text-xs font-semibold text-accent">
            Codex 式选择
          </span>
        </div>
        {questions.map((q, qIndex) => {
          const selected = selectedOptions[qIndex] ?? [];
          const otherText = otherInputs[qIndex]?.trim() ?? "";
          return (
          <div key={qIndex} className={compact ? "mt-3" : "mt-4"}>
            <p className="text-sm font-medium text-ink-800">{q.question}</p>
            {q.header && (
              <span className="mt-2 inline-flex items-center rounded-full border border-black/6 bg-white/80 px-2 py-0.5 text-xs text-muted">
                {q.header}
              </span>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {(q.options ?? []).map((option, optIndex) => {
                const isSelected = selected.includes(option.label);
                return (
                  <button
                    key={optIndex}
                    type="button"
                    className={`max-w-full rounded-full border px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-accent/40 bg-white text-accent shadow-[0_8px_20px_rgba(232,117,81,0.14)]"
                        : "border-black/8 bg-white/65 text-ink-700 hover:border-accent/26 hover:bg-white"
                    }`}
                    onClick={() => {
                      toggleOption(qIndex, option.label, q.multiSelect);
                    }}
                    aria-pressed={isSelected}
                  >
                    <span className="font-semibold">{option.label}</span>
                    {option.description && <span className="ml-2 text-xs text-muted">{option.description}</span>}
                  </button>
                );
              })}
            </div>
            {(selected.length > 0 || otherText) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>当前选择</span>
                {[...selected, otherText].filter(Boolean).map((label) => (
                  <span key={label} className="rounded-full bg-white px-2 py-1 font-semibold text-accent shadow-[inset_0_0_0_1px_rgba(232,117,81,0.18)]">
                    {label}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3">
              <label className="block text-xs font-medium text-muted">其他回答</label>
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-black/8 bg-white/78 px-3 py-2 text-sm text-ink-700 outline-none transition focus:border-accent/45 focus:bg-white"
                placeholder="输入你的回答..."
                value={otherInputs[qIndex] ?? ""}
                onChange={(e) => setOtherInputs((prev) => ({ ...prev, [qIndex]: e.target.value }))}
              />
            </div>
            {q.multiSelect && <div className="mt-2 text-xs text-muted">当前问题支持多选。</div>}
          </div>
        )})}
        <div className={`${compact ? "mt-3" : "mt-5"} flex flex-wrap gap-3`}>
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
            className="rounded-full border border-ink-900/10 bg-surface px-5 py-2 text-sm font-medium text-ink-700 hover:bg-surface-tertiary transition-colors"
            onClick={() => onSubmit({ behavior: "deny", message: "User canceled the question" })}
          >
            取消
          </button>
        </div>
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
