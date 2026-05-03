// Source: CV from skills-manager components/SyncDots.tsx
import type { ManagedSkill, ToolInfo } from "../../types";
import { cn } from "./skill-utils";

function shortLabel(displayName: string, key: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  const word = words[0] || key;
  return word.slice(0, 2).toUpperCase();
}

type DotState = "synced" | "available" | "orphan";

interface Dot {
  key: string;
  displayName: string;
  state: DotState;
}

interface Props {
  skill: ManagedSkill;
  tools: ToolInfo[];
  limit?: number;
  size?: "sm" | "md";
  className?: string;
}

export function SyncDots({ skill, tools, limit, size = "md", className }: Props) {
  const installed = tools.filter((t) => t.installed);
  const installedKeys = new Set(installed.map((t) => t.key));
  const syncedKeys = new Set(skill.targets.map((t) => t.tool));

  const dots: Dot[] = installed.map((tool) => ({
    key: tool.key,
    displayName: tool.display_name,
    state: syncedKeys.has(tool.key) ? "synced" : "available",
  }));

  for (const target of skill.targets) {
    if (installedKeys.has(target.tool)) continue;
    const known = tools.find((t) => t.key === target.tool);
    dots.push({
      key: target.tool,
      displayName: known?.display_name || target.tool,
      state: "orphan",
    });
  }

  const visible = typeof limit === "number" ? dots.slice(0, limit) : dots;
  const hiddenCount = dots.length - visible.length;

  const dim = size === "sm"
    ? "h-[16px] w-[16px] text-[8px]"
    : "h-[18px] w-[18px] text-[9px]";

  const stateClass: Record<DotState, string> = {
    synced: "border-transparent bg-[#1D2129] text-white",
    available: "border-[#E5E6EB] bg-[#F2F3F5] text-[#C9CDD4]",
    orphan: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  };

  const stateTitle: Record<DotState, string> = {
    synced: " · 已同步",
    available: "",
    orphan: " · 已同步 · 工具不可用",
  };

  return (
    <div className={cn("flex items-center gap-[2px]", className)}>
      {visible.map((dot) => (
        <span
          key={dot.key}
          title={`${dot.displayName}${stateTitle[dot.state]}`}
          className={cn(
            "inline-flex select-none items-center justify-center rounded-[4px] border font-mono font-semibold tracking-tight transition-colors",
            dim,
            stateClass[dot.state],
          )}
        >
          {shortLabel(dot.displayName, dot.key)}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span
          title={`+${hiddenCount} 个工具`}
          className={cn(
            "inline-flex select-none items-center justify-center rounded-[4px] border border-[#E5E6EB] bg-[#F2F3F5] font-mono font-semibold text-[#C9CDD4]",
            dim,
          )}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}
