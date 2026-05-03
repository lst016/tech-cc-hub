// Source: CV from skills-manager App.tsx routing + Dashboard/MySkills/InstallSkills/Settings views
// Adapted for tech-cc-hub: tabs instead of router, Electron IPC instead of Tauri API, Chinese hardcoded
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Layers,
  Download,
  Settings2,
} from "lucide-react";
import type { ManagedSkill, Scenario, ToolInfo, ScanResult } from "../../types";
import { SkillDashboard } from "./SkillDashboard";
import { MySkillsView } from "./MySkillsView";
import { InstallSkillsView } from "./InstallSkillsView";
import { ToolSettingsView } from "./ToolSettingsView";
import { cn } from "./skill-utils";

type SkillTab = "dashboard" | "my-skills" | "install" | "tools";

export function SkillsManagementPage() {
  const [activeTab, setActiveTab] = useState<SkillTab>("dashboard");
  const [skills, setSkills] = useState<ManagedSkill[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);

  const invoke = useCallback(
    <T,>(channel: string, ...args: unknown[]): Promise<T> =>
      (window.electron as typeof window.electron & { invoke: (c: string, ...a: unknown[]) => Promise<T> }).invoke(channel, ...args),
    [],
  );

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsData, scenariosData, toolsData, scanData] = await Promise.all([
        invoke<ManagedSkill[]>("skills:getManagedSkills").catch(() => [] as ManagedSkill[]),
        invoke<Scenario[]>("skills:getScenarios").catch(() => [] as Scenario[]),
        invoke<ToolInfo[]>("skills:getTools").catch(() => [] as ToolInfo[]),
        invoke<ScanResult>("skills:scanLocalSkills").catch(() => null),
      ]);
      setSkills(skillsData);
      setScenarios(scenariosData);
      setTools(toolsData);
      setScanResult(scanData);
    } catch (error) {
      console.error("Failed to fetch skills data:", error);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const tabs = useMemo(() => [
    { id: "dashboard" as const, label: "概览", icon: LayoutDashboard },
    { id: "my-skills" as const, label: "我的技能", icon: Layers, count: skills.length },
    { id: "install" as const, label: "发现安装", icon: Download },
    { id: "tools" as const, label: "工具配置", icon: Settings2, count: tools.filter((t) => t.installed).length },
  ], [skills.length, tools]);

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-[#E5E6EB] px-1 pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors outline-none",
                active
                  ? "border-accent text-accent"
                  : "border-transparent text-[#86909C] hover:text-[#4E5969]",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none",
                  active ? "bg-accent/10 text-accent" : "bg-[#F2F3F5] text-[#86909C]",
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : activeTab === "dashboard" ? (
          <SkillDashboard
            skills={skills}
            scenarios={scenarios}
            tools={tools}
            scanResult={scanResult}
            onNavigate={setActiveTab}
            onRefresh={fetchAll}
          />
        ) : activeTab === "my-skills" ? (
          <MySkillsView
            skills={skills}
            scenarios={scenarios}
            tools={tools}
            onRefresh={fetchAll}
          />
        ) : activeTab === "install" ? (
          <InstallSkillsView
            skills={skills}
            tools={tools}
            scanResult={scanResult}
            onRefresh={fetchAll}
            onScanResult={setScanResult}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        ) : (
          <ToolSettingsView
            tools={tools}
            scenarios={scenarios}
            onRefresh={fetchAll}
          />
        )}
      </div>
    </div>
  );
}
