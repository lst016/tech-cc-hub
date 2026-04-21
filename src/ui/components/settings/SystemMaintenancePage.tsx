const PRESET_TASKS = [
  {
    id: "health-check",
    label: "系统巡检",
    prompt: "请对当前软件执行一次系统维护巡检，重点检查运行时接线、内置 agent 解析、skills 索引和近期错误风险，并给出结论与建议。",
  },
  {
    id: "skills-governance",
    label: "治理 Skills",
    prompt: "请检查当前软件内的 skills 安装与同步状态，识别异常来源、失效远端、重复技能和需要修复的版本治理问题，并给出处理建议。",
  },
  {
    id: "agent-governance",
    label: "治理 Agent",
    prompt: "请检查系统级、用户级、项目级 agent 的解析结果与边界设置，识别覆盖顺序、入口文档和运行面隔离中的风险，并给出修复建议。",
  },
];

type SystemMaintenancePageProps = {
  prompt: string;
  launching: boolean;
  onPromptChange: (value: string) => void;
  onLaunch: () => void;
};

export function SystemMaintenancePage({
  prompt,
  launching,
  onPromptChange,
  onLaunch,
}: SystemMaintenancePageProps) {
  return (
    <section className="grid gap-4">
      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="text-xs font-medium text-muted">系统维护面</div>
        <h3 className="mt-1 text-base font-semibold text-ink-900">内置维护 Agent</h3>
        <p className="mt-2 text-sm leading-6 text-muted">
          这里启动的是软件内置维护会话，只加载系统级 agent，不会自动带入用户级或项目级规则，也不会走普通开发聊天面。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESET_TASKS.map((task) => (
            <button
              key={task.id}
              type="button"
              className="rounded-full border border-ink-900/10 bg-white px-3 py-1.5 text-xs text-ink-700 transition-colors hover:bg-surface"
              onClick={() => onPromptChange(task.prompt)}
            >
              {task.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="text-xs font-medium text-muted">维护指令</div>
        <label className="mt-3 grid gap-2">
          <span className="text-sm font-medium text-ink-900">给维护 Agent 的任务</span>
          <textarea
            className="min-h-[180px] rounded-2xl border border-ink-900/10 bg-surface px-4 py-3 text-sm leading-6 text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            placeholder="例如：请检查当前软件里的三层 agent 解析器、skills 同步入口和维护面工具边界。"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
          />
        </label>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-xs leading-5 text-muted">
            启动后会新建一个独立维护会话，并切回主界面查看执行过程。
          </div>
          <button
            type="button"
            className="rounded-xl border border-accent/20 bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onLaunch}
            disabled={launching || !prompt.trim()}
          >
            {launching ? "启动中..." : "启动维护会话"}
          </button>
        </div>
      </div>
    </section>
  );
}
