import { useMemo, useState } from "react";
import { Cable, ListFilter, Route } from "lucide-react";
import type { DevElectronRuntimeSource } from "../../dev-electron-shim";
import type { ApiConfigProfile } from "../../types";
import { ApiProfilesSettingsPage } from "./ApiProfilesSettingsPage";
import { ModelCatalogSettingsPage } from "./ModelCatalogSettingsPage";
import { ModelRoutingSettingsPage } from "./ModelRoutingSettingsPage";
import { buildModelCatalogEntries } from "./model-catalog-utils";

type AiInterfaceSettingsPageProps = {
  profiles: ApiConfigProfile[];
  runtimeSource: DevElectronRuntimeSource;
  onChange: (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => void;
};

type AiInterfaceTab = "connections" | "catalog" | "routing";

const tabs: Array<{ id: AiInterfaceTab; label: string; icon: typeof Cable }> = [
  { id: "connections", label: "接口连接", icon: Cable },
  { id: "catalog", label: "模型目录", icon: ListFilter },
  { id: "routing", label: "路由策略", icon: Route },
];

export function AiInterfaceSettingsPage({ profiles, runtimeSource, onChange }: AiInterfaceSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<AiInterfaceTab>("connections");
  const catalogEntries = useMemo(() => buildModelCatalogEntries(profiles), [profiles]);
  const managedCount = catalogEntries.filter((entry) => entry.managed).length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="mb-5 shrink-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink-900">AI 接口</h1>
            <p className="mt-1 text-sm leading-6 text-muted">管理 AI 服务连接、网关实际发现的模型，以及全局模型分工与路由优先级。</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted">
            <span className="rounded-lg border border-ink-900/8 bg-white/70 px-2.5 py-1.5">
              <strong className="mr-1 font-semibold text-ink-900">{profiles.filter((profile) => profile.enabled).length}</strong>连接启用
            </span>
            <span className="rounded-lg border border-ink-900/8 bg-white/70 px-2.5 py-1.5">
              <strong className="mr-1 font-semibold text-ink-900">{catalogEntries.length}</strong>模型部署
            </span>
            <span className="rounded-lg border border-emerald-500/15 bg-emerald-50/70 px-2.5 py-1.5 text-emerald-700">
              <strong className="mr-1 font-semibold">{managedCount}</strong>已纳管
            </span>
          </div>
        </div>
        <div className="mt-4 flex min-h-11 items-end gap-8 border-b border-ink-900/10" role="tablist" aria-label="AI 接口设置">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={`relative inline-flex h-11 items-center gap-2 px-1 text-sm font-medium transition-colors ${active ? "text-accent" : "text-muted hover:text-ink-800"}`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {active && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 min-w-0 flex-1" role="tabpanel">
        {activeTab === "connections" && (
          <ApiProfilesSettingsPage profiles={profiles} runtimeSource={runtimeSource} onChange={onChange} />
        )}
        {activeTab === "catalog" && (
          <ModelCatalogSettingsPage profiles={profiles} onChange={onChange} />
        )}
        {activeTab === "routing" && (
          <ModelRoutingSettingsPage profiles={profiles} onChange={onChange} />
        )}
      </div>
    </div>
  );
}
