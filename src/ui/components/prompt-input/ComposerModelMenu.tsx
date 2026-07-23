import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { RuntimeReasoningMode } from "../../types";
import type { ModelOption } from "../models/ModelSelect";
import {
  filterComposerModelOptions,
  type ComposerModelOption,
} from "./composer-model-search.js";
import { MODEL_USAGE_CHANGED_EVENT, getModelUsageCounts } from "./model-usage-count";

type ComposerModelMenuProps = {
  modelValue: string;
  modelOptions: ModelOption[];
  reasoningMode: RuntimeReasoningMode;
  disabled?: boolean;
  onModelChange: (model: string) => void;
  onReasoningModeChange: (mode: RuntimeReasoningMode) => void;
  placeholder?: string;
};

const CONTEXT_OPTIONS = [
  { value: "200K", label: "200K", defaultFor: ["gpt", "claude"] },
  { value: "400K", label: "400K", defaultFor: [] },
  { value: "1M", label: "1M", defaultFor: ["deepseek", "qwen", "glm", "kimi", "minimax"] },
];

const REASONING_OPTIONS: Array<{ value: RuntimeReasoningMode; label: string; description: string }> = [
  { value: "disabled", label: "关闭", description: "不启用额外思考" },
  { value: "low", label: "低", description: "快速响应" },
  { value: "medium", label: "中", description: "平衡速度和质量" },
  { value: "high", label: "高", description: "更充分推理" },
  { value: "xhigh", label: "超高", description: "最强思考" },
];

type ContextDisplayOption = {
  value: string;
  label: string;
};

export function ComposerModelMenu({
  modelValue,
  modelOptions,
  reasoningMode,
  disabled = false,
  onModelChange,
  onReasoningModeChange,
  placeholder = "选择模型",
}: ComposerModelMenuProps) {
  const labelId = useId();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [modelFilter, setModelFilter] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  // 使用次数计数：仅作为排序依据，不在 UI 显示。计数在发送消息时累加，
  // 通过 window 自定义事件通知此处刷新。
  const [usageCounts, setUsageCounts] = useState(() => getModelUsageCounts());

  const displayOptions = useMemo(() => buildComposerModelOptions(modelOptions), [modelOptions]);
  const filteredOptions = useMemo(
    () => filterComposerModelOptions(displayOptions, modelFilter),
    [displayOptions, modelFilter],
  );
  const sortedOptions = useMemo(
    () => sortOptionsByUsage(filteredOptions, modelFilter, usageCounts),
    [filteredOptions, modelFilter, usageCounts],
  );
  const selectedOption = displayOptions.find((option) => option.value === modelValue);
  const selectedLabel = selectedOption?.displayLabel || modelValue || placeholder;
  const selectedKind = getModelKind(selectedOption?.value ?? modelValue, selectedOption?.displayLabel);
  const selectedContext = getContextDisplay(selectedOption?.contextWindow, selectedKind);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setModelFilter("");
  }, []);

  const getInitialActiveOptionIndex = useCallback(() => {
    const selectedIndex = sortedOptions.findIndex((option) => option.value === modelValue);
    return selectedIndex >= 0 ? selectedIndex : 0;
  }, [modelValue, sortedOptions]);

  const toggleMenu = useCallback(() => {
    setOpen((current) => {
      if (current) {
        setModelFilter("");
      } else {
        setActiveOptionIndex(getInitialActiveOptionIndex());
      }
      return !current;
    });
  }, [getInitialActiveOptionIndex]);

  const selectModel = useCallback((model: string) => {
    onModelChange(model);
    closeMenu();
  }, [closeMenu, onModelChange]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (sortedOptions.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        setActiveOptionIndex((current) => (
          event.key === "ArrowDown"
            ? (current + 1) % sortedOptions.length
            : (current - 1 + sortedOptions.length) % sortedOptions.length
        ));
        return;
      }
      if (event.key === "Enter" && sortedOptions.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        selectModel(sortedOptions[activeOptionIndex]?.value ?? sortedOptions[0].value);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [activeOptionIndex, closeMenu, open, selectModel, sortedOptions]);

  // 计数在发送消息时累加（发生在其他组件），通过 window 自定义事件通知此处刷新排序。
  useEffect(() => {
    const handleUsageChanged = () => setUsageCounts(getModelUsageCounts());
    window.addEventListener(MODEL_USAGE_CHANGED_EVENT, handleUsageChanged);
    return () => window.removeEventListener(MODEL_USAGE_CHANGED_EVENT, handleUsageChanged);
  }, []);

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
        onClick={toggleMenu}
        title={selectedOption?.title ?? selectedOption?.description ?? modelValue}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate">{selectedLabel}</span>
        </span>
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
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-white px-3 py-2">
              <span className="shrink-0 text-[12px] font-semibold text-[#73777f]">模型</span>
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">筛选模型</span>
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca0a7]" aria-hidden="true" />
                <input
                  type="search"
                  value={modelFilter}
                  onChange={(event) => {
                    setModelFilter(event.target.value);
                    setActiveOptionIndex(0);
                  }}
                  className="h-7 w-full rounded-md border border-[#d9dde3] bg-white pl-7 pr-2 text-[12px] font-medium text-[#171b23] outline-none transition placeholder:text-[#a6a8ad] focus:border-[#9bbcf7] focus:ring-2 focus:ring-[#dbeafe]"
                  placeholder="筛选模型"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="grid gap-1">
              {sortedOptions.map((option, index) => (
                <ComposerModelRow
                  key={option.value}
                  option={option}
                  selected={option.value === modelValue}
                  active={index === activeOptionIndex}
                  onSelect={selectModel}
                />
              ))}
              {sortedOptions.length === 0 && (
                <div className="px-3 py-8 text-center text-[13px] font-medium text-[#8a8f98]">
                  没有匹配模型
                </div>
              )}
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

            <div>
              <div className="mb-2 px-1 text-[12px] font-semibold text-[#73777f]">思维强度</div>
              <div className="grid gap-1">
                {REASONING_OPTIONS.map((option) => {
                  const selected = option.value === reasoningMode;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex min-h-9 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px] transition ${
                        selected ? "bg-[#f4f6f8] text-[#171b23]" : "text-[#313743] hover:bg-[#f4f6f8]"
                      }`}
                      onClick={() => onReasoningModeChange(option.value)}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{option.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-[#8a8f98]">{option.description}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-[#6f7480]" aria-hidden="true" />}
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
  active,
  onSelect,
}: {
  option: ComposerModelOption;
  selected: boolean;
  active: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      title={option.title ?? option.description ?? option.value}
      className={`flex h-9 min-w-0 items-center justify-between gap-4 rounded-md px-3 text-left text-[13px] transition ${
        active || selected ? "bg-[#f4f6f8] text-[#171b23]" : "text-[#313743] hover:bg-[#f4f6f8]"
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

/**
 * 无搜索词时按使用次数降序排（常用模型靠上），次数并列时保留原顺序，
 * 让未使用过的模型维持 profile 配置顺序。有搜索词时不重排，避免干扰相关性查找。
 */
function sortOptionsByUsage(
  options: ComposerModelOption[],
  query: string,
  usageCounts: Record<string, number>,
): ComposerModelOption[] {
  if (query.trim()) return options;
  if (options.length <= 1) return options;

  return options
    .map((option, index) => ({ option, index, count: usageCounts[option.value] ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map((entry) => entry.option);
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

