import { CodeEditor } from "./CodeEditor";

type GlobalJsonSettingsPageProps = {
  configText: string;
  parseError: string | null;
  onChange: (next: string) => void;
  onFormat: () => void;
  closeSidebarOnBrowserOpen: boolean;
  onCloseSidebarOnBrowserOpenChange: (next: boolean) => void;
};

export function GlobalJsonSettingsPage({
  configText,
  parseError,
  onChange,
  onFormat,
  closeSidebarOnBrowserOpen,
  onCloseSidebarOnBrowserOpenChange,
}: GlobalJsonSettingsPageProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex min-h-0 flex-col rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink-900">全局运行参数</div>
            <p className="mt-1 text-sm leading-6 text-muted">
              这里放通用参数（例如 skills、hooks、外部工具清单）。  
              `env` 中字段会注入到执行环境，技能/工具可直接读取；不想手配也可走系统首次启动自动识别常见凭证并写入全局配置，后续复用时无需重复填写。
            </p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs text-ink-700 transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onFormat}
            disabled={!configText.trim()}
          >
            格式化 JSON
          </button>
          </div>
        </div>

        <div className="mt-4 shrink-0 rounded-2xl border border-ink-900/10 bg-surface px-4 py-3">
          <label htmlFor="close-sidebar-on-browser-open" className="flex items-start gap-3 text-sm">
            <input
              id="close-sidebar-on-browser-open"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-ink-900/40 text-accent focus:ring-accent"
              checked={closeSidebarOnBrowserOpen}
              onChange={(event) => onCloseSidebarOnBrowserOpenChange(event.target.checked)}
            />
            <span className="leading-6 text-muted">
              打开浏览器工作台时自动收起左侧栏（默认开启）
            </span>
          </label>
        </div>

        <label htmlFor="global-json" className="mt-4 block text-xs font-medium text-muted">
          全局 JSON 配置
        </label>
        <p className="mt-1 text-xs text-muted">
          行号、Tab 缩进都开启了，粘贴 JSON 后可直接点击“格式化 JSON”。建议保留 `env`，并在其中放入技能需要的 token；如果不想手动配置，首次启动会自动扫描并持久化常见凭证到 `agent-runtime.json`。
        </p>
        <CodeEditor
          id="global-json"
          value={configText}
          onChange={onChange}
          minHeight="260px"
          className="mt-4 h-[36vh] max-h-[360px] flex-none"
          placeholder='{\n  "env": {\n    "GITHUB_TOKEN": "ghp_xxx",\n    "GROQ_API_KEY": "gsk_xxx"\n  },\n  "skillCredentials": {\n    "github": [\n      "GITHUB_TOKEN"\n    ],\n    "browser": {\n      "env": ["GROQ_API_KEY"]\n    }\n  }\n}'
        />

        <div className={`mt-3 shrink-0 rounded-xl px-3 py-2 text-xs ${parseError ? "border border-error/20 bg-error-light text-error" : "border border-ink-900/10 bg-surface text-muted"}`}>
          {parseError ? parseError : "建议保持 JSON 为对象结构，后续可直接用于执行时读取通用参数。"}
        </div>
      </div>
    </div>
  );
}
