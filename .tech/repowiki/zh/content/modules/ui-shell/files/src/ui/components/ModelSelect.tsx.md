# src/ui/components/ModelSelect.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：499

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `ModelSelect@122`
- `buildGroupedModelOptions@297`
- `getModelGroupDefinition@331`
- `getSelectedModelLabel@336`
- `getModelSearchScore@343`
- `normalizeSearchText@366`
- `getSearchTokens@370`
- `compactSearchText@378`
- `getSegmentInitials@382`
- `scoreModelSearchToken@390`
- `compareScoredModelOptions@440`
- `getFuzzySubsequenceScore@448`
- `isFuzzySubsequence@489`
- `cx@495`
- `labelId@137`
- `listboxId@138`
- `containerRef@139`
- `groupedOptions@142`
- `firstVisibleOption@146`
- `selectedLabel@147`
- `isComposer@148`
- `handlePointerDown@154`
- `handleKeyDown@160`
- `closeMenu@173`
- `selectOption@178`
- `selected@269`
- `hasQuery@299`
- `groups@300`
- `addOption@301`
- `group@302`
- `searchScore@308`
- `definition@315`
- `searchScore@316`
- `normalizedModel@333`
- `tokens@345`
- `model@349`
- `group@351`
- `compactModel@352`
- `segmentInitials@353`
- `totalScore@354`

## 依赖输入

- `react`
- `lucide-react`

## 对外暴露

- `ModelOption`
- `MODEL_GROUP_DEFINITIONS`
- `ModelSelect`
- `buildGroupedModelOptions`
- `getModelSearchScore`
- `getFuzzySubsequenceScore`
- `isFuzzySubsequence`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

export type ModelOption = {
  value: string;
  label: string;
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
    test: (model) =>
      /image|vision|visual|vl|video|audio|speech|tts|whisper|sora|seedance|hailuo/.test(model),
  },
];

export function ModelSelect({
  label,
  value,
  models,
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const groupedOptions = useMemo(
    () => buildGroupedModelOptions(models, query, emptyOption),
    [emptyOption, models, query],
  );
  const firstVisibleOption = groupedOptions[0]?.options[0];
  const selectedLabel = getSelectedModelLabel(value, emptyOption);
  const isComposer = variant === "composer";

  useEffect(() => {
    if (!open) {
      return;
    }

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
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
  };

  const selectOption = (nextV
... (truncated)
```
