import { CodeEditor } from "./CodeEditor";

const GLOBAL_JSON_PLACEHOLDER = JSON.stringify(
  {
    systemPromptExt: [
      "工具调用必须少而准；能直接回答时不要调用工具。",
      "多个互不依赖的只读工具调用要并行或批量执行。",
    ],
    env: {
      GITHUB_TOKEN: "ghp_xxx",
      GROQ_API_KEY: "gsk_xxx",
    },
    skillCredentials: {
      github: [
        "GITHUB_TOKEN",
      ],
      browser: {
        env: ["GROQ_API_KEY"],
      },
    },
  },
  null,
  2,
);

type GlobalJsonSettingsPageProps = {
  configText: string;
  parseError: string | null;
  onChange: (next: string) => void;
  onFormat: () => void;
};

export function GlobalJsonSettingsPage({
  configText,
  parseError,
  onChange,
  onFormat,
}: GlobalJsonSettingsPageProps) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex min-h-0 flex-col rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink-900">全局运行参数</div>
            <p className="mt-1 text-sm leading-6 text-muted">
              这里放通用参数（例如 systemPromptExt、skills、hooks、外部工具清单）。  
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

        <label htmlFor="global-json" className="mt-4 block text-xs font-medium text-muted">
          全局 JSON 配置
        </label>
        <p className="mt-1 text-xs text-muted">
          行号、Tab 缩进都开启了，粘贴 JSON 后可直接点击“格式化 JSON”。`systemPromptExt` 会追加到每次会话的 system prompt；建议保留 `env`，并在其中放入技能需要的 token。
        </p>
        <CodeEditor
          id="global-json"
          value={configText}
          onChange={onChange}
          minHeight="260px"
          className="mt-4 h-[36vh] max-h-[360px] flex-none"
          placeholder={GLOBAL_JSON_PLACEHOLDER}
        />

        <div className={`mt-3 shrink-0 rounded-xl px-3 py-2 text-xs ${parseError ? "border border-error/20 bg-error-light text-error" : "border border-ink-900/10 bg-surface text-muted"}`}>
          {parseError ? parseError : "建议保持 JSON 为对象结构，后续可直接用于执行时读取通用参数。"}
        </div>
      </div>
    </div>
  );
}
