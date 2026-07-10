import { useEffect, useMemo, useRef, useState, type WheelEvent } from "react";
import { Bot, Plus, Terminal, X } from "lucide-react";
import type { WorkspacePluginDescriptor } from "../../shared/workspace-plugins";
import {
  buildActivityWorkspaceCreateOptions,
  buildActivityWorkspaceTabs,
  shouldShowCreateGitTab,
  shouldShowCreateTerminalTab,
  type ActivityOptionalWorkspaceTab,
  type ActivityWorkspaceTab,
  type WorkflowAgentRailTab,
  type WorkflowAgentWorkspaceTabItem,
} from "../utils/activity-workspace-tabs";

type ActivityWorkspaceTabsProps = {
  activeTab: ActivityWorkspaceTab;
  showBrowserTab: boolean;
  showGitTab?: boolean;
  showTerminalTab?: boolean;
  workspacePlugins?: WorkspacePluginDescriptor[];
  workflowAgentTabs?: WorkflowAgentWorkspaceTabItem[];
  showLabels?: boolean;
  browserLabel?: string;
  showCreateGitTab?: boolean;
  showCreateTerminalTab?: boolean;
  onSelectTab: (tab: ActivityWorkspaceTab) => void;
  onCloseBrowserTab?: () => void;
  onCloseGitTab?: () => void;
  onCreateGitTab?: () => void;
  onCloseTerminalTab?: () => void;
  onCreateTerminalTab?: () => void;
  onCloseWorkflowAgentTab?: (tab: WorkflowAgentRailTab) => void;
};

function iconForTab(tab: ActivityWorkspaceTab | ActivityOptionalWorkspaceTab) {
  if (tab === "browser") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
      </svg>
    );
  }

  if (tab === "terminal") {
    return <Terminal className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }

  if (tab.startsWith("workflow-agent:")) {
    return <Bot className="h-4 w-4 shrink-0" aria-hidden="true" />;
  }

  if (tab === "trace") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M5 5h14M5 12h10M5 19h7" />
      </svg>
    );
  }

  if (tab === "usage") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M4 18V6M9 18v-7M14 18V9M19 18V4" />
      </svg>
    );
  }

  if (tab === "git") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="6" cy="6" r="2.25" />
        <circle cx="18" cy="18" r="2.25" />
        <circle cx="18" cy="6" r="2.25" />
        <path d="M8 6h8M8 7.4c4.4 1.6 7 4.1 8.5 8.3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3.5h7l3 3V20.5H7z" />
      <path d="M14 3.5V7h3M9.5 12h5M9.5 15.5h5" />
    </svg>
  );
}

function tabClassName(active: boolean) {
  return `group relative inline-flex h-8 max-w-[190px] shrink-0 items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition ${
    active
      ? "bg-ink-900/7 text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]"
      : "text-muted hover:bg-ink-900/5 hover:text-ink-700"
  }`;
}

export function ActivityWorkspaceTabs({
  activeTab,
  showBrowserTab,
  showGitTab = false,
  showTerminalTab = false,
  workspacePlugins = [],
  workflowAgentTabs = [],
  showLabels = true,
  browserLabel = "浏览器",
  showCreateGitTab,
  showCreateTerminalTab,
  onSelectTab,
  onCloseBrowserTab,
  onCloseGitTab,
  onCreateGitTab,
  onCloseTerminalTab,
  onCreateTerminalTab,
  onCloseWorkflowAgentTab,
}: ActivityWorkspaceTabsProps) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const tabsScrollerRef = useRef<HTMLDivElement>(null);
  const tabs = buildActivityWorkspaceTabs({ activeTab, showBrowserTab, showGitTab, showTerminalTab, workspacePlugins, workflowAgentTabs }).filter((tab) => tab.visible);
  const createOptions = useMemo(
    () => buildActivityWorkspaceCreateOptions({
      canCreateBrowserTab: false,
      canCreateGitTab: Boolean(onCreateGitTab) && (showCreateGitTab ?? shouldShowCreateGitTab(showGitTab)),
      canCreateTerminalTab: Boolean(onCreateTerminalTab) && (showCreateTerminalTab ?? shouldShowCreateTerminalTab(showTerminalTab)),
    }),
    [
      onCreateGitTab,
      onCreateTerminalTab,
      showCreateGitTab,
      showCreateTerminalTab,
      showGitTab,
      showTerminalTab,
    ],
  );

  useEffect(() => {
    if (!createMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && createMenuRef.current?.contains(event.target)) return;
      setCreateMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreateMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [createMenuOpen]);

  const handleCreateOption = (id: ActivityOptionalWorkspaceTab) => {
    setCreateMenuOpen(false);
    if (id === "git") {
      onCreateGitTab?.();
      return;
    }
    if (id === "terminal") {
      onCreateTerminalTab?.();
    }
  };

  const handleTabsWheel = (event: WheelEvent<HTMLDivElement>) => {
    const scroller = tabsScrollerRef.current;
    if (!scroller) return;
    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    if (maxScrollLeft <= 0) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    event.preventDefault();
    scroller.scrollLeft += delta;
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <div
        ref={tabsScrollerRef}
        onWheel={handleTabsWheel}
        className="activity-workspace-tabs-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden pr-1"
      >
        {tabs.map((tab) => {
          const label = tab.id === "browser" ? browserLabel : tab.label;
          const isWorkflowAgentTab = tab.id.startsWith("workflow-agent:");
          const labelWidthClass = tab.id === "browser"
            ? "max-w-[120px]"
            : isWorkflowAgentTab ? "max-w-[112px]" : "max-w-[160px]";
          const closeHandler = tab.id === "browser"
            ? onCloseBrowserTab
            : tab.id === "git"
              ? onCloseGitTab
            : tab.id === "terminal"
              ? onCloseTerminalTab
              : isWorkflowAgentTab
                ? () => onCloseWorkflowAgentTab?.(tab.id as WorkflowAgentRailTab)
                : undefined;

          return (
            <div key={tab.id} className={tabClassName(tab.active)} title={tab.title}>
              <button
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className="inline-flex h-full min-w-0 items-center gap-2"
              >
                {iconForTab(tab.id)}
                <span className={`${showLabels ? labelWidthClass : "hidden"} truncate`}>{label}</span>
              </button>
              {closeHandler && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    closeHandler();
                  }}
                  className={`h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink-900/10 bg-white text-ink-700 shadow-sm transition hover:border-ink-900/20 hover:bg-ink-900/8 hover:text-ink-950 ${isWorkflowAgentTab ? "inline-flex" : "hidden group-hover:inline-flex"}`}
                  title={`关闭${label}标签`}
                  aria-label={`关闭${label}标签`}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {createOptions.length > 0 && (
        <div ref={createMenuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setCreateMenuOpen((current) => !current)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
            title="添加工作区标签"
            aria-label="添加工作区标签"
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          {createMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-9 z-[220] min-w-[132px] overflow-hidden rounded-2xl border border-black/10 bg-white/95 p-1.5 text-sm text-ink-800 shadow-[0_18px_44px_rgba(15,23,42,0.16)] backdrop-blur-xl"
            >
              {createOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleCreateOption(option.id)}
                  className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left transition hover:bg-ink-900/5"
                  title={option.title}
                >
                  {iconForTab(option.id)}
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
