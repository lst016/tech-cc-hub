// Source: CV from skills-manager views/InstallSkills.tsx
// Adapted: Tauri API → Electron IPC, react-router → props, i18n → Chinese
// Omitted: SkillsMP AI search, source overflow measurement, event-based progress, external URL opener
// Not yet wired: git preview/confirm (needs previewGitInstall/confirmGitInstall)
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  DownloadCloud, UploadCloud, Box, Star, TrendingUp, Clock,
  FolderUp, Loader2, RefreshCw, FolderSearch, FolderInput,
  Search, ExternalLink, ChevronLeft, ChevronRight, GitBranch,
} from "lucide-react";
import { toast } from "sonner";
import type { ManagedSkill, ToolInfo, ScanResult, BatchImportResult } from "../../types";
import { cn } from "./skill-utils";

const MARKET_PAGE_SIZE = 24;
const MARKET_SEARCH_STEP = 60;
const MARKET_SEARCH_DEBOUNCE_MS = 450;

// Upstream SkillsShSkill shape (from skills.sh marketplace)
interface SkillsShSkill {
  id: string;
  skill_id: string;
  name: string;
  source: string;
  description?: string;
  installs: number;
}

interface Props {
  skills: ManagedSkill[];
  tools: ToolInfo[];
  scanResult: ScanResult | null;
  onRefresh: () => void;
  onScanResult: (result: ScanResult | null) => void;
  onNavigate: (tab: "my-skills") => void;
}

export function InstallSkillsView({ skills, tools: _tools, scanResult, onRefresh, onScanResult, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<"market" | "local" | "git">("local");

  // Market state
  const [marketTab, setMarketTab] = useState<"hot" | "trending" | "alltime">("alltime");
  const [marketQuery, setMarketQuery] = useState("");
  const [marketSourceFilter, setMarketSourceFilter] = useState("all");
  const [marketSkills, setMarketSkills] = useState<SkillsShSkill[]>([]);
  const [marketPage, setMarketPage] = useState(1);
  const [marketSearchLimit, setMarketSearchLimit] = useState(MARKET_SEARCH_STEP);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [installingMarketRefs, setInstallingMarketRefs] = useState<Set<string>>(new Set());
  const [marketReloadKey, setMarketReloadKey] = useState(0);
  const [debouncedMarketQuery, setDebouncedMarketQuery] = useState("");
  const marketListRef = useRef<HTMLDivElement | null>(null);
  const marketSkillsLengthRef = useRef(0);

  // Local state
  const [scanLoading, setScanLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [importingPaths, setImportingPaths] = useState<Set<string>>(new Set());
  const [importingAll, setImportingAll] = useState(false);

  // Git state
  const [gitUrl, setGitUrl] = useState("");
  const [gitLoading, setGitLoading] = useState(false);
  const [gitPreview, setGitPreview] = useState<{
    temp_dir: string;
    skills: Array<{ dir_name: string; name: string; description: string | null }>;
  } | null>(null);
  const [gitSelections, setGitSelections] = useState<
    { dir_name: string; name: string; description: string | null; selected: boolean }[]
  >([]);

  const electronApi = window.electron as typeof window.electron & {
    invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  };

  const invoke = useCallback(
    <T,>(channel: string, ...args: unknown[]): Promise<T> =>
      electronApi.invoke(channel, ...args) as Promise<T>,
    [electronApi],
  );

  // Installed source refs for market "already installed" check
  const installedSourceRefs = useMemo(() => {
    const set = new Set<string>();
    for (const skill of skills) {
      if (skill.source_type === "skillssh" && skill.source_ref) {
        set.add(skill.source_ref);
      }
    }
    return set;
  }, [skills]);

  // Debounce market query
  const deferredQuery = marketQuery;
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMarketQuery(deferredQuery), MARKET_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [deferredQuery]);

  useEffect(() => { marketSkillsLengthRef.current = marketSkills.length; }, [marketSkills.length]);

  // Market data fetching
  useEffect(() => {
    if (activeTab !== "market") return;

    const query = debouncedMarketQuery.trim();
    const loadingMore =
      query.length > 0 && marketSkillsLengthRef.current > 0 && marketSearchLimit > marketSkillsLengthRef.current;

    setMarketLoadingMore(loadingMore);
    setMarketLoading(true);
    if (!loadingMore) setMarketPage(1);
    setMarketError(null);

    let stale = false;
    const request = query
      ? invoke<SkillsShSkill[]>("skills:searchSkillssh", query, marketSearchLimit)
      : invoke<SkillsShSkill[]>("skills:fetchLeaderboard", marketTab);

    request
      .then((result) => {
        if (stale) return;
        setMarketSkills(result ?? []);
        if (!loadingMore) setMarketSourceFilter("all");
      })
      .catch((e) => {
        if (stale) return;
        const message = String(e);
        setMarketError(message);
        toast.error(message);
      })
      .finally(() => {
        if (stale) return;
        setMarketLoading(false);
        setMarketLoadingMore(false);
      });

    return () => { stale = true; };
  }, [activeTab, debouncedMarketQuery, marketReloadKey, marketSearchLimit, marketTab, invoke]);

  // Auto-scan on local tab
  const runScan = useCallback(async () => {
    setScanLoading(true);
    setLocalError(null);
    try {
      const result = await invoke<ScanResult>("skills:scanLocalSkills");
      onScanResult(result);
    } catch (e) {
      const message = String(e);
      setLocalError(message);
      toast.error(message);
    } finally {
      setScanLoading(false);
    }
  }, [invoke, onScanResult]);

  useEffect(() => {
    if (activeTab === "local" && !scanResult && !scanLoading) {
      runScan();
    }
  }, [activeTab, scanLoading, scanResult, runScan]);

  // Install local source (folder or archive)
  const installLocalSource = async (sourcePath: string) => {
    const name = sourcePath.split("/").pop() || sourcePath;
    const toastId = toast.loading(`正在安装 ${name}...`);
    try {
      await invoke("skills:installLocal", sourcePath, name);
      toast.success(`${name} 安装成功`, {
        id: toastId,
        action: { label: "查看", onClick: () => onNavigate("my-skills") },
      });
      await onRefresh();
      await runScan();
    } catch (e) {
      toast.error(String(e), { id: toastId });
    }
  };

  const handleLocalFolderInstall = async () => {
    try {
      const paths = await invoke<string[]>("preview-open-dialog", { properties: ["openDirectory"] });
      if (!paths || paths.length === 0) return;
      installLocalSource(paths[0]);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleLocalFileInstall = async () => {
    try {
      const paths = await invoke<string[]>("preview-open-dialog", {
        properties: ["openFile"],
        filters: [{ name: "技能包", extensions: ["zip", "skill"] }],
      });
      if (!paths || paths.length === 0) return;
      installLocalSource(paths[0]);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleBatchImportFolder = async () => {
    try {
      const paths = await invoke<string[]>("preview-open-dialog", { properties: ["openDirectory"] });
      if (!paths || paths.length === 0) return;

      const toastId = toast.loading("正在批量导入...");
      const result = await invoke<BatchImportResult>("skills:batchImportFolder", paths[0]);

      if (result.errors.length > 0) {
        const preview = result.errors.slice(0, 3).join("; ");
        const remaining = result.errors.length - 3;
        const detail = remaining > 0 ? `${preview}; +${remaining} more` : preview;
        toast.error(`导入出错 (${result.errors.length}): ${detail}`, { id: toastId });
      } else if (result.imported === 0) {
        toast.info(`全部跳过 (${result.skipped} 个已存在)`, { id: toastId });
      } else {
        toast.success(`成功导入 ${result.imported} 个，跳过 ${result.skipped} 个`, { id: toastId });
      }

      await onRefresh();
      await runScan();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleImportDiscovered = async (sourcePath: string, name: string) => {
    setImportingPaths((prev) => new Set(prev).add(sourcePath));
    try {
      await invoke("skills:installLocal", sourcePath, name);
      toast.success(`${name} 已导入`);
      await onRefresh();
      await runScan();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setImportingPaths((prev) => {
        const next = new Set(prev);
        next.delete(sourcePath);
        return next;
      });
    }
  };

  const handleImportAllDiscovered = async () => {
    if (!scanResult) return;
    const pending = scanResult.groups.filter((g) => !g.imported);
    if (pending.length === 0) return;
    setImportingAll(true);
    let imported = 0;
    let failed = 0;
    for (const group of pending) {
      const loc = group.locations[0];
      if (!loc) continue;
      try {
        await invoke("skills:installLocal", loc.found_path, group.name);
        imported++;
      } catch {
        failed++;
      }
    }
    if (imported > 0) toast.success(`成功导入 ${imported} 个技能`);
    if (failed > 0) toast.error(`${failed} 个导入失败`);
    setImportingAll(false);
    await onRefresh();
    await runScan();
  };

  const handleInstallMarketSkill = async (skill: SkillsShSkill) => {
    const sourceRef = `${skill.source}/${skill.skill_id}`;
    setInstallingMarketRefs((prev) => new Set(prev).add(sourceRef));
    const toastId = toast.loading(`正在安装 ${skill.name || skill.skill_id}...`);
    try {
      await invoke("skills:installSkillssh", skill.source, skill.skill_id);
      toast.success(`${skill.name || skill.skill_id} 安装成功`, {
        id: toastId,
        action: { label: "查看", onClick: () => onNavigate("my-skills") },
      });
      await onRefresh();
    } catch (e) {
      toast.error(String(e), { id: toastId });
    } finally {
      setInstallingMarketRefs((prev) => {
        const next = new Set(prev);
        next.delete(sourceRef);
        return next;
      });
    }
  };

  // Git
  const handleGitPreview = async () => {
    if (!gitUrl.trim()) return;
    setGitLoading(true);
    try {
      // Git preview not yet wired; show toast
      toast.info("Git 导入功能开发中");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setGitLoading(false);
    }
  };

  // --- Computed ---
  const sourceOptions = useMemo(
    () => Array.from(new Set(marketSkills.map((s) => s.source))),
    [marketSkills],
  );

  const filteredMarketSkills = useMemo(() => {
    const filtered = marketSourceFilter === "all"
      ? marketSkills
      : marketSkills.filter((s) => s.source === marketSourceFilter);
    if (debouncedMarketQuery.trim().length > 0) {
      return [...filtered].sort((a, b) => b.installs - a.installs);
    }
    return filtered;
  }, [marketSkills, marketSourceFilter, debouncedMarketQuery]);

  const totalMarketPages = Math.max(1, Math.ceil(filteredMarketSkills.length / MARKET_PAGE_SIZE));
  const currentMarketPage = Math.min(marketPage, totalMarketPages);
  const marketPageStart = (currentMarketPage - 1) * MARKET_PAGE_SIZE;
  const paginatedMarketSkills = filteredMarketSkills.slice(marketPageStart, marketPageStart + MARKET_PAGE_SIZE);

  const visibleMarketPages = Array.from({ length: totalMarketPages }, (_, i) => i + 1).filter((page) => {
    if (totalMarketPages <= 7) return true;
    if (page === 1 || page === totalMarketPages) return true;
    return Math.abs(page - currentMarketPage) <= 1;
  });

  const hasMarketQuery = debouncedMarketQuery.trim().length > 0;
  const canLoadMoreSearch = hasMarketQuery && marketSkills.length >= marketSearchLimit;
  const isLoadingMoreSearch = hasMarketQuery && marketLoadingMore;

  const scanGroups = scanResult?.groups ?? [];
  const pendingGroups = scanGroups.filter((g) => !g.imported);

  const scrollMarketListToTop = () => {
    marketListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const changeMarketPage = (page: number) => {
    setMarketPage(page);
    scrollMarketListToTop();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header with tabs */}
      <div>
        <h1 className="text-lg font-semibold text-[#1D2129] mb-4">发现安装</h1>
        <div className="flex gap-1 border-b border-[#E5E6EB]">
          {([
            { id: "market" as const, label: "发现市场", icon: Box },
            { id: "local" as const, label: "本地导入", icon: UploadCloud },
            { id: "git" as const, label: "Git 导入", icon: GitBranch },
          ]).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-1 pb-1.5 mr-4 text-[13px] font-medium transition-colors outline-none",
                  isActive
                    ? "border-accent text-accent"
                    : "border-transparent text-[#86909C] hover:text-[#4E5969]",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================== MARKET TAB ==================== */}
      {activeTab === "market" && (
        <div className="flex flex-col gap-4">
          {/* Search + leaderboard */}
          <div className="rounded-xl border border-[#E5E6EB] bg-white p-3.5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                  {!hasMarketQuery ? (
                    <div className="flex rounded-lg border border-[#E5E6EB] bg-[#F5F6F8] p-0.5 shrink-0">
                      {([
                        { id: "alltime" as const, label: "总榜", icon: Clock },
                        { id: "trending" as const, label: "趋势", icon: TrendingUp },
                        { id: "hot" as const, label: "热门", icon: Star },
                      ]).map((tab) => {
                        const Icon = tab.icon;
                        const isActive = marketTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setMarketTab(tab.id)}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                              isActive
                                ? "bg-white text-[#1D2129] shadow-sm"
                                : "text-[#86909C] hover:text-[#4E5969]",
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="relative flex-1 lg:max-w-[480px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#86909C]" />
                    <input
                      type="text"
                      value={marketQuery}
                      onChange={(e) => {
                        setMarketQuery(e.target.value);
                        setMarketSearchLimit(MARKET_SEARCH_STEP);
                      }}
                      placeholder="搜索 skills.sh 市场..."
                      className="w-full rounded-lg border border-[#E5E6EB] bg-white pl-9 pr-3 py-2 text-[13px] text-[#1D2129] outline-none placeholder:text-[#C9CDD4] focus:border-accent"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              {/* Source filter pills */}
              {sourceOptions.length > 0 && (
                <div className="border-t border-[#F2F3F5] pt-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="shrink-0 text-[13px] font-medium text-[#86909C]">来源</span>
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setMarketSourceFilter("all")}
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors whitespace-nowrap",
                          marketSourceFilter === "all"
                            ? "border-accent/40 bg-accent/8 text-accent"
                            : "border-[#E5E6EB] bg-white text-[#86909C] hover:text-[#4E5969]",
                        )}
                      >
                        全部
                      </button>
                      {sourceOptions.map((source) => (
                        <button
                          key={source}
                          type="button"
                          onClick={() => setMarketSourceFilter(source)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[13px] font-medium transition-colors whitespace-nowrap",
                            "shrink-0",
                            marketSourceFilter === source
                              ? "border-accent/40 bg-accent/8 text-accent"
                              : "border-[#E5E6EB] bg-white text-[#86909C] hover:text-[#4E5969]",
                          )}
                        >
                          @{source}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Error banner */}
          {marketError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-red-600">请求失败</p>
                <p className="text-[12px] text-red-500">{marketError}</p>
              </div>
              <button
                onClick={() => setMarketReloadKey((k) => k + 1)}
                className="rounded-md bg-red-500/20 px-3 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-500/30"
              >
                重试
              </button>
            </div>
          )}

          {/* Market content */}
          {marketLoading && !marketLoadingMore ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-[#86909C]" />
            </div>
          ) : (
            <div className="pb-8">
              <div ref={marketListRef} className="scroll-mt-4" />

              {filteredMarketSkills.length === 0 ? (
                <div className="rounded-xl border border-[#E5E6EB] bg-white flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E6EB] bg-[#F5F6F8] text-[#86909C]">
                    <Search className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold text-[#4E5969]">没有找到技能</h3>
                  <p className="mt-1 max-w-md text-[13px] text-[#86909C]">
                    没有匹配当前筛选条件的技能，请尝试其他关键词或筛选条件
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                    {paginatedMarketSkills.map((skill) => {
                      const displayName = skill.name || skill.skill_id;
                      const showSkillId = skill.skill_id.trim() !== displayName.trim();
                      const owner = skill.source.split("/")[0];
                      const avatarUrl = `https://github.com/${owner}.png?size=32`;
                      const sourceRef = `${skill.source}/${skill.skill_id}`;
                      const isInstalled = installedSourceRefs.has(sourceRef);
                      const isInstalling = installingMarketRefs.has(sourceRef);
                      const skillsShUrl = `https://skills.sh/${skill.source}/${skill.skill_id}`;

                      return (
                        <div
                          key={skill.id}
                          className="rounded-xl border border-[#E5E6EB] bg-white flex flex-col gap-2 p-3 transition-colors hover:border-[#C9CDD4]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <img
                                src={avatarUrl}
                                alt={owner}
                                className="h-6 w-6 shrink-0 rounded-full border border-[#E5E6EB]"
                                loading="lazy"
                              />
                              <div className="min-w-0">
                                <h3 className="truncate text-[13px] font-semibold text-[#4E5969]">
                                  {displayName}
                                </h3>
                                {showSkillId && (
                                  <p className="truncate text-[13px] leading-4 text-[#86909C]">{skill.skill_id}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button
                                onClick={() => window.open(skillsShUrl, "_blank")}
                                className="rounded-[5px] p-1 text-[#86909C] transition-colors hover:bg-[#F2F3F5] hover:text-[#4E5969]"
                                title="在 skills.sh 查看"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </button>
                              {isInstalled && (
                                <span className="rounded-[5px] border border-emerald-500/20 bg-emerald-500/10 p-1 text-emerald-500"
                                  title="已安装">
                                  <DownloadCloud className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setMarketSourceFilter(skill.source)}
                              disabled={marketSourceFilter === skill.source}
                              className={cn(
                                "rounded-[5px] bg-accent/8 px-1.5 py-0.5 text-[13px] leading-4 font-medium text-accent transition-colors",
                                marketSourceFilter === skill.source
                                  ? "cursor-default opacity-90"
                                  : "hover:bg-accent/15",
                              )}
                            >
                              @{skill.source}
                            </button>
                            {marketTab === "alltime" && skill.installs > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-[5px] border border-[#E5E6EB] bg-[#F5F6F8] px-1.5 py-0.5 text-[13px] leading-4 text-[#86909C]">
                                <DownloadCloud className="h-3 w-3" />
                                {skill.installs >= 1_000_000
                                  ? `${(skill.installs / 1_000_000).toFixed(1)}M`
                                  : skill.installs >= 1_000
                                    ? `${(skill.installs / 1_000).toFixed(1)}K`
                                    : skill.installs}
                              </span>
                            )}
                            {isInstalled && (
                              <span className="inline-flex items-center gap-1 rounded-[5px] border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[13px] leading-4 font-medium text-emerald-500">
                                <DownloadCloud className="h-3 w-3" />
                                已安装
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleInstallMarketSkill(skill)}
                            disabled={isInstalled || isInstalling}
                            className={cn(
                              "mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                              isInstalled
                                ? "cursor-default border border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                                : "bg-accent text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70",
                            )}
                          >
                            {isInstalling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <DownloadCloud className="h-3.5 w-3.5" />
                            )}
                            {isInstalled ? "已安装" : isInstalling ? "安装中..." : "安装"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalMarketPages > 1 && (
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
                      <button
                        onClick={() => changeMarketPage(Math.max(1, currentMarketPage - 1))}
                        disabled={currentMarketPage === 1}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E5E6EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#4E5969] transition-colors hover:bg-[#F5F6F8] disabled:opacity-50"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        上一页
                      </button>

                      {visibleMarketPages.map((page, index) => {
                        const previousPage = visibleMarketPages[index - 1];
                        const showGap = previousPage && page - previousPage > 1;
                        return (
                          <div key={page} className="flex items-center gap-1.5">
                            {showGap && <span className="px-1 text-[13px] text-[#C9CDD4]">...</span>}
                            <button
                              onClick={() => changeMarketPage(page)}
                              className={cn(
                                "min-w-8 rounded-md border px-2.5 py-1.5 text-[13px] font-semibold transition-colors",
                                page === currentMarketPage
                                  ? "border-accent/40 bg-accent text-white"
                                  : "border-[#E5E6EB] bg-white text-[#4E5969] hover:bg-[#F5F6F8]",
                              )}
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}

                      <button
                        onClick={() => changeMarketPage(Math.min(totalMarketPages, currentMarketPage + 1))}
                        disabled={currentMarketPage === totalMarketPages}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E5E6EB] bg-white px-3 py-1.5 text-[13px] font-medium text-[#4E5969] transition-colors hover:bg-[#F5F6F8] disabled:opacity-50"
                      >
                        下一页
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Load more search results */}
                  {hasMarketQuery && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setMarketSearchLimit((v) => v + MARKET_SEARCH_STEP)}
                        disabled={!canLoadMoreSearch || marketLoading}
                        className="inline-flex items-center gap-2 rounded-md border border-[#E5E6EB] bg-white px-3.5 py-2 text-[13px] font-medium text-[#4E5969] transition-colors hover:bg-[#F5F6F8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {marketLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="h-3.5 w-3.5" />
                        )}
                        {isLoadingMoreSearch ? "加载中..." : "加载更多"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== LOCAL TAB ==================== */}
      {activeTab === "local" && (
        <div className="flex flex-col gap-4 pb-8">
          {/* Install actions */}
          <div className="rounded-xl border border-[#E5E6EB] bg-white overflow-hidden">
            <div className="border-b border-[#F2F3F5] px-4 py-3.5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-xl">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-[#86909C]">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/8 px-2 py-1 font-medium text-accent">
                      <FolderUp className="h-3.5 w-3.5" />
                      本地导入
                    </span>
                  </div>
                  <h2 className="text-[14px] font-semibold text-[#4E5969]">导入本地技能</h2>
                  <p className="mt-1 text-[13px] leading-5 text-[#86909C]">
                    选择包含 SKILL.md 文件的文件夹、.zip/.skill 压缩包，或扫描整个目录批量导入
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleLocalFolderInstall}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                  >
                    <FolderUp className="h-4 w-4" />
                    选择文件夹
                  </button>
                  <button
                    type="button"
                    onClick={handleLocalFileInstall}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E6EB] bg-white px-3 py-2 text-[13px] font-medium text-[#4E5969] hover:bg-[#F5F6F8] transition-colors"
                  >
                    <UploadCloud className="h-4 w-4" />
                    选择压缩包
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchImportFolder}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E6EB] bg-white px-3 py-2 text-[13px] font-medium text-[#4E5969] hover:bg-[#F5F6F8] transition-colors"
                  >
                    <FolderInput className="h-4 w-4" />
                    批量导入
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {localError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-red-600">请求失败</p>
                <p className="text-[12px] text-red-500">{localError}</p>
              </div>
              <button
                onClick={runScan}
                className="rounded-md bg-red-500/20 px-3 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-500/30"
              >
                重试
              </button>
            </div>
          )}

          {/* Scan results */}
          <div className="rounded-xl border border-[#E5E6EB] bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-[#F2F3F5] px-4 py-3.5">
              <div>
                <h2 className="text-[13px] font-semibold text-[#4E5969]">环境扫描</h2>
                <p className="mt-0.5 text-[13px] text-[#86909C]">
                  {scanResult
                    ? `已扫描 ${scanResult.tools_scanned} 个工具，发现 ${scanResult.skills_found} 个技能`
                    : "自动扫描已安装工具中的外部技能"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runScan}
                  disabled={scanLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E6EB] bg-[#F5F6F8] px-3 py-2 text-[13px] font-medium text-[#4E5969] transition-colors hover:bg-[#E5E6EB] disabled:opacity-50"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", scanLoading && "animate-spin")} />
                  重新扫描
                </button>
                <button
                  onClick={handleImportAllDiscovered}
                  disabled={scanLoading || importingAll || pendingGroups.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {importingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <DownloadCloud className="h-3.5 w-3.5" />
                  )}
                  导入全部
                </button>
              </div>
            </div>

            <div className="p-4">
              {scanLoading ? (
                <div className="flex items-center justify-center gap-2.5 py-12 text-[#86909C]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-[13px]">正在扫描...</span>
                </div>
              ) : scanResult && scanGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E6EB] bg-[#F5F6F8]">
                    <FolderSearch className="h-5 w-5 text-[#86909C]" />
                  </div>
                  <h3 className="mb-1 text-[13px] font-semibold text-[#86909C]">未找到技能</h3>
                  <p className="text-[13px] text-[#86909C]">未在已安装工具中发现外部技能文件</p>
                </div>
              ) : (
                <div className="rounded-lg border border-[#E5E6EB] overflow-hidden">
                  {scanGroups.map((group) => {
                    const [primaryLocation, ...otherLocations] = group.locations;
                    const primaryPath = primaryLocation?.found_path;
                    const isImporting = !!primaryPath && importingPaths.has(primaryPath);
                    const foundDate = new Date(group.found_at).toLocaleDateString(undefined, {
                      year: "numeric", month: "short", day: "numeric",
                    });

                    return (
                      <article key={group.name} className="border-b border-[#F2F3F5] last:border-b-0">
                        <div className="flex items-start justify-between gap-3 px-3 py-2">
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <h3 className="truncate text-[13px] font-semibold text-[#4E5969]">{group.name}</h3>
                              {group.imported && (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[13px] font-semibold text-emerald-500">
                                  <DownloadCloud className="h-3 w-3" />
                                  已导入
                                </span>
                              )}
                              <span className="shrink-0 rounded-full border border-[#E5E6EB] bg-[#F5F6F8] px-2 py-0.5 text-[13px] text-[#86909C]">
                                {group.locations.length} 个位置
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#86909C]">
                                <Clock className="h-3 w-3" />
                                {foundDate}
                              </span>
                            </div>
                            {primaryLocation && (
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="inline-flex shrink-0 rounded-[4px] border border-[#E5E6EB] bg-[#F5F6F8] px-1.5 py-px text-[13px] font-medium text-[#86909C]">
                                  {primaryLocation.tool}
                                </span>
                                <code className="block min-w-0 truncate text-[13px] text-[#86909C]">
                                  {primaryLocation.found_path}
                                </code>
                              </div>
                            )}
                          </div>

                          <div className="flex shrink-0 items-start justify-end">
                            {!group.imported && (
                              <button
                                onClick={() => primaryPath && handleImportDiscovered(primaryPath, group.name)}
                                disabled={!primaryPath || isImporting}
                                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                              >
                                {isImporting ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <DownloadCloud className="h-3 w-3" />
                                )}
                                导入
                              </button>
                            )}
                          </div>
                        </div>

                        {otherLocations.length > 0 && (
                          <div className="border-t border-[#F2F3F5] bg-[#F5F6F8]/40 px-3 py-1.5">
                            <div className="space-y-1">
                              {otherLocations.map((loc) => (
                                <div key={loc.id} className="flex min-w-0 items-center gap-2">
                                  <span className="inline-flex shrink-0 rounded-[4px] border border-[#E5E6EB] bg-[#F5F6F8] px-1.5 py-px text-[13px] font-medium text-[#86909C]">
                                    {loc.tool}
                                  </span>
                                  <code className="block min-w-0 truncate text-[13px] text-[#C9CDD4]">
                                    {loc.found_path}
                                  </code>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== GIT TAB ==================== */}
      {activeTab === "git" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-[#E5E6EB] bg-white max-w-lg p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E6EB] bg-[#F5F6F8]">
              <GitBranch className="h-5 w-5 text-[#86909C]" />
            </div>
            <h2 className="mb-1 text-[14px] font-semibold text-[#1D2129]">从 Git 仓库安装</h2>
            <p className="mb-4 text-[13px] text-[#86909C]">
              输入 Git 仓库 URL，系统将自动克隆并导入其中的技能文件
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[13px] font-medium text-[#86909C]">仓库 URL</label>
                <input
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !gitLoading && gitUrl.trim()) handleGitPreview(); }}
                  placeholder="https://github.com/user/skills.git"
                  disabled={gitLoading}
                  className="w-full rounded-lg border border-[#E5E6EB] bg-white px-3 py-2 text-[13px] text-[#1D2129] outline-none placeholder:text-[#C9CDD4] focus:border-accent disabled:opacity-50"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleGitPreview}
                  disabled={!gitUrl.trim() || gitLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {gitLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <DownloadCloud className="h-3.5 w-3.5" />
                      安装
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Git preview modal (placeholder — backend not yet wired) */}
      {gitPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setGitPreview(null); setGitSelections([]); }}
          />
          <div className="relative w-full max-w-md rounded-xl border border-[#E5E6EB] bg-white p-5 shadow-2xl">
            <h2 className="text-[14px] font-semibold text-[#1D2129] mb-3">选择要安装的技能</h2>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {gitSelections.map((item, idx) => (
                <div
                  key={item.dir_name}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                    item.selected
                      ? "border-accent/40 bg-accent/5"
                      : "border-[#E5E6EB] bg-white opacity-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={item.selected}
                    disabled={false}
                    onChange={(e) =>
                      setGitSelections((prev) =>
                        prev.map((s, i) => (i === idx ? { ...s, selected: e.target.checked } : s)),
                      )
                    }
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) =>
                        setGitSelections((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s)),
                        )
                      }
                      disabled={!item.selected || false}
                      placeholder="技能名称"
                      className="w-full rounded border border-[#E5E6EB] bg-white px-2 py-1 text-[13px] outline-none focus:border-accent disabled:opacity-50"
                    />
                    {item.description && (
                      <p className="mt-1 truncate text-[12px] text-[#86909C]">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setGitPreview(null); setGitSelections([]); }}
                disabled={false}
                className="px-3 py-1.5 text-[13px] font-medium text-[#86909C] hover:text-[#4E5969] transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  toast.info("Git 导入功能开发中");
                }}
                disabled={false || gitSelections.every((s) => !s.selected)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <DownloadCloud className="h-3.5 w-3.5" />
                确认安装
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
