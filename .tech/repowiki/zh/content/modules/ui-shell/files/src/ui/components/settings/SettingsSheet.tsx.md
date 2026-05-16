# src/ui/components/settings/SettingsSheet.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：193

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `SettingsSheet@98`
- `closeOnEscape@109`
- `active@136`
- `SettingsStatusTone@2`
- `SettingsPageDefinition@4`
- `SettingsSheetProps@13`
- `onPageChange@17`
- `onClose@18`

## 依赖输入

- `react`

## 对外暴露

- `SettingsStatusTone`
- `SettingsPageDefinition`
- `SettingsSheet`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useEffect, type ReactNode } from "react";

export type SettingsStatusTone = "error" | "success" | "info";

export type SettingsPageDefinition = {
  id: string;
  label: string;
  eyebrow?: string;
  title: string;
  description: string;
  summary?: string;
};

type SettingsSheetProps = {
  pages: SettingsPageDefinition[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
  onClose: () => void;
  status?: {
    tone: SettingsStatusTone;
    message: string;
  } | null;
  footer: ReactNode;
  children: ReactNode;
};

const toneClasses: Record<SettingsStatusTone, string> = {
  error: "border-error/20 bg-error-light text-error",
  success: "border-success/20 bg-success-light text-success",
  info: "border-accent/20 bg-accent/8 text-ink-800",
};

const PAGE_ICONS: Record<string, ReactNode> = {
  profiles: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
  channels: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  plugins: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 3h8v5H8z" />
      <path d="M10 8v3" />
      <path d="M14 8v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M9 15h6" />
      <path d="M9 18h3" />
    </svg>
  ),
  skills: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  "global-json": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </svg>
  ),
  "agent-rules": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  ),
  "system-maintenance": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
  mcp: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
};

export function SettingsSheet({
  pages,
  activePageId,
  onPageChange,
  onClose,
  status,
  footer,
  children,
}: SettingsSheetProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[40000] flex overflow-hidden bg-[#F5F6F8] text-[#1D2129]">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#E5E6EB] bg-[#EEF0F3] px-5 py-7">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#111318] shadow-[0_14px_30px_rgba(17,19,24,0.16)] overflow-hidde
... (truncated)
```
