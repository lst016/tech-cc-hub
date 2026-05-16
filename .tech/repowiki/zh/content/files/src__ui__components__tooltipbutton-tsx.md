# src/ui/components/TooltipButton.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：57

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `TooltipButton@8`
- `resolvedTooltip@17`
- `finalTitle@18`
- `finalAriaLabel@19`
- `TooltipButtonProps@3`

## 依赖输入

- `react`

## 对外暴露

- `TooltipButton`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

type TooltipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip?: string;
  children: ReactNode;
};

export const TooltipButton = forwardRef<HTMLButtonElement, TooltipButtonProps>(({
  tooltip,
  title,
  "aria-label": ariaLabel,
  children,
  className,
  ...rest
}, ref) => {
  const resolvedTooltip = tooltip ?? ariaLabel ?? title;
  const finalTitle = title ?? resolvedTooltip;
  const finalAriaLabel = ariaLabel ?? resolvedTooltip ?? "按钮";

  if (!resolvedTooltip) {
    return (
      <button
        ref={ref}
        title={finalTitle}
        aria-label={finalAriaLabel}
        className={className}
        {...rest}
      >
        {children}
      </button>
    );
  }

  return (
    <span className="group relative z-[20000] inline-flex hover:z-[30000] focus-within:z-[30000]">
      <button
        ref={ref}
        title={finalTitle}
        aria-label={finalAriaLabel}
        className={className}
        {...rest}
      >
        {children}
      </button>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-[30001] mt-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-black/10 bg-[rgba(20,24,31,0.96)] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-[0_12px_24px_rgba(15,23,42,0.28)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
        role="tooltip"
      >
        {resolvedTooltip}
      </span>
    </span>
  );
});

TooltipButton.displayName = "TooltipButton";

```
