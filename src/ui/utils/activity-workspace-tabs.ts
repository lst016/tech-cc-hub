export type ActivityRailTab = "trace" | "usage" | "preview" | "git";
export type ActivityWorkspaceTab = "browser" | ActivityRailTab;

export type ActivityWorkspaceTabItem = {
  id: ActivityWorkspaceTab;
  label: string;
  title: string;
  visible: boolean;
  active: boolean;
};

export function buildActivityWorkspaceTabs(input: {
  activeTab: ActivityWorkspaceTab;
  showBrowserTab: boolean;
}): ActivityWorkspaceTabItem[] {
  return [
    {
      id: "preview",
      label: "预览",
      title: "文件预览",
      visible: true,
      active: input.activeTab === "preview",
    },
    {
      id: "trace",
      label: "执行轨迹",
      title: "执行轨迹",
      visible: true,
      active: input.activeTab === "trace",
    },
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
    {
      id: "browser",
      label: "浏览器",
      title: "浏览器",
      visible: input.showBrowserTab,
      active: input.activeTab === "browser",
    },
  ];
}

export function shouldShowCreateBrowserTab(showBrowserTab: boolean): boolean {
  return !showBrowserTab;
}
