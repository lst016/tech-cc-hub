# src/ui/components/settings/AgentRulesSettingsPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：115

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `AgentRulesSettingsPage@12`
- `systemMarkdown@21`
- `userAgentsPath@22`
- `userClaudeRoot@23`
- `handleTabChange@24`
- `AgentRulesSettingsPageProps@4`
- `onUserMarkdownChange@8`

## 依赖输入

- `react`
- `../../types`
- `./CodeEditor`

## 对外暴露

- `AgentRulesSettingsPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import { useState } from "react";
import type { AgentRuleDocuments } from "../../types";
import { CodeEditor } from "./CodeEditor";

type AgentRulesSettingsPageProps = {
  documents: AgentRuleDocuments | null;
  userMarkdown: string;
  onUserMarkdownChange: (value: string) => void;
  onRefreshDocuments?: () => Promise<void>;
  refreshing?: boolean;
};

export function AgentRulesSettingsPage({
  documents,
  userMarkdown,
  onUserMarkdownChange,
  onRefreshDocuments,
  refreshing = false,
}: AgentRulesSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"system" | "user">("system");
  const systemMarkdown = documents?.systemDefaultMarkdown ?? "";
  const userAgentsPath = documents?.userAgentsPath ?? "~/.claude/CLAUDE.md";
  const userClaudeRoot = documents?.userClaudeRoot ?? "~/.claude";

  const handleTabChange = (tab: "system" | "user") => {
    if (tab !== activeTab) {
      void onRefreshDocuments?.();
    }
    setActiveTab(tab);
  };

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="flex shrink-0 rounded-[24px] border border-ink-900/8 bg-white/82 p-1.5 shadow-[0_14px_30px_rgba(24,32,46,0.05)]">
        <button
          type="button"
          onClick={() => handleTabChange("system")}
          className={`flex-1 rounded-[18px] px-4 py-3 text-left transition ${activeTab === "system" ? "bg-accent text-white shadow-[0_12px_24px_rgba(217,106,58,0.18)]" : "text-ink-600 hover:bg-accent/8"}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">系统</div>
          <div className="mt-1 text-sm font-semibold">{refreshing && activeTab === "system" ? "重新拉取中..." : "系统默认规则"}</div>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("user")}
          className={`flex-1 rounded-[18px] px-4 py-3 text-left transition ${activeTab === "user" ? "bg-accent text-white shadow-[0_12px_24px_rgba(217,106,58,0.18)]" : "text-ink-600 hover:bg-accent/8"}`}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">Claude</div>
          <div className="mt-1 text-sm font-semibold">{refreshing && activeTab === "user" ? "重新拉取中..." : "用户全局规则"}</div>
        </button>
      </div>

      {activeTab === "system" ? (
        <div className="flex min-h-0 flex-col rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted">系统默认 Markdown</div>
            <h3 className="mt-1 text-base font-semibold text-ink-900">tech-cc-hub 内置规则</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              这里展示应用内置的系统级默认规则，只读展示，不会覆盖用户目录。
            </p>
          </div>
          <span className="rounded-full border border-ink-900/8 bg-surface px-3 py-1 text-[11px] font-medium text-muted">
            只读
          </span>
          </div>

          <CodeEditor
            id="system-default-agent-rules"
            value={systemMarkdown}
            onChange={() => {}}
            minHeight="300px"
            className="mt-4 h-[48vh] max-h-[560px] flex-none"
            readOnly
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-col rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted">Claude 全局目录 Markdown</div>
            <h3 className="mt-1 text-base font-semibold text-ink-900">用户级 CLAUDE.md</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              保存后会写入 Claude 全局目录，普通开发会话会按现有三层规则解析加载这份用户级入口文档。
            </p>
          </div>
          <div className="rounded-2xl border border-ink-900/8 bg-surface px-3 py-2 text-right">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-muted">PATH</div>
            <div className="mt-1 max-w-[520px] truncate font-mono text-[11px] text-in
... (truncated)
```
