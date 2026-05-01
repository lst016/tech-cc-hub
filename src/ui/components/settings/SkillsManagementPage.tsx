import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  InstalledSkillRecord,
  SkillInventory,
  SkillSyncRequest,
} from "../../types";
import { copyTextToClipboard } from "../../utils/clipboard";

type SkillHubSkillInfo = {
  name: string;
  description: string;
  location: string;
  isCustom: boolean;
  source: "builtin" | "custom" | "extension";
};

type SkillHubExternalSource = {
  name: string;
  path: string;
  source: string;
  skills: Array<{ name: string; description: string; path: string }>;
};

type SkillHubResponse<T = unknown> = {
  success: boolean;
  data?: T;
  msg?: string;
  error?: string;
};

type SkillsManagementPageProps = {
  inventory: SkillInventory;
  onInventoryChange: (next: (current: SkillInventory) => SkillInventory) => void;
  syncingSkillIds: Set<string>;
  syncNotes: Record<string, string>;
  onRefresh: () => void;
  onSync: (request: SkillSyncRequest) => Promise<void>;
};

const AVATAR_CLASSES = [
  "bg-[#165DFF] text-white",
  "bg-[#00B42A] text-white",
  "bg-[#722ED1] text-white",
  "bg-[#F5319D] text-white",
  "bg-[#F77234] text-white",
  "bg-[#14C9C9] text-white",
];

function avatarClass(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return AVATAR_CLASSES[Math.abs(hash) % AVATAR_CLASSES.length];
}

function formatTime(timestamp: number | undefined): string {
  if (!timestamp) return "未记录";
  return new Date(timestamp).toLocaleString();
}

function skillDirFromLocation(location: string) {
  return location.replace(/[\\/]SKILL\.md$/, "");
}

function getSkillRecord(skill: SkillHubSkillInfo, inventory: SkillInventory): InstalledSkillRecord | undefined {
  const dir = skillDirFromLocation(skill.location);
  return inventory.skills.find((item) => item.name === skill.name || item.path === dir || skill.location.startsWith(item.path));
}

function buildInventorySkillInfos(inventory: SkillInventory): SkillHubSkillInfo[] {
  return inventory.skills.map((skill) => ({
    name: skill.name,
    description: skill.lastError || (skill.sourceType === "git" ? "Git 跟踪技能" : "自定义技能"),
    location: `${skill.path}/SKILL.md`,
    isCustom: true,
    source: "custom",
  }));
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "blue" | "orange" | "green" }) {
  const className = tone === "blue"
    ? "border-[#165DFF]/20 bg-[#165DFF]/8 text-[#165DFF]"
    : tone === "orange"
      ? "border-[#F77234]/22 bg-[#F77234]/10 text-[#D85B1F]"
      : tone === "green"
        ? "border-[#00B42A]/20 bg-[#00B42A]/10 text-[#15803D]"
        : "border-black/8 bg-black/4 text-muted";
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}

function IconButton({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-[#165DFF]/28 hover:bg-[#165DFF]/6 hover:text-[#165DFF] disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function SkillsManagementPage({
  inventory,
  onInventoryChange,
  syncingSkillIds,
  syncNotes,
  onRefresh,
  onSync,
}: SkillsManagementPageProps) {
  const [availableSkills, setAvailableSkills] = useState<SkillHubSkillInfo[]>([]);
  const [externalSources, setExternalSources] = useState<SkillHubExternalSource[]>([]);
  const [builtinAutoSkills, setBuiltinAutoSkills] = useState<Array<{ name: string; description: string }>>([]);
  const [skillPaths, setSkillPaths] = useState<{ userSkillsDir: string; builtinSkillsDir: string } | null>(null);
  const [activeSourceTab, setActiveSourceTab] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExternalQuery, setSearchExternalQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const trackedSkills = inventory.skills.filter((skill) => skill.sourceType === "git");
  const displaySkills = useMemo(
    () => availableSkills.length > 0 ? availableSkills : buildInventorySkillInfos(inventory),
    [availableSkills, inventory],
  );
  const mySkills = displaySkills.filter((skill) => skill.source !== "extension");
  const extensionSkills = displaySkills.filter((skill) => skill.source === "extension");
  const totalExternal = externalSources.reduce((sum, source) => sum + source.skills.length, 0);
  const activeSource = externalSources.find((source) => source.source === activeSourceTab);

  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return mySkills;
    return mySkills.filter((skill) => skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query));
  }, [mySkills, searchQuery]);

  const filteredExternalSkills = useMemo(() => {
    const skills = activeSource?.skills ?? [];
    const query = searchExternalQuery.trim().toLowerCase();
    if (!query) return skills;
    return skills.filter((skill) => skill.name.toLowerCase().includes(query) || skill.description.toLowerCase().includes(query));
  }, [activeSource?.skills, searchExternalQuery]);

  const fetchHubData = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsResult, externalResult, pathsResult, autoSkillsResult] = await Promise.allSettled([
        window.electron.listAvailableSkills?.() ?? Promise.resolve([]),
        window.electron.detectAndCountExternalSkills?.() ?? Promise.resolve({ success: true, data: [] }),
        window.electron.getSkillPaths?.() ?? Promise.resolve({ userSkillsDir: inventory.rootPath, builtinSkillsDir: "" }),
        window.electron.listBuiltinAutoSkills?.() ?? Promise.resolve([]),
      ]);
      const skills = skillsResult.status === "fulfilled" ? skillsResult.value : [];
      const external = externalResult.status === "fulfilled" ? externalResult.value : { success: true, data: [] };
      const paths = pathsResult.status === "fulfilled" ? pathsResult.value : { userSkillsDir: inventory.rootPath, builtinSkillsDir: "" };
      const autoSkills = autoSkillsResult.status === "fulfilled" ? autoSkillsResult.value : [];
      const externalData = (external as SkillHubResponse<SkillHubExternalSource[]>).data ?? [];
      const nextSkills = Array.isArray(skills) && skills.length > 0
        ? skills as SkillHubSkillInfo[]
        : buildInventorySkillInfos(inventory);
      setAvailableSkills(nextSkills);
      setExternalSources(externalData);
      setSkillPaths(paths);
      setBuiltinAutoSkills(autoSkills);
      if (externalData.length > 0 && !externalData.some((source) => source.source === activeSourceTab)) {
        setActiveSourceTab(externalData[0].source);
      }
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "刷新 Skills Hub 失败。" });
    } finally {
      setLoading(false);
    }
  }, [activeSourceTab, inventory]);

  useEffect(() => {
    void fetchHubData();
  }, [fetchHubData]);

  const refreshAll = async () => {
    onRefresh();
    await fetchHubData();
  };

  const updateSkill = (skillId: string, next: Partial<InstalledSkillRecord>) => {
    onInventoryChange((current) => ({
      ...current,
      skills: current.skills.map((skill) => skill.id === skillId ? { ...skill, ...next } : skill),
    }));
  };

  const syncSkill = async (skillId: string) => {
    await onSync({ skillIds: [skillId], force: true });
    await refreshAll();
  };

  const syncAllTracked = async () => {
    await onSync({ skillIds: trackedSkills.map((skill) => skill.id), force: true });
    await refreshAll();
  };

  const importSkill = async (skillPath: string) => {
    const result = await window.electron.importSkillWithSymlink?.(skillPath);
    if (!result?.success) {
      setNotice({ tone: "error", text: result?.msg || result?.error || "导入技能失败。" });
      return;
    }
    setNotice({ tone: "success", text: result.msg || "技能已导入。" });
    await refreshAll();
  };

  const importAll = async (skills: Array<{ path: string }>) => {
    let count = 0;
    for (const skill of skills) {
      const result = await window.electron.importSkillWithSymlink?.(skill.path);
      if (result?.success) count += 1;
    }
    setNotice({ tone: count > 0 ? "success" : "error", text: count > 0 ? `已导入 ${count} 个技能。` : "没有成功导入的技能。" });
    await refreshAll();
  };

  const deleteSkill = async (skillName: string) => {
    const result = await window.electron.deleteSkill?.(skillName);
    if (!result?.success) {
      setNotice({ tone: "error", text: result?.msg || result?.error || "删除技能失败。" });
      return;
    }
    setNotice({ tone: "success", text: result.msg || "技能已删除。" });
    await refreshAll();
  };

  const manualImport = async () => {
    const selected = await window.electron.openPreviewDirectoryDialog({ properties: ["openDirectory", "createDirectory"] });
    if (selected[0]) {
      await importSkill(selected[0]);
    }
  };

  return (
    <section className="h-full min-h-0 overflow-auto rounded-[30px] border border-[#E5E6EB] bg-[#F7F8FA] p-5 text-[#1D2129] shadow-[0_18px_44px_rgba(29,33,41,0.06)]">
      <div className="flex min-h-full flex-col gap-4">
        <div className="rounded-[28px] border border-[#E5E6EB] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#86909C]">技能中心</div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-[#1D2129]">技能中心</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4E5969]">
                对齐 AionUi 的独立技能页面：发现外部技能、导入到本地、管理内置自动技能，同时保留 tech-cc-hub 的 Git 跟踪同步能力。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <IconButton onClick={() => { void refreshAll(); }}>{loading ? "刷新中" : "刷新"}</IconButton>
              <IconButton onClick={() => { void manualImport(); }}>从文件夹导入</IconButton>
              <button
                type="button"
                className="rounded-full bg-[#165DFF] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(22,93,255,0.22)] transition hover:bg-[#0E42D2] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => { void syncAllTracked(); }}
                disabled={trackedSkills.length === 0 || syncingSkillIds.size > 0}
              >
                同步全部 Git 技能
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-[#F2F3F5] px-4 py-3"><div className="text-xs text-[#86909C]">我的技能</div><div className="mt-1 text-xl font-bold">{mySkills.length}</div></div>
            <div className="rounded-2xl bg-[#F2F3F5] px-4 py-3"><div className="text-xs text-[#86909C]">外部发现</div><div className="mt-1 text-xl font-bold">{totalExternal}</div></div>
            <div className="rounded-2xl bg-[#F2F3F5] px-4 py-3"><div className="text-xs text-[#86909C]">自动内置</div><div className="mt-1 text-xl font-bold">{builtinAutoSkills.length}</div></div>
            <div className="rounded-2xl bg-[#F2F3F5] px-4 py-3"><div className="text-xs text-[#86909C]">Git 跟踪</div><div className="mt-1 text-xl font-bold">{trackedSkills.length}</div></div>
          </div>
          {notice && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${notice.tone === "success" ? "border-[#00B42A]/20 bg-[#E8FFEA] text-[#15803D]" : "border-[#F53F3F]/20 bg-[#FFECE8] text-[#CB272D]"}`}>
              {notice.text}
            </div>
          )}
        </div>

        {totalExternal > 0 && (
          <div className="rounded-[28px] border border-[#E5E6EB] bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold">外部发现技能</h4>
                  <StatusPill tone="blue">{totalExternal}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-[#4E5969]">检测到 Claude / Codex / AionUi 等目录里的技能，可以用软链接导入到本地技能中心。</p>
              </div>
              <input
                className="h-9 w-full rounded-xl border border-[#E5E6EB] bg-[#F7F8FA] px-3 text-sm outline-none transition focus:border-[#165DFF] lg:w-64"
                placeholder="搜索技能..."
                value={searchExternalQuery}
                onChange={(event) => setSearchExternalQuery(event.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {externalSources.map((source) => {
                const active = source.source === activeSourceTab;
                return (
                  <button
                    key={source.source}
                    type="button"
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${active ? "border-[#165DFF] bg-[#165DFF] text-white shadow-md" : "border-[#E5E6EB] bg-white text-[#4E5969] hover:bg-[#F2F3F5]"}`}
                    onClick={() => setActiveSourceTab(source.source)}
                  >
                    {source.name} <span className={active ? "text-white/80" : "text-[#86909C]"}>{source.skills.length}</span>
                  </button>
                );
              })}
            </div>
            {activeSource && (
              <div className="mt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#86909C]">
                  <span className="font-mono">{activeSource.path}</span>
                  <button type="button" className="font-semibold text-[#165DFF]" onClick={() => { void importAll(activeSource.skills); }}>全部导入</button>
                </div>
                <div className="grid max-h-[360px] gap-2 overflow-auto pr-1">
                  {filteredExternalSkills.map((skill) => (
                    <button
                      key={`${activeSource.source}-${skill.path}`}
                      type="button"
                      className="group flex items-center gap-4 rounded-2xl border border-transparent bg-white p-4 text-left transition hover:border-[#E5E6EB] hover:bg-[#F7F8FA] hover:shadow-sm"
                      onClick={() => { void importSkill(skill.path); }}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E5E6EB] bg-white text-base font-bold text-[#1D2129]">{skill.name.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[#1D2129]">{skill.name}</span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#4E5969]">{skill.description || skill.path}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-[#165DFF] px-3 py-1.5 text-xs font-semibold text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">导入</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-[28px] border border-[#E5E6EB] bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2"><h4 className="text-lg font-bold">我的技能</h4><StatusPill tone="blue">{mySkills.length}</StatusPill></div>
              <p className="mt-1 text-sm text-[#4E5969]">{skillPaths?.userSkillsDir || inventory.rootPath}</p>
            </div>
            <input
              className="h-9 w-full rounded-xl border border-[#E5E6EB] bg-[#F7F8FA] px-3 text-sm outline-none transition focus:border-[#165DFF] lg:w-64"
              placeholder="搜索技能..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <div className="mt-4 grid gap-2">
            {filteredSkills.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#E5E6EB] bg-[#F7F8FA] px-4 py-10 text-center text-sm text-[#86909C]">还没有找到技能，试试从外部发现或文件夹导入。</div>
            ) : filteredSkills.map((skill) => {
              const record = getSkillRecord(skill, inventory);
              const isGit = record?.sourceType === "git";
              return (
                <div key={`${skill.source}-${skill.name}-${skill.location}`} className="group rounded-2xl border border-transparent bg-white p-4 transition hover:border-[#E5E6EB] hover:bg-[#F7F8FA] hover:shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-base font-bold ${avatarClass(skill.name)}`}>{skill.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="truncate text-sm font-bold text-[#1D2129]">{skill.name}</h5>
                        <StatusPill tone={skill.source === "custom" ? "orange" : "blue"}>{skill.source === "custom" ? "自定义" : "内置"}</StatusPill>
                        {isGit && <StatusPill tone="green">Git</StatusPill>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#4E5969]">{skill.description || skill.location}</p>
                      <div className="mt-2 truncate font-mono text-xs text-[#86909C]">{skill.location}</div>
                      {record && (
                        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_120px_160px]">
                          <input
                            className="h-9 rounded-xl border border-[#E5E6EB] bg-white px-3 font-mono text-xs outline-none transition focus:border-[#165DFF] disabled:bg-[#F2F3F5]"
                            placeholder="Git 远程地址"
                            value={record.remoteUrl ?? ""}
                            disabled={record.sourceType !== "git"}
                            onChange={(event) => updateSkill(record.id, { remoteUrl: event.target.value })}
                          />
                          <input
                            className="h-9 rounded-xl border border-[#E5E6EB] bg-white px-3 text-xs outline-none transition focus:border-[#165DFF] disabled:bg-[#F2F3F5]"
                            placeholder="main"
                            value={record.sourceType === "git" ? (record.branch ?? "main") : ""}
                            disabled={record.sourceType !== "git"}
                            onChange={(event) => updateSkill(record.id, { branch: event.target.value })}
                          />
                          <select
                            className="h-9 rounded-xl border border-[#E5E6EB] bg-white px-3 text-xs outline-none transition focus:border-[#165DFF]"
                            value={record.sourceType}
                            onChange={(event) => updateSkill(record.id, { sourceType: event.target.value === "git" ? "git" : "manual", syncEnabled: event.target.value === "git" })}
                          >
                            <option value="manual">手动安装</option>
                            <option value="git">Git 跟踪</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                      <IconButton onClick={() => { void copyTextToClipboard(skill.location); }}>复制路径</IconButton>
                      {record && <IconButton onClick={() => { void syncSkill(record.id); }} disabled={record.sourceType !== "git" || syncingSkillIds.has(record.id)}>{syncingSkillIds.has(record.id) ? "同步中" : "同步"}</IconButton>}
                      {skill.source === "custom" && <IconButton onClick={() => { void deleteSkill(skill.name); }}>删除</IconButton>}
                    </div>
                  </div>
                  {record && (syncNotes[record.id] || record.lastError || record.lastPulledAt) && (
                    <div className="mt-3 rounded-xl bg-[#F2F3F5] px-3 py-2 text-xs text-[#4E5969]">
                      最近拉取：{formatTime(record.lastPulledAt)} {syncNotes[record.id] || record.lastError || ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(builtinAutoSkills.length > 0 || extensionSkills.length > 0) && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[28px] border border-[#E5E6EB] bg-white px-6 py-5 shadow-sm">
              <div className="flex items-center gap-2"><h4 className="text-lg font-bold">内置自动技能</h4><StatusPill tone="green">{builtinAutoSkills.length}</StatusPill></div>
              <div className="mt-4 grid gap-2">
                {builtinAutoSkills.map((skill) => (
                  <div key={skill.name} className="rounded-2xl bg-[#F7F8FA] px-4 py-3">
                    <div className="text-sm font-bold">{skill.name}</div>
                    <div className="mt-1 text-xs leading-5 text-[#4E5969]">{skill.description || "自动注入运行时索引。"}</div>
                  </div>
                ))}
              </div>
            </div>
            {extensionSkills.length > 0 && (
              <div className="rounded-[28px] border border-[#E5E6EB] bg-white px-6 py-5 shadow-sm">
                <div className="flex items-center gap-2"><h4 className="text-lg font-bold">扩展技能</h4><StatusPill tone="blue">{extensionSkills.length}</StatusPill></div>
                <div className="mt-4 grid gap-2">
                  {extensionSkills.map((skill) => <div key={skill.name} className="rounded-2xl bg-[#F7F8FA] px-4 py-3 text-sm font-semibold">{skill.name}</div>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
