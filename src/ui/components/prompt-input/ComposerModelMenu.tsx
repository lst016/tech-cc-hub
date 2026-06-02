import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { RuntimeReasoningMode } from "../../types";
import type { ModelOption } from "../models/ModelSelect";

type ComposerModelMenuProps = {
  modelValue: string;
  modelOptions: ModelOption[];
  reasoningValue: RuntimeReasoningMode;
  disabled?: boolean;
  onModelChange: (model: string) => void;
  onReasoningChange: (mode: RuntimeReasoningMode) => void;
  placeholder?: string;
};

type ComposerModelOption = ModelOption & {
  displayLabel: string;
  detailLabel: string;
};

const CONTEXT_OPTIONS = [
  { value: "200K", label: "200K", defaultFor: ["gpt", "claude"] },
  { value: "400K", label: "400K", defaultFor: [] },
  { value: "1M", label: "1M", defaultFor: ["deepseek", "qwen", "glm", "kimi", "minimax"] },
];

type ContextDisplayOption = {
  value: string;
  label: string;
};

const THINKING_OPTIONS: Array<{ value: RuntimeReasoningMode; label: string }> = [
  { value: "disabled", label: "关闭" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "xhigh", label: "超高" },
];

export function ComposerModelMenu({
  modelValue,
  modelOptions,
  reasoningValue,
  disabled = false,
  onModelChange,
  onReasoningChange,
  placeholder = "选择模型",
}: ComposerModelMenuProps) {
  const labelId = useId();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const displayOptions = useMemo(() => buildComposerModelOptions(modelOptions), [modelOptions]);
  const selectedOption = displayOptions.find((option) => option.value === modelValue);
  const selectedLabel = selectedOption?.displayLabel || modelValue || placeholder;
  const selectedKind = getModelKind(selectedOption?.value ?? modelValue, selectedOption?.displayLabel);
  const selectedContext = getContextDisplay(selectedOption?.contextWindow, selectedKind);
  const selectedThinkingLabel = getReasoningTriggerLabel(reasoningValue);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  const selectModel = (model: string) => {
    onModelChange(model);
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center text-[13px] text-ink-700">
      <button
        type="button"
        id={labelId}
        className="inline-flex h-8 max-w-[320px] items-center gap-2 rounded-md bg-transparent px-1.5 text-[13px] font-medium text-[#171b23] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title={`${selectedOption?.title ?? selectedOption?.description ?? modelValue}${selectedThinkingLabel ? ` / thinking ${selectedThinkingLabel}` : ""}`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[#73777f]">模型</span>
          <span className="min-w-0 truncate">{selectedLabel}</span>
        </span>
        <span className="h-3.5 w-px shrink-0 bg-[#d9dde3]" aria-hidden="true" />
        <span className="shrink-0 text-[#73777f]">思考强度</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#6f7480] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && !disabled && (
        <div className="absolute bottom-full left-0 z-50 mb-2 flex max-h-[min(70vh,560px)] items-stretch overflow-hidden rounded-xl border border-[#d9dde3] bg-white text-[#171b23] shadow-[0_18px_50px_rgba(30,38,52,0.14)]">
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            className="max-h-[min(70vh,560px)] w-[360px] overflow-y-auto border-r border-[#e6e9ee] p-1.5"
          >
            <div className="px-3 py-2 text-[12px] font-semibold text-[#73777f]">模型</div>
            <div className="grid gap-1">
              {displayOptions.map((option) => (
                <ComposerModelRow
                  key={option.value}
                  option={option}
                  selected={option.value === modelValue}
                  onSelect={selectModel}
                />
              ))}
            </div>
          </div>

          <div className="max-h-[min(70vh,560px)] w-[280px] overflow-y-auto px-3 py-3">
            <div className="mb-4">
              <div className="mb-2 px-1 text-[12px] font-semibold text-[#73777f]">Context</div>
              <div className="grid gap-1">
                {selectedContext.options.map((option) => {
                  const selected = option.value === selectedContext.value;
                  return (
                    <div
                      key={option.value}
                      className="flex h-8 items-center justify-between rounded-md px-2 text-[13px] text-[#171b23]"
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span>{option.label}</span>
                        {selected && <span className="text-[12px] font-medium text-[#8a8f98]">{selectedContext.sourceLabel}</span>}
                      </span>
                      {selected && <Check className="h-4 w-4 text-[#6f7480]" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-3 h-px bg-[#edf0f3]" />

            <div>
              <div className="mb-2 px-1 text-[12px] font-semibold text-[#73777f]">思考强度</div>
              <div className="grid gap-1">
                {THINKING_OPTIONS.map((option) => {
                  const selected = option.value === reasoningValue;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex h-8 items-center justify-between rounded-md px-2 text-left text-[13px] transition ${
                        selected ? "bg-[#f4f6f8] text-[#171b23]" : "text-[#313743] hover:bg-[#f4f6f8]"
                      }`}
                      onClick={() => onReasoningChange(option.value)}
                    >
                      <span>{option.label}</span>
                      {selected && <Check className="h-4 w-4 text-[#6f7480]" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComposerModelRow({
  option,
  selected,
  onSelect,
}: {
  option: ComposerModelOption;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      title={option.title ?? option.description ?? option.value}
      className={`flex h-9 min-w-0 items-center justify-between gap-4 rounded-md px-3 text-left text-[13px] transition ${
        selected ? "bg-[#f4f6f8] text-[#171b23]" : "text-[#313743] hover:bg-[#f4f6f8]"
      }`}
      onClick={() => onSelect(option.value)}
    >
      <span className="min-w-0 truncate font-medium">{option.displayLabel}</span>
      {option.detailLabel && (
        <span className={`shrink-0 text-[12px] font-medium ${selected ? "text-[#6f7480]" : "text-[#9ca0a7]"}`}>
          {option.detailLabel}
        </span>
      )}
    </button>
  );
}

function buildComposerModelOptions(options: ModelOption[]): ComposerModelOption[] {
  return options.map((option) => ({
    ...option,
    displayLabel: option.label,
    detailLabel: option.badge ?? "",
  }));
}

function getModelKind(value: string, label = value): string {
  const model = `${value} ${label}`.toLowerCase();
  if (/deepseek/.test(model)) return "deepseek";
  if (/qwen/.test(model)) return "qwen";
  if (/glm/.test(model)) return "glm";
  if (/kimi|moonshot/.test(model)) return "kimi";
  if (/minimax/.test(model)) return "minimax";
  if (/gpt/.test(model)) return "gpt";
  if (/claude/.test(model)) return "claude";
  return "new";
}

function getDefaultContextValue(kind: string): string {
  return CONTEXT_OPTIONS.find((option) => option.defaultFor.includes(kind))?.value ?? "200K";
}

function getContextDisplay(contextWindow: number | undefined, kind: string): {
  value: string;
  sourceLabel: string;
  options: ContextDisplayOption[];
} {
  const configuredValue = formatContextWindow(contextWindow);
  const value = configuredValue ?? getDefaultContextValue(kind);
  const sourceLabel = configuredValue ? "配置" : "Default";
  const options = CONTEXT_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  if (configuredValue && !options.some((option) => option.value === configuredValue)) {
    options.unshift({ value: configuredValue, label: configuredValue });
  }

  return {
    value,
    sourceLabel,
    options,
  };
}

function formatContextWindow(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  if (value >= 1_000_000 && value % 1_000_000 === 0) {
    return `${value / 1_000_000}M`;
  }
  if (value >= 1_000 && value % 1_000 === 0) {
    return `${value / 1_000}K`;
  }
  return value.toLocaleString("en-US");
}

function getReasoningTriggerLabel(value: RuntimeReasoningMode): string {
  if (value === "disabled") return "关闭";
  if (value === "low") return "低";
  if (value === "medium") return "中";
  if (value === "high") return "高";
  return "超高";
}
