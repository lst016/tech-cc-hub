export type WorkflowAgentRailTab = `workflow-agent:${string}`;
export type ActivityRailTab = "trace" | "usage" | "preview" | "git" | "terminal" | WorkflowAgentRailTab;
export type ActivityWorkspaceTab = "browser" | ActivityRailTab;
export type ActivityOptionalWorkspaceTab = "browser" | "terminal";

export const DEFAULT_ACTIVITY_RAIL_TAB: ActivityRailTab = "usage";

export type ActivityWorkspaceTabItem = {
  id: ActivityWorkspaceTab;
  label: string;
  title: string;
  visible: boolean;
  active: boolean;
};

export type WorkflowAgentWorkspaceTabItem = {
  id: WorkflowAgentRailTab;
  label: string;
  title: string;
};

export type ActivityWorkspaceCreateOption = {
  id: ActivityOptionalWorkspaceTab;
  label: string;
  title: string;
};

export function buildActivityWorkspaceTabs(input: {
  activeTab: ActivityWorkspaceTab;
  showBrowserTab: boolean;
  showTerminalTab?: boolean;
  workflowAgentTabs?: WorkflowAgentWorkspaceTabItem[];
}): ActivityWorkspaceTabItem[] {
  const workflowAgentTabs = (input.workflowAgentTabs ?? []).map((tab) => ({
    ...tab,
    visible: true,
    active: input.activeTab === tab.id,
  }));

  return [
    {
      id: "preview",
      label: "预览",
      title: "文件预览",
      visible: true,
      active: input.activeTab === "preview",
    },
    /*
    Trace rail is deprecated; keep the implementation dormant until the
    replacement path fully lands.
    {
      id: "trace",
      label: "执行轨迹",
      title: "执行轨迹",
      visible: true,
      active: input.activeTab === "trace",
    },
    */
    {
      id: "usage",
      label: "Usage",
      title: "Usage",
      visible: true,
      active: input.activeTab === "usage",
    },
    {
      id: "git",
      label: "Git",
      title: "Git 工作台",
      visible: true,
      active: input.activeTab === "git",
    },
    ...workflowAgentTabs,
    {
      id: "terminal",
      label: "终端",
      title: "终端",
      visible: input.showTerminalTab === true,
      active: input.activeTab === "terminal",
    },
    {
      id: "browser",
      label: "浏览器",
      title: "浏览器",
      visible: input.showBrowserTab,
      active: input.activeTab === "browser",
    },
  ];
}

export function buildActivityWorkspaceCreateOptions(input: {
  canCreateBrowserTab: boolean;
  canCreateTerminalTab: boolean;
}): ActivityWorkspaceCreateOption[] {
  return [
    input.canCreateTerminalTab
      ? {
          id: "terminal",
          label: "终端",
          title: "打开终端",
        }
      : null,
    input.canCreateBrowserTab
      ? {
          id: "browser",
          label: "浏览器",
          title: "打开浏览器",
        }
      : null,
  ].filter((option): option is ActivityWorkspaceCreateOption => Boolean(option));
}

export function shouldShowCreateBrowserTab(showBrowserTab: boolean): boolean {
  return !showBrowserTab;
}

export function shouldShowCreateTerminalTab(showTerminalTab: boolean): boolean {
  return !showTerminalTab;
}
