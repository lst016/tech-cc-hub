import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { ApiConfigProfile } from "../../types";
import {
  applyModelCatalogBulkAction,
  buildModelCatalogEntries,
  filterModelCatalogEntries,
  updateModelCatalogEntry,
  type ModelCapability,
  type ModelCatalogEntry,
} from "./model-catalog-utils";

type ModelCatalogSettingsPageProps = {
  profiles: ApiConfigProfile[];
  onChange: (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => void;
};

const PAGE_SIZE = 20;

const capabilityLabels: Record<ModelCapability, string> = {
  text: "文本",
  reasoning: "推理·推断",
  "image-understanding": "图片理解·推断",
  "image-generation": "图片生成",
  embedding: "嵌入·推断",
  rerank: "重排·推断",
  audio: "语音·推断",
};

const routeSlotLabels: Record<string, string> = {
  model: "主模型",
  expertModel: "专家",
  smallModel: "小模型",
  analysisModel: "分析",
  imageModel: "图片理解",
  imageGenerationModel: "图片生成",
};

const statusMeta: Record<ModelCatalogEntry["catalogStatus"], { label: string; className: string }> = {
  managed: { label: "已纳管", className: "border-emerald-500/20 bg-emerald-50 text-emerald-700" },
  excluded: { label: "已排除", className: "border-ink-900/10 bg-surface text-muted" },
};

export function ModelCatalogSettingsPage({ profiles, onChange }: ModelCatalogSettingsPageProps) {
  const [query, setQuery] = useState("");
  const [profileId, setProfileId] = useState("");
  const [ownedBy, setOwnedBy] = useState("");
  const [capability, setCapability] = useState<ModelCapability | "">("");
  const [catalogStatus, setCatalogStatus] = useState<ModelCatalogEntry["catalogStatus"] | "">("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  const entries = useMemo(() => buildModelCatalogEntries(profiles), [profiles]);
  const filteredEntries = useMemo(() => filterModelCatalogEntries(entries, {
    query,
    profileId,
    ownedBy,
    capability,
    catalogStatus,
  }), [capability, catalogStatus, entries, ownedBy, profileId, query]);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const pageEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeEntry = entries.find((entry) => entry.key === activeKey) ?? null;
  const managedCount = entries.filter((entry) => entry.managed).length;
  const uniqueModelCount = new Set(entries.map((entry) => entry.modelName)).size;
  const ownerOptions = Array.from(new Set(entries.map((entry) => entry.ownedBy).filter(Boolean) as string[])).sort();
  const currentPageAllSelected = pageEntries.length > 0 && pageEntries.every((entry) => selectedKeys.has(entry.key));
  const hasFilters = Boolean(query || profileId || ownedBy || capability || catalogStatus);

  useEffect(() => {
    setPage(1);
  }, [query, profileId, ownedBy, capability, catalogStatus]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setSelectedKeys((current) => new Set([...current].filter((key) => entries.some((entry) => entry.key === key))));
    if (activeKey && !entries.some((entry) => entry.key === activeKey)) setActiveKey(null);
  }, [activeKey, entries]);

  const togglePageSelection = () => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      for (const entry of pageEntries) {
        if (currentPageAllSelected) next.delete(entry.key);
        else next.add(entry.key);
      }
      return next;
    });
  };

  const runBulkAction = (action: "manage" | "exclude", keys = [...selectedKeys]) => {
    if (keys.length === 0) return;
    const result = applyModelCatalogBulkAction(profiles, keys, action);
    const blockedCount = result.blockedKeys.length;
    const appliedCount = keys.length - blockedCount;

    onChange(() => result.profiles);
    setNotice(blockedCount > 0
      ? `${appliedCount > 0 ? `已排除 ${appliedCount} 个模型；` : ""}${blockedCount} 个模型正在被路由使用，未执行排除。请先到“路由策略”更换模型。`
      : action === "manage" ? `已将 ${appliedCount} 个模型纳入可用池。` : `已排除 ${appliedCount} 个模型。`);
    setSelectedKeys(new Set(result.blockedKeys));
  };

  const patchActive = (patch: Parameters<typeof updateModelCatalogEntry>[2]) => {
    if (!activeEntry) return;
    onChange((current) => updateModelCatalogEntry(current, activeEntry.key, patch));
  };

  const clearFilters = () => {
    setQuery("");
    setProfileId("");
    setOwnedBy("");
    setCapability("");
    setCatalogStatus("");
  };

  return (
    <div className={`relative grid h-full min-h-0 overflow-hidden rounded-[18px] border border-ink-900/10 bg-white shadow-[0_1px_2px_rgba(24,32,46,0.04)] ${activeEntry ? "min-[1440px]:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ink-900/8 px-5 py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm text-ink-700">
            <span><strong className="font-semibold text-ink-900">{entries.length}</strong> 个部署</span>
            <span><strong className="font-semibold text-ink-900">{uniqueModelCount}</strong> 个模型</span>
            <span><strong className="font-semibold text-ink-900">{managedCount}</strong> 已纳管</span>
            <span><strong className="font-semibold text-ink-900">{profiles.length}</strong> 个网关</span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            目录来自各网关实际拉取结果
          </div>
        </div>

        <div className="shrink-0 border-b border-ink-900/8 bg-[#F8F9FB] p-4">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,1.6fr)_repeat(4,minmax(116px,1fr))]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-xl border border-ink-900/10 bg-white pl-9 pr-3 text-sm text-ink-800 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10"
                placeholder="搜索模型、别名、厂商或标签"
              />
            </label>
            <CatalogSelect
              value={profileId}
              onChange={setProfileId}
              ariaLabel="按网关筛选"
              options={[
                { value: "", label: "全部网关" },
                ...profiles.map((profile) => ({ value: profile.id, label: profile.name || "未命名网关" })),
              ]}
            />
            <CatalogSelect
              value={ownedBy}
              onChange={setOwnedBy}
              ariaLabel="按厂商筛选"
              options={[
                { value: "", label: "全部厂商" },
                ...ownerOptions.map((owner) => ({ value: owner, label: owner })),
              ]}
            />
            <CatalogSelect
              value={capability}
              onChange={(value) => setCapability(value as ModelCapability | "")}
              ariaLabel="按能力筛选"
              options={[
                { value: "", label: "全部能力" },
                ...Object.entries(capabilityLabels).map(([value, label]) => ({ value, label })),
              ]}
            />
            <CatalogSelect
              value={catalogStatus}
              onChange={(value) => setCatalogStatus(value as ModelCatalogEntry["catalogStatus"] | "")}
              ariaLabel="按纳管状态筛选"
              options={[
                { value: "", label: "全部状态" },
                { value: "managed", label: "已纳管" },
                { value: "excluded", label: "已排除" },
              ]}
            />
          </div>
          {hasFilters && (
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />当前筛选到 {filteredEntries.length} 个部署</span>
              <button type="button" onClick={clearFilters} className="text-accent hover:underline">清空筛选</button>
            </div>
          )}
        </div>

        {(selectedKeys.size > 0 || notice) && (
          <div className="shrink-0 border-b border-ink-900/8">
            {selectedKeys.size > 0 && (
              <div className="flex min-h-[48px] flex-wrap items-center justify-between gap-3 px-4 py-2">
                <div className="text-sm text-ink-800">已选择 <strong>{selectedKeys.size}</strong> 个部署</div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => runBulkAction("manage")} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent/90">恢复默认使用</button>
                  <button type="button" onClick={() => runBulkAction("exclude")} className="rounded-lg border border-ink-900/10 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-surface">排除</button>
                  <button type="button" onClick={() => setSelectedKeys(new Set())} className="rounded-lg p-1.5 text-muted hover:bg-surface" aria-label="取消选择"><X className="h-4 w-4" /></button>
                </div>
              </div>
            )}
            {notice && (
              <div className={`flex min-h-[40px] w-full items-center justify-between gap-3 px-4 py-2 text-xs text-ink-700 ${selectedKeys.size > 0 ? "border-t border-ink-900/8 bg-surface/35" : ""}`}>
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice(null)} className="rounded p-1 text-muted hover:bg-surface" aria-label="关闭提示"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>
        )}

        <div data-model-catalog-scroll-region className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[820px] table-fixed border-collapse text-left text-[13px]">
            <thead className="sticky top-0 z-10 bg-[#F7F8FA] text-muted">
              <tr className="h-11 border-b border-ink-900/8 text-[11px] uppercase tracking-[0.04em]">
                <th className="w-11 px-3 text-center"><input type="checkbox" checked={currentPageAllSelected} onChange={togglePageSelection} aria-label="选择当前页" /></th>
                <th className="w-[25%] px-3 font-medium">模型</th>
                <th className="w-[16%] px-3 font-medium">网关</th>
                <th className="w-[16%] px-3 font-medium">类别 / 能力</th>
                <th className="w-[12%] px-3 font-medium">本地上下文</th>
                <th className="w-[11%] px-3 font-medium">纳管状态</th>
                <th className={`w-[20%] px-3 font-medium ${activeEntry ? "hidden" : ""}`}>路由状态</th>
              </tr>
            </thead>
            <tbody>
              {pageEntries.map((entry) => (
                <tr
                  key={entry.key}
                  className={`h-12 cursor-pointer border-b border-ink-900/[0.06] transition hover:bg-accent/[0.035] ${entry.key === activeKey ? "bg-accent/[0.06]" : ""}`}
                  onClick={() => setActiveKey(entry.key)}
                >
                  <td className="px-3 text-center" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(entry.key)}
                      onChange={() => setSelectedKeys((current) => {
                        const next = new Set(current);
                        if (next.has(entry.key)) next.delete(entry.key); else next.add(entry.key);
                        return next;
                      })}
                      aria-label={`选择 ${entry.modelName}`}
                    />
                  </td>
                  <td className="px-3"><div className="truncate font-medium text-ink-900" title={entry.modelName}>{entry.alias || entry.modelName}</div>{entry.alias && <div className="truncate text-[10px] text-muted">{entry.modelName}</div>}</td>
                  <td className="px-3"><div className="truncate text-ink-700">{entry.profileName}</div><div className="mt-0.5 text-[10px] text-muted">{providerLabel(entry.provider)}</div></td>
                  <td className="px-3"><div className="flex flex-wrap gap-1">{entry.capabilities.slice(0, 2).map((item) => <CapabilityBadge key={item} capability={item} inferred={entry.capabilitiesInferred} />)}</div></td>
                  <td className="px-3 text-ink-700">{entry.contextWindow ? formatContext(entry.contextWindow) : "—"}</td>
                  <td className="px-3"><StatusBadge status={entry.catalogStatus} /></td>
                  <td className={`px-3 text-muted ${activeEntry ? "hidden" : ""}`}>
                    {entry.routeState === "assigned" ? (
                      <div className="flex flex-wrap gap-1">
                        {entry.routeSlots.map((slot) => (
                          <span key={slot} className="whitespace-nowrap rounded-md bg-ink-900/[0.045] px-1.5 py-0.5 text-[10px] text-ink-700">
                            {routeSlotLabels[slot]}
                          </span>
                        ))}
                      </div>
                    ) : entry.routeState === "available" ? (
                      <span className="text-emerald-700">默认可用</span>
                    ) : entry.routeState === "excluded" ? (
                      <span>手动排除</span>
                    ) : (
                      <span>网关未启用</span>
                    )}
                  </td>
                </tr>
              ))}
              {pageEntries.length === 0 && (
                <tr><td colSpan={7} className="h-64 text-center text-sm text-muted"><Boxes className="mx-auto mb-3 h-8 w-8 text-muted-light" />没有符合条件的模型</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex min-h-[50px] shrink-0 items-center justify-between border-t border-ink-900/8 px-4 text-xs text-muted">
          <span>第 {(page - 1) * PAGE_SIZE + (pageEntries.length > 0 ? 1 : 0)}–{Math.min(page * PAGE_SIZE, filteredEntries.length)} 项，共 {filteredEntries.length} 项</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-ink-900/10 p-1.5 text-ink-700 disabled:opacity-35"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-16 text-center">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-ink-900/10 p-1.5 text-ink-700 disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </section>

      {activeEntry && (
        <aside className="absolute inset-y-0 right-0 z-20 flex min-h-0 w-[360px] flex-col border-l border-ink-900/8 bg-white shadow-[-18px_0_36px_rgba(24,32,46,0.10)] min-[1440px]:static min-[1440px]:w-auto min-[1440px]:shadow-none">
          <div className="flex h-16 items-center justify-between border-b border-ink-900/8 px-5">
            <div className="min-w-0"><div className="truncate text-sm font-semibold text-ink-900">{activeEntry.alias || activeEntry.modelName}</div><div className="mt-0.5 truncate text-[11px] text-muted">{activeEntry.profileName}</div></div>
            <button type="button" onClick={() => setActiveKey(null)} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="关闭模型详情"><X className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <DetailSection icon={<Boxes className="h-4 w-4" />} title="发现信息（只读）">
              <ReadOnlyField label="模型 ID" value={activeEntry.modelName} mono />
              <ReadOnlyField label="厂商 / 系列" value={activeEntry.ownedBy || "上游未提供"} />
              <ReadOnlyField label="接口协议" value={activeEntry.protocols.length > 0 ? activeEntry.protocols.join(" / ") : "上游未提供"} />
              <div><div className="mb-1.5 text-[11px] text-muted">模型能力</div><div className="flex flex-wrap gap-1">{activeEntry.capabilities.map((item) => <CapabilityBadge key={item} capability={item} inferred={activeEntry.capabilitiesInferred} />)}</div></div>
            </DetailSection>

            <DetailSection icon={<SlidersHorizontal className="h-4 w-4" />} title="本地配置">
              <div className="grid grid-cols-2 gap-2">
                <DetailNumberInput label="本地上下文" value={activeEntry.contextWindow} min={1} onChange={(value) => patchActive({ contextWindow: value })} />
                <DetailNumberInput label="压缩阈值 %" value={activeEntry.compressionThresholdPercent} min={1} max={100} onChange={(value) => patchActive({ compressionThresholdPercent: value })} />
              </div>
              <DetailNumberInput label="路由优先级（0–100）" value={activeEntry.routingWeight} min={0} max={100} onChange={(value) => patchActive({ routingWeight: value })} />
              <p className="text-[11px] leading-5 text-muted">未单独配置的模型按 0 处理；同名模型优先选择数值更高的网关。</p>
            </DetailSection>
          </div>
          <div className="flex min-h-[66px] items-center justify-between gap-2 border-t border-ink-900/8 px-5">
            <StatusBadge status={activeEntry.catalogStatus} />
            {activeEntry.managed ? (
              <button type="button" onClick={() => runBulkAction("exclude", [activeEntry.key])} className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs text-ink-700 hover:bg-surface">排除模型</button>
            ) : (
              <button type="button" onClick={() => runBulkAction("manage", [activeEntry.key])} className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent/90">恢复默认使用</button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

type CatalogSelectOption = {
  value: string;
  label: string;
};

function CatalogSelect({ value, onChange, ariaLabel, options }: { value: string; onChange: (value: string) => void; ariaLabel: string; options: CatalogSelectOption[] }) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = options[selectedIndex] ?? options[0];

  const closeMenu = useCallback(() => setOpen(false), []);
  const openMenu = useCallback(() => {
    setActiveIndex(selectedIndex);
    setOpen(true);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  const selectOption = (option: CatalogSelectOption) => {
    onChange(option.value);
    closeMenu();
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <div ref={containerRef} className="relative min-w-0" data-catalog-select>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        className={`flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left text-xs text-ink-700 outline-none transition ${open ? "border-accent ring-4 ring-accent/10" : "border-ink-900/10 hover:border-ink-900/20"}`}
        onClick={() => { if (open) closeMenu(); else openMenu(); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              openMenu();
              return;
            }
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((current) => (current + direction + options.length) % options.length);
            return;
          }
          if (event.key === "Home" && open) {
            event.preventDefault();
            setActiveIndex(0);
            return;
          }
          if (event.key === "End" && open) {
            event.preventDefault();
            setActiveIndex(options.length - 1);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) selectOption(options[activeIndex] ?? options[0]); else openMenu();
          }
        }}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? "请选择"}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180 text-accent" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-[60] overflow-hidden rounded-xl border border-ink-900/10 bg-white p-1.5 shadow-[0_18px_44px_rgba(24,32,46,0.16)]">
          <div id={listboxId} role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">
            {options.map((option, index) => {
              const selected = option.value === value;
              const active = index === activeIndex;
              return (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={option.value || "all"}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition-colors ${selected ? "bg-accent/10 font-medium text-accent" : active ? "bg-surface text-ink-900" : "text-ink-700 hover:bg-surface"}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CapabilityBadge({ capability, inferred }: { capability: ModelCapability; inferred: boolean }) {
  return <span title={inferred ? "上游未提供能力元数据，按模型名称推断" : "来自上游模型元数据"} className={`rounded-md border px-1.5 py-0.5 text-[10px] ${capability === "image-generation" ? "border-violet-500/20 bg-violet-50 text-violet-700" : "border-sky-500/15 bg-sky-50 text-sky-700"}`}>{capabilityLabels[capability]}</span>;
}

function StatusBadge({ status }: { status: ModelCatalogEntry["catalogStatus"] }) {
  const meta = statusMeta[status];
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>;
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="mb-6 grid gap-3"><div className="flex items-center gap-2 text-xs font-semibold text-ink-900">{icon}{title}</div>{children}</section>;
}

function ReadOnlyField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><div className="mb-1 text-[11px] text-muted">{label}</div><div className={`break-words text-xs text-ink-800 ${mono ? "font-mono" : ""}`}>{value}</div></div>;
}

function DetailNumberInput({ label, value, min, max, onChange }: { label: string; value?: number; min: number; max?: number; onChange: (value: number | undefined) => void }) {
  return <label className="grid gap-1.5"><span className="text-[11px] text-muted">{label}</span><input type="number" value={value ?? ""} min={min} max={max} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : undefined)} className="h-9 min-w-0 rounded-xl border border-ink-900/10 bg-surface px-3 text-xs text-ink-800 outline-none focus:border-accent" /></label>;
}

function providerLabel(provider: ApiConfigProfile["provider"]): string {
  if (provider === "boke") return "波克网关";
  if (provider === "deepseek") return "DeepSeek";
  if (provider === "codex") return "Codex OAuth";
  if (provider === "minimax") return "MiniMax";
  return "自定义接口";
}

function formatContext(value: number): string {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}
