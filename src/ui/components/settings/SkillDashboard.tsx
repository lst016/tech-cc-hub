// Source: CV from skills-manager views/Dashboard.tsx
// Adapted: Tauri API → Electron IPC props, react-router → onNavigate callback, i18n → Chinese
import { useState, useEffect } from "react";
import { Layers, CheckCircle2, Bot, Plus, Download } from "lucide-react";
import type { ManagedSkill, Scenario, ToolInfo, ScanResult } from "../../types";
import { getScenarioIconOption } from "./skill-icons";

interface Props {
  skills: ManagedSkill[];
  scenarios: Scenario[];
  tools: ToolInfo[];
  scanResult: ScanResult | null;
  onNavigate: (tab: "my-skills" | "install") => void;
  onRefresh: () => void;
}

export function SkillDashboard({ skills, scenarios, tools, onNavigate }: Props) {
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? scenarios[0] ?? null;
  const scenarioSkills = activeScenario
    ? skills.filter((s) => s.scenario_ids.includes(activeScenario.id))
    : skills;

  const installed = tools.filter((t) => t.installed).length;
  const total = tools.length;
  const synced = scenarioSkills.filter((s) => s.targets.length > 0).length;

  const scenarioIcon = getScenarioIconOption(activeScenario);
  const ScenarioIcon = scenarioIcon.icon;

  useEffect(() => {
    if (!activeScenarioId && scenarios.length > 0) {
      setActiveScenarioId(scenarios[0].id);
    }
  }, [activeScenarioId, scenarios]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[#1D2129]">技能中心</h1>
        <p className="mt-1 flex items-center gap-2 text-[13px] text-[#86909C]">
          当前场景：
          {activeScenario ? (
            <>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium ${scenarioIcon.activeClass} ${scenarioIcon.colorClass}`}>
                <ScenarioIcon className="h-3 w-3" />
                {activeScenario.name}
              </span>
              <span className="text-[#C9CDD4]">·</span>
            </>
          ) : null}
          <span>{scenarioSkills.length} 个技能</span>
        </p>
      </div>

      {/* Scenario switcher */}
      {scenarios.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {scenarios.map((s) => {
            const icon = getScenarioIconOption(s);
            const Icon = icon.icon;
            const active = s.id === activeScenario?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveScenarioId(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  active
                    ? `${icon.activeClass} ${icon.colorClass}`
                    : "border-transparent bg-[#F2F3F5] text-[#86909C] hover:bg-[#E5E6EB]"
                }`}
              >
                <Icon className="h-3 w-3" />
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3.5">
        {[
          { title: "场景技能", value: String(scenarioSkills.length), icon: Layers, color: "text-accent", bg: "bg-accent/8" },
          { title: "已同步", value: String(synced), icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/8" },
          { title: "支持工具", value: `${installed}/${total}`, icon: Bot, color: "text-amber-500", bg: "bg-amber-500/8" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="rounded-xl border border-[#E5E6EB] bg-white flex items-center justify-between px-4 py-4 transition-colors hover:border-[#C9CDD4]">
              <div>
                <p className="text-[11px] font-medium text-[#86909C] mb-1">{stat.title}</p>
                <h3 className="text-xl font-semibold text-[#1D2129] leading-none">{stat.value}</h3>
              </div>
              <div className={`p-2 rounded-md ${stat.bg} ${stat.color} border border-[#E5E6EB]`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onNavigate("install")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-medium text-white shadow-soft transition-colors hover:bg-accent-hover"
        >
          <Download className="w-4 h-4" />
          扫描导入
        </button>
        <button
          type="button"
          onClick={() => onNavigate("install")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E5E6EB] bg-white px-4 py-2.5 text-[13px] font-medium text-[#4E5969] transition-colors hover:bg-[#F5F6F8]"
        >
          <Plus className="w-4 h-4 text-[#86909C]" />
          安装新技能
        </button>
      </div>

      {/* Recent skills */}
      {scenarioSkills.length > 0 && (
        <div>
          <h2 className="text-[11px] font-medium text-[#86909C] mb-2.5">最近技能</h2>
          <div className="rounded-xl border border-[#E5E6EB] bg-white overflow-hidden divide-y divide-[#F2F3F5]">
            {scenarioSkills.slice(0, 5).map((skill) => (
              <div
                key={skill.id}
                role="button"
                tabIndex={0}
                onClick={() => onNavigate("my-skills")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onNavigate("my-skills");
                }}
                className="flex items-center justify-between px-3.5 py-2.5 hover:bg-[#F5F6F8] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-[4px] flex items-center justify-center text-[13px] font-semibold bg-accent/8 text-accent shrink-0">
                    {skill.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-[13px] text-[#1D2129] font-medium flex items-center gap-1.5">
                      {skill.name}
                      <span className="text-[9px] px-1.5 py-px rounded bg-[#F2F3F5] text-[#86909C] border border-[#E5E6EB] font-normal">
                        {skill.source_type}
                      </span>
                    </h4>
                    <p className="text-[13px] text-[#86909C] mt-px">
                      {skill.targets.length > 0
                        ? `已同步 → ${skill.targets.map((t) => t.tool).join(", ")}`
                        : "未同步"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
