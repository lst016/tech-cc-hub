import { getWorkspacePluginTabId, type WorkspacePluginDescriptor } from "../../shared/workspace-plugins.js";

export type WorkflowAgentRailTab = `workflow-agent:${string}`;
export type PluginRailTab = `plugin:${string}`;
export type ActivityRailTab = "trace" | "usage" | "preview" | "git" | "terminal" | WorkflowAgentRailTab | PluginRailTab;
export type ActivityWorkspaceTab = "browser" | ActivityRailTab;
export type ActivityOptionalWorkspaceTab = "git" | "terminal" | PluginRailTab;

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

export type WorkflowAgentWorkspaceTabSource = {
  id: string;
  title: string;
};

export type ActivityWorkspaceCreateOption = {
  id: ActivityOptionalWorkspaceTab;
  label: string;
  title: string;
};

export function normalizeActivityRailTab(tab: string | undefined): ActivityRailTab {
  if (!tab || tab === "trace" || tab === "workflow") return DEFAULT_ACTIVITY_RAIL_TAB;
  return tab as ActivityRailTab;
}

export function shouldBuildActivityRailModel(
  selectedTab: ActivityRailTab,
  suspended: boolean,
): boolean {
  return selectedTab === "usage" && !suspended;
}

export function getWorkflowAgentTabId(agentId: string): WorkflowAgentRailTab {
  return `workflow-agent:${agentId}`;
}

export function getWorkflowAgentIdFromTab(tab: string | undefined): string | null {
  return tab?.startsWith("workflow-agent:") ? tab.slice("workflow-agent:".length) : null;
}

export { getWorkspacePluginTabId };

export function getWorkspacePluginIdFromTab(tab: string | undefined): string | null {
  if (!tab?.startsWith("plugin:")) return null;
  const id = tab.slice("plugin:".length);
  return /^[a-z][a-z0-9-]{1,63}$/.test(id) ? id : null;
}

export function getActivityRailTabAfterClosingWorkflowAgent(input: {
  activeTab: string | undefined;
  closingTab: WorkflowAgentRailTab;
  openAgentIds: string[];
}): ActivityRailTab {
  const closingAgentId = getWorkflowAgentIdFromTab(input.closingTab);
  const nextOpenAgentIds = closingAgentId
    ? input.openAgentIds.filter((id) => id !== closingAgentId)
    : input.openAgentIds;

  if (input.activeTab !== input.closingTab) {
    return normalizeActivityRailTab(input.activeTab);
  }

  const fallbackAgentId = nextOpenAgentIds[nextOpenAgentIds.length - 1];
  return fallbackAgentId ? getWorkflowAgentTabId(fallbackAgentId) : DEFAULT_ACTIVITY_RAIL_TAB;
}

export function buildWorkflowAgentWorkspaceTabs(input: {
  openAgentIds: string[];
  agents: WorkflowAgentWorkspaceTabSource[];
}): WorkflowAgentWorkspaceTabItem[] {
  const agentsById = new Map(input.agents.map((agent) => [agent.id, agent]));
  return input.openAgentIds
    .map((agentId) => agentsById.get(agentId))
    .filter((agent): agent is WorkflowAgentWorkspaceTabSource => Boolean(agent))
    .map((agent) => ({
      id: getWorkflowAgentTabId(agent.id),
      label: agent.title,
      title: agent.title,
    }));
}

export function buildActivityWorkspaceTabs(input: {
  activeTab: ActivityWorkspaceTab;
  showBrowserTab: boolean;
  showGitTab?: boolean;
  showTerminalTab?: boolean;
  workspacePlugins?: WorkspacePluginDescriptor[];
  workflowAgentTabs?: WorkflowAgentWorkspaceTabItem[];
}): ActivityWorkspaceTabItem[] {
  const workflowAgentTabs = (input.workflowAgentTabs ?? []).map((tab) => ({
    ...tab,
    visible: true,
    active: input.activeTab === tab.id,
  }));
  const workspacePluginTabs = (input.workspacePlugins ?? []).map((plugin) => ({
    id: getWorkspacePluginTabId(plugin.id),
    label: plugin.label,
    title: plugin.label,
    visible: true,
    active: input.activeTab === getWorkspacePluginTabId(plugin.id),
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
      visible: input.showGitTab === true,
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
    ...workspacePluginTabs,
    {
      id: "browser",
      label: "浏览器",
      title: "浏览器",
      visible: true,
      active: input.activeTab === "browser",
    },
  ];
}

export function buildActivityWorkspaceCreateOptions(input: {
  canCreateBrowserTab: boolean;
  canCreateGitTab?: boolean;
  canCreateTerminalTab: boolean;
  workspacePlugins?: WorkspacePluginDescriptor[];
}): ActivityWorkspaceCreateOption[] {
  return [
    input.canCreateGitTab
      ? {
          id: "git",
          label: "Git",
          title: "Open Git workspace",
        }
      : null,
    input.canCreateTerminalTab
      ? {
          id: "terminal",
          label: "终端",
          title: "打开终端",
        }
      : null,
    ...(input.workspacePlugins ?? []).map((plugin) => ({
      id: getWorkspacePluginTabId(plugin.id),
      label: plugin.label,
      title: `Open ${plugin.label}`,
    })),
  ].filter((option): option is ActivityWorkspaceCreateOption => Boolean(option));
}

export function shouldShowCreateBrowserTab(_showBrowserTab: boolean): boolean {
  void _showBrowserTab;
  return false;
}

export function shouldShowCreateGitTab(showGitTab: boolean): boolean {
  return !showGitTab;
}

export function shouldShowCreateTerminalTab(showTerminalTab: boolean): boolean {
  return !showTerminalTab;
}
