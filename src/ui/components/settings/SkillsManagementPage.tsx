import type {
  InstalledSkillRecord,
  SkillInventory,
  SkillSyncRequest,
} from "../../types";

type SkillsManagementPageProps = {
  inventory: SkillInventory;
  onInventoryChange: (next: (current: SkillInventory) => SkillInventory) => void;
  syncingSkillIds: Set<string>;
  syncNotes: Record<string, string>;
  onRefresh: () => void;
  onSync: (request: SkillSyncRequest) => Promise<void>;
};

function formatTime(timestamp: number | undefined): string {
  if (!timestamp) {
    return "未记录";
  }
  return new Date(timestamp).toLocaleString();
}

function safeValue(value: string | undefined): string {
  return value?.trim() || "";
}

function kindLabel(kind: InstalledSkillRecord["kind"]): string {
  return kind === "bundle" ? "技能包" : "单技能";
}

function sourceLabel(sourceType: InstalledSkillRecord["sourceType"]): string {
  return sourceType === "git" ? "Git 跟踪" : "手动安装";
}

export function SkillsManagementPage({
  inventory,
  onInventoryChange,
  syncingSkillIds,
  syncNotes,
  onRefresh,
  onSync,
}: SkillsManagementPageProps) {
  const trackedSkills = inventory.skills.filter((skill) => skill.sourceType === "git");
  const syncBusy = (skillId: string) => syncingSkillIds.has(skillId);
  const hasSyncBusy = syncingSkillIds.size > 0;

  const updateSkill = (skillId: string, next: Partial<InstalledSkillRecord>) => {
    onInventoryChange((current) => ({
      ...current,
      skills: current.skills.map((skill) => (
        skill.id === skillId ? { ...skill, ...next } : skill
      )),
    }));
  };

  const syncSingleSkill = async (skillId: string) => {
    await onSync({ skillIds: [skillId], force: true });
  };

  const syncAllTracked = async () => {
    await onSync({
      skillIds: trackedSkills.map((skill) => skill.id),
      force: true,
    });
  };

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch (error) {
      console.error("Failed to copy skill path:", error);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted">默认目录</div>
          <h3 className="mt-1 text-sm font-semibold text-ink-900">已安装 Skills 清单</h3>
          <p className="mt-1 text-xs text-muted">
            这里展示默认目录里已经存在的 skill。你可以给其中任意一条补充远程地址，后续再按周期自动拉取更新。
          </p>
          <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-ink-900/10 bg-surface px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">PATH</span>
            <span className="font-mono text-xs text-ink-800">{inventory.rootPath}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-surface"
            onClick={onRefresh}
            disabled={hasSyncBusy}
          >
            重新扫描目录
          </button>
          <button
            type="button"
            className="rounded-xl border border-accent/20 bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => { void syncAllTracked(); }}
            disabled={trackedSkills.length === 0 || hasSyncBusy}
          >
            同步全部 Git 技能
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-surface px-3 py-1 text-ink-700">
          已安装 {inventory.skills.length}
        </span>
        <span className="rounded-full bg-surface px-3 py-1 text-ink-700">
          Git 跟踪 {trackedSkills.length}
        </span>
        <span className="rounded-full bg-surface px-3 py-1 text-ink-700">
          技能包 {inventory.skills.filter((skill) => skill.kind === "bundle").length}
        </span>
      </div>

      <div className="mt-4 h-[520px] overflow-auto rounded-2xl border border-ink-900/10">
        <table className="w-full min-w-[1360px] table-fixed text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="text-[11px] text-muted">
              <th className="w-[12%] px-2.5 py-2.5 font-medium">名称</th>
              <th className="w-[7%] px-2.5 py-2.5 font-medium">类型</th>
              <th className="w-[10%] px-2.5 py-2.5 font-medium">安装时间</th>
              <th className="w-[9%] px-2.5 py-2.5 font-medium">来源</th>
              <th className="w-[26%] px-2.5 py-2.5 font-medium">远程地址</th>
              <th className="w-[8%] px-2.5 py-2.5 font-medium">分支</th>
              <th className="w-[11%] px-2.5 py-2.5 font-medium">最近拉取</th>
              <th className="w-[19%] px-2.5 py-2.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {inventory.skills.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-5 text-center text-[12px] text-muted">
                  还没有在默认目录下发现可识别的 skill。
                </td>
              </tr>
            ) : (
              inventory.skills.map((skill) => (
                <tr key={skill.id} className="border-t border-ink-900/8 align-top">
                  <td className="px-2.5 py-2.5">
                    <div className="font-medium text-ink-900">{skill.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted">{sourceLabel(skill.sourceType)}</div>
                  </td>
                  <td className="px-2.5 py-2.5 text-[12px] text-ink-700">{kindLabel(skill.kind)}</td>
                  <td className="px-2.5 py-2.5 text-[12px] text-ink-700">{formatTime(skill.installedAt)}</td>
                  <td className="px-2.5 py-2.5">
                    <select
                      className="w-full rounded-lg border border-ink-900/10 bg-white px-2.5 py-1.5 text-[12px] text-ink-800"
                      value={skill.sourceType}
                      onChange={(event) => updateSkill(skill.id, {
                        sourceType: event.target.value === "git" ? "git" : "manual",
                        syncEnabled: event.target.value === "git" ? (skill.syncEnabled ?? true) : false,
                      })}
                    >
                      <option value="manual">手动安装</option>
                      <option value="git">Git 跟踪</option>
                    </select>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-ink-900/10 bg-white px-2.5 py-1.5 font-mono text-[12px] text-ink-800 disabled:cursor-not-allowed disabled:bg-surface"
                      value={safeValue(skill.remoteUrl)}
                      placeholder="https://github.com/..."
                      onChange={(event) => updateSkill(skill.id, { remoteUrl: event.target.value })}
                      disabled={skill.sourceType !== "git"}
                    />
                  </td>
                  <td className="px-2.5 py-2.5">
                    <input
                      type="text"
                      className="w-full rounded-lg border border-ink-900/10 bg-white px-2.5 py-1.5 text-[12px] text-ink-800 disabled:cursor-not-allowed disabled:bg-surface"
                      value={skill.sourceType === "git" ? (safeValue(skill.branch) || "main") : ""}
                      placeholder="main"
                      onChange={(event) => updateSkill(skill.id, { branch: event.target.value })}
                      disabled={skill.sourceType !== "git"}
                    />
                  </td>
                  <td className="px-2.5 py-2.5 text-[12px] text-ink-700">
                    <div>{formatTime(skill.lastPulledAt)}</div>
                    <div className="mt-1 text-[10px] leading-4 text-muted">
                      {syncNotes[skill.id] || skill.lastError || ""}
                    </div>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-ink-900/10 bg-white px-2 py-1 text-[11px] font-medium text-ink-700 transition-colors hover:bg-surface"
                        onClick={() => { void copyPath(skill.path); }}
                      >
                        复制路径
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-accent/20 bg-accent px-2 py-1 text-[11px] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => { void syncSingleSkill(skill.id); }}
                        disabled={skill.sourceType !== "git" || syncBusy(skill.id)}
                      >
                        {syncBusy(skill.id) ? "同步中" : "立即同步"}
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
  );
}
