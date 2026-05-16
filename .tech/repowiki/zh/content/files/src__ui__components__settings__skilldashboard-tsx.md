# src/ui/components/settings/SkillDashboard.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：168

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `SkillDashboard@16`
- `activeScenario@19`
- `scenarioSkills@21`
- `installed@24`
- `total@26`
- `synced@27`
- `scenarioIcon@28`
- `ScenarioIcon@30`
- `icon@62`
- `Icon@63`
- `active@64`
- `Icon@91`
- `Props@7`
- `onNavigate@13`
- `onRefresh@14`

## 依赖输入

- `react`
- `lucide-react`
- `../../types`
- `./skill-icons`

## 对外暴露

- `SkillDashboard`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
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
                <Icon className="w-
... (truncated)
```
