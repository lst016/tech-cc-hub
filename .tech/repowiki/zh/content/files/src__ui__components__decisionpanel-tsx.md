# src/ui/components/DecisionPanel.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：235

## 文件职责

决策面板组件，处理AskUserQuestion工具的权限请求和用户交互

## 关键符号

- `DecisionPanel@0 - 决策面板主组件，渲染问题选项和输入`
- `toggleOption@0 - 切换选项选中状态`
- `buildAnswers@0 - 构建用户答案对象`

## 依赖输入

- `react`
- `@anthropic-ai/claude-agent-sdk`
- `../store/useAppStore`
- `../utils/clipboard`

## 对外暴露

- `DecisionPanel`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useEffect, useState } from "react";
import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
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
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string[]>>({});
  const [otherInputs, setOtherInputs] = useState<Record<number, string>>({});
  const [copiedAuthUrl, setCopiedAuthUrl] = useState(false);

  useEffect(() => {
    setSelectedOptions({});
    setOtherInputs({});
    setCopiedAuthUrl(false);
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
                    className={`max-w-full r
... (truncated)
```
