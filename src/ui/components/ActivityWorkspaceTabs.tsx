import {
  buildActivityWorkspaceTabs,
  shouldShowCreateBrowserTab,
  type ActivityWorkspaceTab,
} from "../utils/activity-workspace-tabs";

type ActivityWorkspaceTabsProps = {
  activeTab: ActivityWorkspaceTab;
  showBrowserTab: boolean;
  showLabels?: boolean;
  browserLabel?: string;
  showCreateBrowserTab?: boolean;
  onSelectTab: (tab: ActivityWorkspaceTab) => void;
  onCloseBrowserTab?: () => void;
  onCreateBrowserTab?: () => void;
};

function iconForTab(tab: ActivityWorkspaceTab) {
  if (tab === "browser") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.2 2.3 3.2 5.1 3.2 8.5s-1 6.2-3.2 8.5M12 3.5C9.8 5.8 8.8 8.6 8.8 12s1 6.2 3.2 8.5" />
      </svg>
    );
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
  return `group inline-flex h-8 max-w-[190px] items-center gap-2 rounded-xl px-3 text-[13px] font-medium transition ${
    active
      ? "bg-ink-900/7 text-ink-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]"
      : "text-muted hover:bg-ink-900/5 hover:text-ink-700"
  }`;
}

export function ActivityWorkspaceTabs({
  activeTab,
  showBrowserTab,
  showLabels = true,
  browserLabel = "浏览器",
  showCreateBrowserTab,
  onSelectTab,
  onCloseBrowserTab,
  onCreateBrowserTab,
}: ActivityWorkspaceTabsProps) {
  const tabs = buildActivityWorkspaceTabs({ activeTab, showBrowserTab }).filter((tab) => tab.visible);
  const shouldShowCreate = showCreateBrowserTab ?? shouldShowCreateBrowserTab(showBrowserTab);

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {tabs.map((tab) => {
        const label = tab.id === "browser" ? browserLabel : tab.label;
        const labelWidthClass = tab.id === "browser" ? "max-w-[120px]" : "max-w-[160px]";

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
            {tab.id === "browser" && onCloseBrowserTab && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCloseBrowserTab();
                }}
                className="ml-1 hidden h-4 w-4 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-900/10 hover:text-ink-900 group-hover:inline-flex"
                title="关闭浏览器标签"
                aria-label="关闭浏览器标签"
              >
                x
              </button>
            )}
          </div>
        );
      })}
      {shouldShowCreate && (
        <button
          type="button"
          onClick={onCreateBrowserTab}
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted transition hover:bg-ink-900/5 hover:text-ink-700"
          title="新建本地浏览器页"
          aria-label="新建本地浏览器页"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  );
}
