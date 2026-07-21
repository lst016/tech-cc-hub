import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { isLikelyImageUnderstandingModel } from "../../../shared/models/model-capabilities.js";
import {
  getModelSelectMenuLayout,
  type ModelSelectMenuLayout,
} from "./model-select-layout.js";

export type ModelOption = {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  title?: string;
  contextWindow?: number;
};

type ModelGroup = {
  id: string;
  label: string;
  options: ModelOption[];
};

type ScoredModelOption = ModelOption & {
  searchScore: number;
};

type ScoredModelGroup = Omit<ModelGroup, "options"> & {
  options: ScoredModelOption[];
};

type ModelGroupDefinition = {
  id: string;
  label: string;
  test: (model: string) => boolean;
};

type ModelSelectVariant = "settings" | "composer";
type ModelSelectPlacement = "bottom" | "top";

type ModelSelectProps = {
  label: string;
  value: string;
  models: string[];
  modelOptions?: ModelOption[];
  onChange: (model: string) => void;
  emptyOption?: ModelOption;
  disabled?: boolean;
  variant?: ModelSelectVariant;
  placement?: ModelSelectPlacement;
  className?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
};

const GENERAL_MODEL_GROUP: ModelGroupDefinition = {
  id: "general",
  label: "通用",
  test: () => false,
};

const OTHER_MODEL_GROUP: ModelGroupDefinition = {
  id: "other",
  label: "其他模型",
  test: () => true,
};

export const MODEL_GROUP_DEFINITIONS: ModelGroupDefinition[] = [
  {
    id: "codex",
    label: "Codex / GPT-5",
    test: (model) => /^gpt-5(?:[.-]|$)/.test(model) || model.includes("codex"),
  },
  {
    id: "openai",
    label: "OpenAI / GPT",
    test: (model) => /^(gpt-|o\d|chatgpt)/.test(model) || model.includes("openai"),
  },
  {
    id: "claude",
    label: "Claude",
    test: (model) => model.includes("claude"),
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    test: (model) => model.includes("deepseek"),
  },
  {
    id: "gemini",
    label: "Gemini",
    test: (model) => model.includes("gemini"),
  },
  {
    id: "qwen",
    label: "Qwen / Tongyi",
    test: (model) => model.includes("qwen") || model.includes("tongyi"),
  },
  {
    id: "glm",
    label: "GLM / Zhipu",
    test: (model) => model.includes("glm") || model.includes("zhipu"),
  },
  {
    id: "kimi",
    label: "Kimi / Moonshot",
    test: (model) => model.includes("kimi") || model.includes("moonshot"),
  },
  {
    id: "minimax",
    label: "MiniMax",
    test: (model) => model.includes("minimax"),
  },
  {
    id: "grok",
    label: "Grok / xAI",
    test: (model) => model.includes("grok") || model.includes("xai"),
  },
  {
    id: "doubao",
    label: "Doubao",
    test: (model) => model.includes("doubao"),
  },
  {
    id: "multimodal",
    label: "图像 / 多模态",
    test: (model) => isLikelyImageUnderstandingModel(model)
      || /video|audio|speech|tts|whisper|sora|seedance|hailuo/.test(model),
  },
];

export function ModelSelect({
  label,
  value,
  models,
  modelOptions,
  onChange,
  emptyOption,
  disabled = false,
  variant = "settings",
  placement = "bottom",
  className,
  placeholder = "选择模型",
  searchPlaceholder = "搜索模型 / 分组",
  emptyLabel = "没有匹配模型",
}: ModelSelectProps) {
  const labelId = useId();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuLayout, setMenuLayout] = useState<ModelSelectMenuLayout | null>(null);
  const groupedOptions = useMemo(
    () => buildGroupedModelOptions(modelOptions ?? models, query, emptyOption),
    [emptyOption, modelOptions, models, query],
  );
  const firstVisibleOption = groupedOptions[0]?.options[0];
  const selectedLabel = getSelectedModelLabel(value, emptyOption, modelOptions);
  const selectedOptionTitle = getSelectedModelTitle(value, emptyOption, modelOptions);
  const isComposer = variant === "composer";

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
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

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updateMenuLayout = () => {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      setMenuLayout(getModelSelectMenuLayout(
        trigger.getBoundingClientRect(),
        window.innerWidth,
        window.innerHeight,
        placement,
        isComposer,
      ));
    };

    updateMenuLayout();
    window.addEventListener("resize", updateMenuLayout, { passive: true });
    window.addEventListener("scroll", updateMenuLayout, { capture: true, passive: true });
    return () => {
      window.removeEventListener("resize", updateMenuLayout);
      window.removeEventListener("scroll", updateMenuLayout, true);
    };
  }, [isComposer, open, placement]);

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    closeMenu();
  };

  return (
    <div
      ref={containerRef}
      className={cx(
        isComposer
          ? "relative inline-flex h-8 items-center justify-between gap-1 rounded-xl bg-white px-1.5 text-xs text-ink-700"
          : "relative grid min-w-0 gap-1.5",
        className,
      )}
    >
      <span
        id={labelId}
        className={isComposer ? `whitespace-nowrap text-muted ${disabled ? "" : "cursor-pointer select-none"}` : "text-xs font-medium text-muted"}
        onClick={() => {
          if (isComposer && !disabled) setOpen((current) => !current);
        }}
      >
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={labelId}
        className={cx(
          isComposer
            ? "inline-flex h-7 min-w-0 flex-1 items-center justify-between gap-1 rounded-lg bg-white px-1.5 text-[13px] text-ink-800 transition focus:outline-none focus:ring-1 focus:ring-accent/20"
            : "flex h-[42px] min-w-0 items-center justify-between gap-2 rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-left text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20",
          disabled
            ? "cursor-not-allowed opacity-60"
            : isComposer
              ? "cursor-pointer hover:bg-surface-secondary"
              : "hover:border-accent/45",
        )}
        title={selectedOptionTitle || selectedLabel || placeholder}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className={isComposer ? "min-w-0 flex-1 truncate" : "min-w-0 truncate"}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={cx(isComposer ? "h-3.5 w-3.5 shrink-0 text-muted transition-transform" : "h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && !disabled && typeof document !== "undefined"
        ? createPortal(
          <div
            ref={menuRef}
            className={cx(
              "fixed z-[50000] overflow-hidden rounded-2xl border border-ink-900/10 bg-white shadow-[0_18px_48px_rgba(24,32,46,0.16)]",
              !menuLayout && "invisible",
            )}
            style={menuLayout
              ? {
                  left: menuLayout.left,
                  width: menuLayout.width,
                  ...(menuLayout.direction === "top"
                    ? { bottom: menuLayout.bottom }
                    : { top: menuLayout.top }),
                }
              : undefined}
          >
          <div className="relative border-b border-ink-900/8">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && firstVisibleOption) {
                  event.preventDefault();
                  selectOption(firstVisibleOption.value);
                }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 w-full border-0 bg-white pl-9 pr-3 text-sm text-ink-800 outline-none placeholder:text-muted/70"
            />
          </div>
          <div id={listboxId} role="listbox" className="max-h-72 overflow-y-auto p-1.5">
            {groupedOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted">{emptyLabel}</div>
            ) : (
              groupedOptions.map((group) => (
                <div key={group.id} className="py-1">
                  <div className="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                    <span>{group.label}</span>
                    <span>{group.options.length}</span>
                  </div>
                  <div className="grid gap-1">
                    {group.options.map((option) => {
                      const selected = option.value === value;
                      return (
                        <button
                          key={`${group.id}-${option.value || "empty"}`}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          title={option.title ?? option.description ?? option.label}
                          className={cx(
                            "flex min-h-10 min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                            selected ? "bg-accent/10 text-accent" : "text-ink-800 hover:bg-surface",
                          )}
                          onClick={() => selectOption(option.value)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{option.label}</span>
                            {option.description && (
                              <span className={cx("mt-0.5 block truncate text-[11px]", selected ? "text-accent/75" : "text-muted")}>
                                {option.description}
                              </span>
                            )}
                          </span>
                          {option.badge && (
                            <span className={cx(
                              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                              selected ? "bg-accent/10 text-accent" : "bg-surface-secondary text-muted",
                            )}>
                              {option.badge}
                            </span>
                          )}
                          {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}

export function buildGroupedModelOptions(models: Array<string | ModelOption>, query: string, emptyOption?: ModelOption): ModelGroup[] {
  const hasQuery = getSearchTokens(query).length > 0;
  const groups = new Map<string, ScoredModelGroup>();
  const addOption = (definition: ModelGroupDefinition, option: ModelOption, searchScore: number) => {
    const group = groups.get(definition.id) ?? { id: definition.id, label: definition.label, options: [] };
    group.options.push({ ...option, searchScore });
    groups.set(definition.id, group);
  };

  if (emptyOption) {
    const searchScore = getModelSearchScore(emptyOption.label, GENERAL_MODEL_GROUP.label, query);
    if (searchScore >= 0) {
      addOption(GENERAL_MODEL_GROUP, emptyOption, searchScore);
    }
  }

  models.forEach((item) => {
    const option = typeof item === "string" ? { value: item, label: item } : item;
    const definition = getModelGroupDefinition(option.value);
    const searchLabel = [option.label, option.description, option.badge].filter(Boolean).join(" ");
    const searchScore = getModelSearchScore(searchLabel, definition.label, query);
    if (searchScore >= 0) {
      addOption(definition, option, searchScore);
    }
  });

  const visibleGroups = Array.from(groups.values());
  if (hasQuery) {
    visibleGroups.sort(compareScoredModelGroups);
  }

  return visibleGroups.map((group) => ({
    id: group.id,
    label: group.label,
    options: (hasQuery ? [...group.options].sort(compareScoredModelOptions) : group.options).map(toModelOption),
  }));
}

function toModelOption(option: ScoredModelOption): ModelOption {
  return {
    value: option.value,
    label: option.label,
    ...(option.description ? { description: option.description } : {}),
    ...(option.badge ? { badge: option.badge } : {}),
    ...(option.title ? { title: option.title } : {}),
  };
}

function getModelGroupDefinition(model: string): ModelGroupDefinition {
  const normalizedModel = model.toLowerCase();
  return MODEL_GROUP_DEFINITIONS.find((definition) => definition.test(normalizedModel)) ?? OTHER_MODEL_GROUP;
}

function getSelectedModelLabel(value: string, emptyOption?: ModelOption, options?: ModelOption[]): string {
  if (emptyOption && value === emptyOption.value) {
    return emptyOption.label;
  }
  return options?.find((option) => option.value === value)?.label ?? value;
}

function getSelectedModelTitle(value: string, emptyOption?: ModelOption, options?: ModelOption[]): string {
  if (emptyOption && value === emptyOption.value) {
    return emptyOption.title ?? emptyOption.description ?? emptyOption.label;
  }
  const option = options?.find((item) => item.value === value);
  return option?.title ?? option?.description ?? option?.label ?? value;
}

export function getModelSearchScore(modelLabel: string, groupLabel: string, query: string): number {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) {
    return 0;
  }

  const model = normalizeSearchText(modelLabel);
  const group = normalizeSearchText(groupLabel);
  const compactModel = compactSearchText(model);
  const segmentInitials = getSegmentInitials(model);
  let totalScore = 0;

  for (const token of tokens) {
    const score = scoreModelSearchToken(token, model, group, compactModel, segmentInitials);
    if (score < 0) {
      return -1;
    }
    totalScore += score;
  }

  return totalScore;
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/[_./:]+/g, "-").replace(/-+/g, "-");
}

function getSearchTokens(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => normalizeSearchText(token))
    .filter(Boolean);
}

function compactSearchText(value: string): string {
  return normalizeSearchText(value).replace(/-/g, "");
}

function getSegmentInitials(value: string): string {
  return normalizeSearchText(value)
    .split("-")
    .filter(Boolean)
    .map((segment) => segment[0])
    .join("");
}

function scoreModelSearchToken(
  token: string,
  model: string,
  group: string,
  compactModel: string,
  segmentInitials: string,
): number {
  const compactToken = compactSearchText(token);
  if (compactToken.length === 0) {
    return -1;
  }

  if (model === token || compactModel === compactToken) {
    return 1000;
  }

  const modelIndex = model.indexOf(token);
  if (modelIndex >= 0) {
    return 900 - modelIndex;
  }

  if (compactToken.length >= 2) {
    const compactIndex = compactModel.indexOf(compactToken);
    if (compactIndex >= 0) {
      return 820 - compactIndex;
    }

    const initialsIndex = segmentInitials.indexOf(compactToken);
    if (initialsIndex >= 0) {
      return 680 - initialsIndex;
    }
  }

  if (token.length >= 3) {
    const groupIndex = group.indexOf(token);
    if (groupIndex >= 0) {
      return 600 - groupIndex;
    }
  }

  if (compactToken.length >= 3) {
    const fuzzyScore = getFuzzySubsequenceScore(compactToken, compactModel);
    if (fuzzyScore >= 0) {
      return 420 + fuzzyScore;
    }
  }

  return -1;
}

function compareScoredModelOptions(left: ScoredModelOption, right: ScoredModelOption): number {
  const scoreDelta = right.searchScore - left.searchScore;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }
  return left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: "base" });
}

function compareScoredModelGroups(left: ScoredModelGroup, right: ScoredModelGroup): number {
  const leftScore = Math.max(...left.options.map((option) => option.searchScore));
  const rightScore = Math.max(...right.options.map((option) => option.searchScore));
  return rightScore - leftScore;
}

export function getFuzzySubsequenceScore(needle: string, haystack: string): number {
  if (needle.length < 3) {
    return -1;
  }

  let bestCost = Number.POSITIVE_INFINITY;
  const allowedGaps = Math.max(3, Math.ceil(needle.length * 1.5));

  for (let startIndex = 0; startIndex < haystack.length; startIndex += 1) {
    if (haystack[startIndex] !== needle[0]) {
      continue;
    }

    let needleIndex = 1;
    let endIndex = startIndex;
    for (let haystackIndex = startIndex + 1; haystackIndex < haystack.length; haystackIndex += 1) {
      if (haystack[haystackIndex] !== needle[needleIndex]) {
        continue;
      }

      needleIndex += 1;
      endIndex = haystackIndex;
      if (needleIndex === needle.length) {
        break;
      }
    }

    if (needleIndex !== needle.length) {
      continue;
    }

    const span = endIndex - startIndex + 1;
    const gapCount = span - needle.length;
    if (gapCount <= allowedGaps) {
      bestCost = Math.min(bestCost, gapCount * 10 + startIndex);
    }
  }

  return Number.isFinite(bestCost) ? 360 - bestCost : -1;
}

export function isFuzzySubsequence(needle: string, haystack: string): boolean {
  const compactNeedle = compactSearchText(needle);
  const compactHaystack = compactSearchText(haystack);
  return compactNeedle.length === 0 || getFuzzySubsequenceScore(compactNeedle, compactHaystack) >= 0;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
