import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown } from "lucide-react";
import type { RuntimeReasoningMode } from "../../types";
import type { ModelOption } from "../ModelSelect";

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
  multiplierLabel: string;
  section: "primary" | "new";
};

const CONTEXT_OPTIONS = [
  { value: "200K", label: "200K", defaultFor: ["ultimate", "performance", "efficient", "lite"] },
  { value: "400K", label: "400K", defaultFor: [] },
  { value: "1M", label: "1M", defaultFor: ["deepseek", "qwen", "glm", "kimi", "minimax"] },
];

const THINKING_OPTIONS: Array<{ value: RuntimeReasoningMode; label: string }> = [
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
  { value: "xhigh", label: "xhigh" },
  { value: "disabled", label: "max" },
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
  const selectedContextValue = getDefaultContextValue(selectedKind);
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

  const primaryOptions = displayOptions.filter((option) => option.section === "primary");
  const newOptions = displayOptions.filter((option) => option.section === "new");

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-3 text-[13px] text-ink-700">
      <button
        type="button"
        id={labelId}
        className="inline-flex h-8 items-center gap-2 rounded-lg bg-transparent px-1.5 text-[13px] transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title={selectedOption?.title ?? selectedOption?.description ?? modelValue}
      >
        <span className="text-[#6f7480]">模型</span>
        <span className="max-w-[180px] truncate font-medium text-[#171b23]">{selectedLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-[#6f7480] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      <button
        type="button"
        className="inline-flex h-8 items-center gap-2 rounded-lg bg-transparent px-1.5 text-[13px] transition hover:bg-[#f4f6f8] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        title="思考强度"
      >
        <span className="text-[#6f7480]">思考强度</span>
        <span className="font-medium text-[#171b23]">{selectedThinkingLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-[#6f7480] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && !disabled && (
        <div className="absolute bottom-full left-0 z-50 mb-3 flex max-h-[min(70vh,620px)] items-start gap-3 text-[#f2f2f0]">
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            className="max-h-[min(70vh,620px)] w-[360px] overflow-y-auto rounded-lg border border-white/12 bg-[#151613]/96 p-1.5 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur"
          >
            <div className="grid gap-1">
              {primaryOptions.map((option) => (
                <ComposerModelRow
                  key={option.value}
                  option={option}
                  selected={option.value === modelValue}
                  onSelect={selectModel}
                />
              ))}
            </div>
            {newOptions.length > 0 && (
              <>
                <div className="my-1.5 h-px bg-white/10" />
                <div className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/48">
                  New Models
                </div>
                <div className="grid gap-1">
                  {newOptions.map((option) => (
                    <ComposerModelRow
                      key={option.value}
                      option={option}
                      selected={option.value === modelValue}
                      onSelect={selectModel}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="max-h-[min(70vh,620px)] w-[380px] overflow-y-auto rounded-lg border border-white/12 bg-[#151613]/96 px-4 py-4 shadow-[0_22px_70px_rgba(0,0,0,0.38)] backdrop-blur">
            <div className="mb-5 flex items-center gap-3">
              <ArrowLeft className="h-4 w-4 text-white/62" aria-hidden="true" />
              <div className="min-w-0 truncate text-[17px] font-semibold text-white">{selectedLabel}</div>
            </div>

            <div className="mb-5">
              <div className="mb-3 text-[15px] font-semibold text-white/56">Context</div>
              <div className="grid gap-1">
                {CONTEXT_OPTIONS.map((option) => {
                  const selected = option.value === selectedContextValue;
                  return (
                    <div
                      key={option.value}
                      className="flex h-9 items-center justify-between rounded-md px-2 text-[16px] text-white/90"
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span>{option.label}</span>
                        {selected && <span className="text-[13px] font-medium text-white/50">Default</span>}
                      </span>
                      {selected && <Check className="h-[18px] w-[18px] text-white/62" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mb-3 h-px bg-white/12" />

            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[15px] font-semibold text-white/56">Thinking</div>
                <button
                  type="button"
                  className={`h-6 w-10 rounded-full p-0.5 transition ${reasoningValue === "disabled" ? "bg-white/16" : "bg-[#24d365]"}`}
                  onClick={() => onReasoningChange(reasoningValue === "disabled" ? "high" : "disabled")}
                  aria-label="切换思考"
                >
                  <span className={`block h-5 w-5 rounded-full bg-[#151613] transition ${reasoningValue === "disabled" ? "translate-x-0" : "translate-x-4"}`} />
                </button>
              </div>
              <div className="grid gap-1">
                {THINKING_OPTIONS.map((option) => {
                  const selected = option.value === reasoningValue;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className="flex h-9 items-center justify-between rounded-md px-2 text-left text-[16px] text-white/90 transition hover:bg-white/8"
                      onClick={() => onReasoningChange(option.value)}
                    >
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span>{option.label}</span>
                        {option.value === "high" && <span className="text-[13px] font-medium text-white/50">Default</span>}
                      </span>
                      {selected && <Check className="h-[18px] w-[18px] text-white/62" aria-hidden="true" />}
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
      className={`flex h-10 min-w-0 items-center justify-between gap-4 rounded px-3 text-left text-[16px] transition ${
        selected ? "bg-white/13 text-white" : "text-white/88 hover:bg-white/8"
      }`}
      onClick={() => onSelect(option.value)}
    >
      <span className="min-w-0 truncate font-medium">{option.displayLabel}</span>
      <span className={`shrink-0 text-[14px] font-medium ${selected ? "text-white/68" : "text-white/42"}`}>
        {option.multiplierLabel}
      </span>
    </button>
  );
}

function buildComposerModelOptions(options: ModelOption[]): ComposerModelOption[] {
  const usedKinds = new Set<string>();
  return options.map((option) => {
    const kind = getModelKind(option.value, option.label);
    const primary = getPrimaryModelDisplay(kind, usedKinds);
    if (primary) {
      usedKinds.add(kind);
      return {
        ...option,
        displayLabel: primary.label,
        multiplierLabel: primary.multiplier,
        section: "primary",
      };
    }

    return {
      ...option,
      displayLabel: option.label,
      multiplierLabel: getNewModelMultiplier(option.value),
      section: "new",
    };
  });
}

function getPrimaryModelDisplay(kind: string, usedKinds: Set<string>): { label: string; multiplier: string } | null {
  if (!usedKinds.has("ultimate") && kind === "ultimate") return { label: "Ultimate", multiplier: "1.6x" };
  if (!usedKinds.has("performance") && kind === "performance") return { label: "Performance", multiplier: "1.1x" };
  if (!usedKinds.has("efficient") && kind === "efficient") return { label: "Efficient", multiplier: "0.3x" };
  if (!usedKinds.has("lite") && kind === "lite") return { label: "Lite", multiplier: "0x" };
  return null;
}

function getModelKind(value: string, label = value): string {
  const model = `${value} ${label}`.toLowerCase();
  if (/gpt-5\.5|ultimate/.test(model)) return "ultimate";
  if (/gpt-5\.4(?!-mini)|performance/.test(model)) return "performance";
  if (/gpt-5\.4-mini|gpt-5\.3-codex(?!-spark)|efficient/.test(model)) return "efficient";
  if (/spark|lite|mini/.test(model)) return "lite";
  if (/deepseek/.test(model)) return "deepseek";
  if (/qwen/.test(model)) return "qwen";
  if (/glm/.test(model)) return "glm";
  if (/kimi|moonshot/.test(model)) return "kimi";
  if (/minimax/.test(model)) return "minimax";
  return "new";
}

function getNewModelMultiplier(value: string): string {
  const model = value.toLowerCase();
  if (/deepseek.*pro/.test(model)) return "0.5x";
  if (/deepseek.*flash/.test(model)) return "0.1x";
  if (/glm/.test(model)) return "0.6x";
  if (/kimi/.test(model)) return "0.3x";
  if (/qwen/.test(model)) return "0.2x";
  if (/minimax/.test(model)) return "0.2x";
  return "";
}

function getDefaultContextValue(kind: string): string {
  return CONTEXT_OPTIONS.find((option) => option.defaultFor.includes(kind))?.value ?? "200K";
}

function getReasoningTriggerLabel(value: RuntimeReasoningMode): string {
  if (value === "disabled") return "关闭";
  if (value === "low") return "低";
  if (value === "medium") return "中";
  if (value === "high") return "高";
  return "超高";
}
