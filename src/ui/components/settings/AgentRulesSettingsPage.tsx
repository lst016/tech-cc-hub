import type { AgentRuleDocuments } from "../../types";
import { CodeEditor } from "./CodeEditor";

type AgentRulesSettingsPageProps = {
  documents: AgentRuleDocuments | null;
  userMarkdown: string;
  onUserMarkdownChange: (value: string) => void;
};

export function AgentRulesSettingsPage({
  documents,
  userMarkdown,
  onUserMarkdownChange,
}: AgentRulesSettingsPageProps) {
  const systemMarkdown = documents?.systemDefaultMarkdown ?? "";
  const userAgentsPath = documents?.userAgentsPath ?? "~/.claude/AGENTS.md";
  const userClaudeRoot = documents?.userClaudeRoot ?? "~/.claude";

  return (
    <section className="grid gap-4">
      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
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
          minHeight="240px"
          readOnly
        />
      </div>

      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-muted">Claude 全局目录 Markdown</div>
            <h3 className="mt-1 text-base font-semibold text-ink-900">用户级 AGENTS.md</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              保存后会写入 Claude 全局目录，普通开发会话会按现有三层规则解析加载这份用户级入口文档。
            </p>
          </div>
          <div className="rounded-2xl border border-ink-900/8 bg-surface px-3 py-2 text-right">
            <div className="text-[10px] font-semibold tracking-[0.16em] text-muted">PATH</div>
            <div className="mt-1 max-w-[520px] truncate font-mono text-[11px] text-ink-700" title={userAgentsPath}>
              {userAgentsPath}
            </div>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-ink-900">编辑全局规则</span>
          <CodeEditor
            id="user-claude-agent-rules"
            value={userMarkdown}
            onChange={onUserMarkdownChange}
            placeholder="# 用户级 Agent 规则\n\n写在这里的内容会保存到 ~/.claude/AGENTS.md"
            minHeight="260px"
          />
        </label>

        <div className="mt-3 rounded-2xl border border-ink-900/8 bg-surface px-4 py-3 text-xs leading-5 text-muted">
          当前全局目录：<span className="font-mono text-ink-700">{userClaudeRoot}</span>
        </div>
      </div>
    </section>
  );
}
