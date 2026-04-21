import type {
  SkillRegistry,
  SkillSourceRecord,
  SkillSyncRequest,
} from "../../types";

type SkillsManagementPageProps = {
  registry: SkillRegistry;
  onRegistryChange: (next: (current: SkillRegistry) => SkillRegistry) => void;
  onAddSource: (kind: "local" | "remote") => void;
  onDeleteSource: (sourceId: string) => void;
  syncingSourceIds: Set<string>;
  syncNotes: Record<string, string>;
  onSync: (request: SkillSyncRequest) => Promise<void>;
};

const DEFAULT_SKILL_PATH = "~/.claude/skills";

function formatTime(timestamp: number | undefined): string {
  if (!timestamp) return "未同步";
  return new Date(timestamp).toLocaleString();
}

function safeValue(value: string | undefined): string {
  return value?.trim() || "";
}

export function SkillsManagementPage({
  registry,
  onRegistryChange,
  onAddSource,
  onDeleteSource,
  syncingSourceIds,
  syncNotes,
  onSync,
}: SkillsManagementPageProps) {
  const localSources = registry.sources.filter((source) => source.kind === "local");
  const remoteSources = registry.sources.filter((source) => source.kind === "remote");

  const updateSource = (sourceId: string, next: Partial<SkillSourceRecord>) => {
    onRegistryChange((current) => ({
      sources: current.sources.map((item) => (
        item.id === sourceId ? { ...item, ...next } : item
      )),
    }));
  };

  const syncRemoteSource = async (sourceId: string) => {
    await onSync({ sourceIds: [sourceId], force: true });
  };

  const syncAllRemote = async () => {
    await onSync({ sourceIds: remoteSources.map((source) => source.id), force: true });
  };

  const syncBusy = (sourceId: string) => syncingSourceIds.has(sourceId);
  const hasSyncBusy = syncingSourceIds.size > 0;

  return (
    <div className="grid gap-4">
      <section className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted">本地技能源</div>
            <h3 className="mt-1 text-sm font-semibold text-ink-900">本地技能源（不走网络拉取）</h3>
            <p className="mt-1 text-xs text-muted">支持配置目录化能力包；按你当前机器上的路径直接加载。</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-surface"
            onClick={() => onAddSource("local")}
          >
            + 新增本地技能源
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink-900/10">
          <table className="w-full min-w-[760px] table-fixed text-left text-sm">
            <thead className="bg-surface">
              <tr className="text-xs text-muted">
                <th className="w-1/4 px-3 py-3 font-medium">名称</th>
                <th className="w-3/5 px-3 py-3 font-medium">路径</th>
                <th className="w-1/12 px-3 py-3 text-center font-medium">启用</th>
                <th className="w-1/12 px-3 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {localSources.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-xs text-muted">
                    还没有本地技能源，先点右上角“新增”创建。
                  </td>
                </tr>
              ) : (
                localSources.map((source) => (
                  <tr key={source.id} className="border-t border-ink-900/8">
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800"
                        value={source.name}
                        onChange={(event) => updateSource(source.id, { name: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-3">
                          <input
                            type="text"
                            className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 font-mono text-sm text-ink-800"
                            placeholder={`${DEFAULT_SKILL_PATH}/local`}
                            value={source.path}
                            onChange={(event) => updateSource(source.id, { path: event.target.value })}
                          />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={(event) => updateSource(source.id, { enabled: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="rounded-lg border border-error/40 px-2 py-1 text-xs text-error transition-colors hover:bg-error-light"
                        onClick={() => onDeleteSource(source.id)}
                        disabled={hasSyncBusy}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted">远端技能源</div>
            <h3 className="mt-1 text-sm font-semibold text-ink-900">远端技能源（按 Git 地址同步）</h3>
            <p className="mt-1 text-xs text-muted">支持设置检查周期，定时任务会自动执行增量更新；可随时点单条或全部同步。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-surface"
              onClick={() => onAddSource("remote")}
            >
              + 新增远端技能源
            </button>
            <button
              type="button"
              className="rounded-xl border border-accent/20 bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              onClick={syncAllRemote}
              disabled={remoteSources.length === 0 || hasSyncBusy}
            >
              立即同步全部
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink-900/10">
          <table className="w-full min-w-[980px] table-fixed text-left text-sm">
            <thead className="bg-surface">
              <tr className="text-xs text-muted">
                <th className="w-[17%] px-3 py-3 font-medium">名称</th>
                <th className="w-[26%] px-3 py-3 font-medium">Git 地址</th>
                <th className="w-[8%] px-3 py-3 font-medium">类型</th>
                <th className="w-[7%] px-3 py-3 font-medium">分支</th>
                <th className="w-[8%] px-3 py-3 font-medium">频率（h）</th>
                <th className="w-[17%] px-3 py-3 font-medium">路径</th>
                <th className="w-[10%] px-3 py-3 font-medium">上次拉取</th>
                <th className="w-[10%] px-3 py-3 font-medium">上次检查</th>
                <th className="w-[8%] px-3 py-3 text-center font-medium">启用</th>
                <th className="w-[10%] px-3 py-3 font-medium">同步</th>
              </tr>
            </thead>
            <tbody>
              {remoteSources.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-xs text-muted">
                    还没有远端技能源，先新增一个 Git 地址开始托管同步。
                  </td>
                </tr>
              ) : (
                remoteSources.map((source) => (
                  <tr key={source.id} className="border-t border-ink-900/8">
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800"
                        value={source.name}
                        onChange={(event) => updateSource(source.id, { name: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 font-mono text-sm text-ink-800"
                        value={safeValue(source.gitUrl)}
                        onChange={(event) => updateSource(source.id, { gitUrl: event.target.value })}
                        placeholder="https://github.com/..."
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800"
                        value={source.scope ?? "single"}
                        onChange={(event) => updateSource(source.id, { scope: event.target.value === "bundle" ? "bundle" : "single" })}
                      >
                        <option value="single">single</option>
                        <option value="bundle">bundle</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800"
                        value={safeValue(source.branch) || "main"}
                        onChange={(event) => updateSource(source.id, { branch: event.target.value })}
                        placeholder="main"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800"
                        value={source.checkEveryHours ?? 1}
                        onChange={(event) => updateSource(source.id, { checkEveryHours: Number(event.target.value || 1) })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-ink-900/10 bg-white px-3 py-2 font-mono text-sm text-ink-800"
                        value={source.path}
                        placeholder={`${DEFAULT_SKILL_PATH}/remote-name`}
                        onChange={(event) => updateSource(source.id, { path: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-700">{formatTime(source.lastPulledAt)}</td>
                    <td className="px-3 py-3">
                      <div className="text-xs text-ink-700">{formatTime(source.lastCheckedAt)}</div>
                      <div className="mt-1 text-[11px] leading-4 text-muted">{syncNotes[source.id] ? "结果：" + syncNotes[source.id] : ""}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={(event) => updateSource(source.id, { enabled: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-accent/20 bg-accent px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                          onClick={() => void syncRemoteSource(source.id)}
                          disabled={syncBusy(source.id) || !source.enabled}
                        >
                          {syncBusy(source.id) ? "同步中" : "同步"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-error/40 px-2 py-1 text-xs text-error transition-colors hover:bg-error-light"
                          onClick={() => onDeleteSource(source.id)}
                          disabled={hasSyncBusy}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
