import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEV_BRIDGE_READY_EVENT,
  getDevElectronRuntimeSource,
  type DevElectronRuntimeSource,
} from "../dev-electron-shim";

import { useAppStore } from "../store/useAppStore";
import type {
  ApiConfigProfile,
  AgentRuleDocuments,
  SettingsPageId,
  SkillInventory,
  SkillSyncRequest,
  SkillSyncResult,
} from "../types";
import { ApiProfilesSettingsPage } from "./settings/ApiProfilesSettingsPage";
import { AgentRulesSettingsPage } from "./settings/AgentRulesSettingsPage";
import { GlobalJsonSettingsPage } from "./settings/GlobalJsonSettingsPage";
import { ModelRoutingSettingsPage } from "./settings/ModelRoutingSettingsPage";
import { SettingsSheet, type SettingsPageDefinition } from "./settings/SettingsSheet";
import { SkillsManagementPage } from "./settings/SkillsManagementPage";
import { SystemMaintenancePage } from "./settings/SystemMaintenancePage";
import {
  buildRoutingSummary,
  createProfile,
  getEnabledProfile,
  normalizeProfile,
  validateProfiles,
} from "./settings/settings-utils";

interface SettingsModalProps {
  onClose: () => void;
  initialPageId?: SettingsPageId;
  onStartMaintenanceSession: (prompt: string) => Promise<void>;
}

type GlobalRuntimeConfig = Record<string, unknown>;

const DEFAULT_SKILL_PATH = "~/.claude/skills";
const DEFAULT_AGENT_RULE_DOCUMENTS: AgentRuleDocuments = {
  systemDefaultMarkdown: [
    "# tech-cc-hub 系统默认规则",
    "",
    "这部分由应用内置生成，只用于展示当前软件默认加载的系统级 Agent 规则，不会写入用户目录。",
    "",
    "## 内置浏览器默认规则",
    "",
    "默认要求：涉及网页查看、抓取、调试、标注、截图的场景，默认优先使用 Electron 内置浏览器工作台（BrowserView）。",
    "",
    "禁止默认走外部 browse skill。请优先用浏览器 MCP（browser_get_state / browser_extract_page / browser_capture_visible ...）。",
  ].join("\n"),
  userClaudeRoot: "~/.claude",
  userAgentsPath: "~/.claude/AGENTS.md",
  userAgentsMarkdown: "",
};

const SETTINGS_PAGES: SettingsPageDefinition[] = [
  {
    id: "profiles",
    label: "接口配置",
    eyebrow: "API",
    title: "接口配置",
    description: "维护 API 网关、密钥和模型池。",
    summary: "网关、密钥、模型池",
  },
  {
    id: "routing",
    label: "模型分工",
    eyebrow: "ROLES",
    title: "模型分工",
    description: "定义默认主模型和角色模型的分工方式。",
    summary: "主模型与角色路由",
  },
  {
    id: "skills",
    label: "Skills",
    eyebrow: "SKILLS",
    title: "已安装 Skills",
    description: "扫描默认目录下已安装的 skills，并维护远程来源信息。",
    summary: "已安装 skills",
  },
  {
    id: "global-json",
    label: "全局配置",
    eyebrow: "RUNTIME",
    title: "全局配置",
    description: "维护通用运行时 JSON 配置，例如 hooks 和执行参数。",
    summary: "JSON 通用配置",
  },
  {
    id: "agent-rules",
    label: "默认规则",
    eyebrow: "RULES",
    title: "默认 Markdown",
    description: "查看系统默认规则，并维护 Claude 全局目录的用户级规则。",
    summary: "系统默认 / Claude 全局",
  },
  {
    id: "system-maintenance",
    label: "系统维护",
    eyebrow: "SYSTEM",
    title: "系统维护",
    description: "启动软件内置维护 Agent，只用于软件自身巡检、治理和版本维护。",
    summary: "内置维护 agent",
  },
];

function getCloseSidebarOnBrowserOpen(config: GlobalRuntimeConfig): boolean {
  return config.closeSidebarOnBrowserOpen !== false;
}

function validateGlobalConfigText(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return "配置必须是合法的 JSON 对象。";
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "JSON 格式不合法。";
  }
}

function parseGlobalConfig(rawText: string): GlobalRuntimeConfig | null {
  const parseError = validateGlobalConfigText(rawText);
  if (parseError) {
    return null;
  }
  if (!rawText.trim()) {
    return {};
  }
  return JSON.parse(rawText) as GlobalRuntimeConfig;
}

export function SettingsModal({
  onClose,
  initialPageId,
  onStartMaintenanceSession,
}: SettingsModalProps) {
  const setApiConfigSettings = useAppStore((state) => state.setApiConfigSettings);
  const [profiles, setProfiles] = useState<ApiConfigProfile[]>([]);
  const [globalConfigText, setGlobalConfigText] = useState("{}");
  const [agentRuleDocuments, setAgentRuleDocuments] = useState<AgentRuleDocuments | null>(null);
  const [userAgentMarkdown, setUserAgentMarkdown] = useState("");
  const [closeSidebarOnBrowserOpen, setCloseSidebarOnBrowserOpen] = useState(true);
  const [activePageId, setActivePageId] = useState<SettingsPageId>("profiles");
  const [skillInventory, setSkillInventory] = useState<SkillInventory>({
    rootPath: DEFAULT_SKILL_PATH,
    skills: [],
  });
  const [syncingSkillIds, setSyncingSkillIds] = useState<Set<string>>(new Set());
  const [syncNotes, setSyncNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runtimeSource, setRuntimeSource] = useState<DevElectronRuntimeSource>(() => getDevElectronRuntimeSource());
  const [status, setStatus] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [globalConfigParseError, setGlobalConfigParseError] = useState<string | null>(null);
  const [maintenancePrompt, setMaintenancePrompt] = useState(
    "请对当前软件执行一次系统维护巡检，重点检查三层 agent 解析、运行面隔离和 skills 治理入口，并输出结论与建议。",
  );
  const [launchingMaintenance, setLaunchingMaintenance] = useState(false);
  const electronApi = window.electron as typeof window.electron & {
    getAgentRuleDocuments?: () => Promise<AgentRuleDocuments>;
    saveUserAgentRuleDocument?: (markdown: string) => Promise<{ success: boolean; error?: string }>;
  };

  const skillCounts = useMemo(() => {
    const tracked = skillInventory.skills.filter((skill) => skill.sourceType === "git").length;
    const bundles = skillInventory.skills.filter((skill) => skill.kind === "bundle").length;
    return {
      total: skillInventory.skills.length,
      tracked,
      bundles,
    };
  }, [skillInventory.skills]);

  useEffect(() => {
    if (initialPageId) {
      setActivePageId(initialPageId);
    }
  }, [initialPageId]);

  const reloadSkillInventory = useCallback(async () => {
    const inventory = await window.electron.getSkillInventory();
    setSkillInventory(inventory);
  }, []);

  const loadSettings = useCallback(() => {
    setLoading(true);
    void Promise.all([
      window.electron.getApiConfig(),
      window.electron.getGlobalConfig(),
      window.electron.getSkillInventory(),
      typeof electronApi.getAgentRuleDocuments === "function"
        ? electronApi.getAgentRuleDocuments()
        : Promise.resolve(DEFAULT_AGENT_RULE_DOCUMENTS),
    ])
      .then(([apiSettings, globalSettings, inventory, ruleDocuments]) => {
        const normalizedGlobalSettings = typeof globalSettings === "object" && globalSettings !== null && !Array.isArray(globalSettings)
          ? globalSettings as GlobalRuntimeConfig
          : {};
        const normalizedProfiles = apiSettings.profiles.length > 0
          ? apiSettings.profiles.map((profile) => normalizeProfile(profile))
          : [createProfile()];
        const hasConfiguredProfile = normalizedProfiles.some((profile) => (
          profile.apiKey.trim().length > 0
          && profile.baseURL.trim().length > 0
          && profile.model.trim().length > 0
        ));

        setApiConfigSettings({ profiles: normalizedProfiles });
        setProfiles(normalizedProfiles);
        setActivePageId(initialPageId ?? (hasConfiguredProfile ? "routing" : "profiles"));
        const globalConfigText = JSON.stringify(normalizedGlobalSettings, null, 2);
        setGlobalConfigText(globalConfigText);
        setGlobalConfigParseError(validateGlobalConfigText(globalConfigText));
        setCloseSidebarOnBrowserOpen(getCloseSidebarOnBrowserOpen(normalizedGlobalSettings));
        setSkillInventory(inventory);
        const normalizedRuleDocuments = ruleDocuments ?? DEFAULT_AGENT_RULE_DOCUMENTS;
        setAgentRuleDocuments(normalizedRuleDocuments);
        setUserAgentMarkdown(normalizedRuleDocuments.userAgentsMarkdown);
        setSyncNotes({});
      })
      .catch((error) => {
        console.error("Failed to load settings:", error);
        setStatus({ tone: "error", message: "加载设置失败。" });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [electronApi, initialPageId, reloadSkillInventory, setApiConfigSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    const handleDevBridgeReady = () => {
      setRuntimeSource(getDevElectronRuntimeSource());
      loadSettings();
    };

    window.addEventListener(DEV_BRIDGE_READY_EVENT, handleDevBridgeReady);
    return () => window.removeEventListener(DEV_BRIDGE_READY_EVENT, handleDevBridgeReady);
  }, [loadSettings]);

  const enabledProfile = useMemo(() => getEnabledProfile(profiles), [profiles]);
  const pages = useMemo(() => SETTINGS_PAGES.map((page) => {
    if (page.id === "profiles") {
      return {
        ...page,
        summary: `共 ${profiles.length} 个配置`,
      };
    }
    if (page.id === "routing") {
      return {
        ...page,
        summary: buildRoutingSummary(enabledProfile),
      };
    }
    if (page.id === "skills") {
      return {
        ...page,
        summary: `${skillCounts.total} 已安装 / ${skillCounts.tracked} Git 跟踪`,
      };
    }
    return page;
  }), [enabledProfile, profiles.length, skillCounts.total, skillCounts.tracked]);

  const updateProfiles = (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => {
    setStatus(null);
    setProfiles((current) => updater(current));
  };

  const handleGlobalConfigChange = (next: string) => {
    setStatus(null);
    setGlobalConfigText(next);
    const parsed = parseGlobalConfig(next);
    setGlobalConfigParseError(validateGlobalConfigText(next));
    if (parsed !== null) {
      setCloseSidebarOnBrowserOpen(getCloseSidebarOnBrowserOpen(parsed));
    }
  };

  const handleUserAgentMarkdownChange = (next: string) => {
    setStatus(null);
    setUserAgentMarkdown(next);
  };

  const handleCloseSidebarOnBrowserOpenChange = useCallback((next: boolean) => {
    const parseError = validateGlobalConfigText(globalConfigText);
    if (parseError) {
      setGlobalConfigParseError(parseError);
      return;
    }
    const parsed = parseGlobalConfig(globalConfigText) ?? {};
    const nextConfig = {
      ...parsed,
      closeSidebarOnBrowserOpen: next,
    };
    const nextText = JSON.stringify(nextConfig, null, 2);
    setCloseSidebarOnBrowserOpen(next);
    setGlobalConfigText(nextText);
    setGlobalConfigParseError(null);
  }, [globalConfigText]);

  const formatSyncMessage = useCallback((result: SkillSyncResult) => {
    const baseMessage = result.message?.trim() || "";
    if (result.status === "updated" && result.previousCommit && result.latestCommit) {
      return `${result.previousCommit.slice(0, 7)} -> ${result.latestCommit.slice(0, 7)} ${baseMessage}`.trim();
    }
    return baseMessage || "无变化";
  }, []);

  const syncSkillSources = useCallback(async (request: SkillSyncRequest) => {
    const targetIds = request.skillIds ?? skillInventory.skills
      .filter((skill) => skill.sourceType === "git")
      .map((skill) => skill.id);

    setSyncingSkillIds(new Set(targetIds));
    setStatus(null);
    setSyncNotes((current) => {
      const next = { ...current };
      for (const skillId of targetIds) {
        delete next[skillId];
      }
      return next;
    });

    try {
      const response = await window.electron.syncSkillSources({
        ...request,
        skillIds: targetIds,
      });
      const nextNotes: Record<string, string> = {};
      for (const result of response.results) {
        nextNotes[result.skillId] = formatSyncMessage(result);
      }
      if (response.results.length > 0) {
        setSyncNotes((current) => ({ ...current, ...nextNotes }));
      }

      await reloadSkillInventory();

      if (response.results.some((item) => item.status === "error")) {
        const failCount = response.results.filter((item) => item.status === "error").length;
        setStatus({
          tone: "error",
          message: `Skills 同步完成，但有 ${failCount} 条记录失败，请检查对应行。`,
        });
      }
    } catch (error) {
      console.error("Failed to sync skills:", error);
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "同步 Skills 失败。",
      });
    } finally {
      setSyncingSkillIds(new Set());
    }
  }, [formatSyncMessage, reloadSkillInventory, skillInventory.skills]);

  const validateSkillInventory = useCallback((inventory: SkillInventory) => {
    if (!inventory.rootPath.trim()) {
      return "默认 Skill 目录不能为空。";
    }

    for (const skill of inventory.skills) {
      if (!skill.path.trim()) {
        return `Skill ${skill.name || skill.id} 缺少本地路径。`;
      }
      if (skill.sourceType === "git" && !skill.remoteUrl?.trim()) {
        return `Skill ${skill.name || skill.id} 缺少远程 Git 地址。`;
      }
    }

    return null;
  }, []);

  const handleFormatGlobalConfig = () => {
    setStatus(null);
    const parsed = parseGlobalConfig(globalConfigText);
    if (!parsed && globalConfigText.trim()) {
      setGlobalConfigParseError(validateGlobalConfigText(globalConfigText));
      return;
    }
    setGlobalConfigText(JSON.stringify(parsed ?? {}, null, 2));
    setGlobalConfigParseError(null);
  };

  const handleSave = async () => {
    const normalizedProfiles = profiles.map((profile) => normalizeProfile(profile));
    const normalizedGlobalConfig = parseGlobalConfig(globalConfigText);
    const globalError = validateGlobalConfigText(globalConfigText);
    const profileError = validateProfiles(normalizedProfiles);
    const skillError = validateSkillInventory(skillInventory);

    if (profileError) {
      setStatus({ tone: "error", message: profileError });
      return;
    }
    if (globalError) {
      setGlobalConfigParseError(globalError);
      setStatus({ tone: "error", message: "全局配置 JSON 不合法，请先修正后再保存。" });
      return;
    }
    if (skillError) {
      setStatus({ tone: "error", message: skillError });
      return;
    }
    if (normalizedGlobalConfig === null) {
      setStatus({ tone: "error", message: "全局配置解析失败，无法保存。" });
      return;
    }

    const enabledIndex = normalizedProfiles.findIndex((profile) => profile.enabled);
    const nextProfiles = normalizedProfiles.map((profile, index) => ({
      ...profile,
      enabled: index === enabledIndex,
    }));

    setStatus(null);
    setSaving(true);

    try {
      const [apiResult, globalResult, skillResult, ruleResult] = await Promise.all([
        window.electron.saveApiConfig({ profiles: nextProfiles }),
        window.electron.saveGlobalConfig(normalizedGlobalConfig),
        window.electron.saveSkillInventory(skillInventory),
        agentRuleDocuments && typeof electronApi.saveUserAgentRuleDocument === "function"
          ? electronApi.saveUserAgentRuleDocument(userAgentMarkdown)
          : Promise.resolve({ success: true } as { success: boolean; error?: string }),
      ]);
      const failures: string[] = [];

      if (!apiResult.success) {
        failures.push(apiResult.error || "保存模型配置失败。");
      }
      if (!globalResult.success) {
        failures.push(globalResult.error || "保存全局配置失败。");
      }
      if (!skillResult.success) {
        failures.push(skillResult.error || "保存 Skills 配置失败。");
      }
      if (!ruleResult.success) {
        failures.push(ruleResult.error || "保存 Claude 全局规则失败。");
      }

      if (failures.length > 0) {
        setStatus({ tone: "error", message: failures.join("；") });
        return;
      }

      setApiConfigSettings({ profiles: nextProfiles });
      setProfiles(nextProfiles);
      setAgentRuleDocuments((current) => current ? {
        ...current,
        userAgentsMarkdown: userAgentMarkdown,
      } : current);
      await reloadSkillInventory();
      setStatus({ tone: "success", message: "设置已保存。" });
    } catch (error) {
      console.error("Failed to save settings:", error);
      setStatus({ tone: "error", message: "保存设置失败。" });
    } finally {
      setSaving(false);
    }
  };

  const handleLaunchMaintenance = useCallback(() => {
    void (async () => {
      if (!maintenancePrompt.trim()) {
        setStatus({ tone: "error", message: "请先填写维护指令。" });
        return;
      }

      setLaunchingMaintenance(true);
      setStatus(null);
      try {
        await onStartMaintenanceSession(maintenancePrompt.trim());
        onClose();
      } catch (error) {
        console.error("Failed to launch maintenance session:", error);
        setStatus({
          tone: "error",
          message: error instanceof Error ? error.message : "启动维护会话失败。",
        });
      } finally {
        setLaunchingMaintenance(false);
      }
    })();
  }, [maintenancePrompt, onClose, onStartMaintenanceSession]);

  let content = <ApiProfilesSettingsPage profiles={profiles} runtimeSource={runtimeSource} onChange={updateProfiles} />;
  if (activePageId === "routing") {
    content = <ModelRoutingSettingsPage profiles={profiles} onChange={updateProfiles} />;
  }
  if (activePageId === "global-json") {
    content = (
      <GlobalJsonSettingsPage
        configText={globalConfigText}
        parseError={globalConfigParseError}
        onChange={handleGlobalConfigChange}
        onFormat={handleFormatGlobalConfig}
        closeSidebarOnBrowserOpen={closeSidebarOnBrowserOpen}
        onCloseSidebarOnBrowserOpenChange={handleCloseSidebarOnBrowserOpenChange}
      />
    );
  }
  if (activePageId === "skills") {
    content = (
      <SkillsManagementPage
        inventory={skillInventory}
        onInventoryChange={setSkillInventory}
        syncingSkillIds={syncingSkillIds}
        syncNotes={syncNotes}
        onRefresh={() => { void reloadSkillInventory(); }}
        onSync={syncSkillSources}
      />
    );
  }
  if (activePageId === "agent-rules") {
    content = (
      <AgentRulesSettingsPage
        documents={agentRuleDocuments}
        userMarkdown={userAgentMarkdown}
        onUserMarkdownChange={handleUserAgentMarkdownChange}
      />
    );
  }
  if (activePageId === "system-maintenance") {
    content = (
      <SystemMaintenancePage
        prompt={maintenancePrompt}
        launching={launchingMaintenance}
        onPromptChange={(value) => {
          setStatus(null);
          setMaintenancePrompt(value);
        }}
        onLaunch={handleLaunchMaintenance}
      />
    );
  }

  const footer = activePageId === "system-maintenance"
    ? (
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface"
          onClick={onClose}
        >
          关闭
        </button>
      </div>
    )
    : (
      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-xl border border-ink-900/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface"
          onClick={onClose}
        >
          关闭
        </button>
        <button
          type="button"
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-soft transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => { void handleSave(); }}
          disabled={saving || loading}
        >
          {saving ? (
            <svg aria-hidden="true" className="mx-auto h-5 w-5 animate-spin" viewBox="0 0 100 101" fill="none">
              <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
              <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="white" />
            </svg>
          ) : "保存"}
        </button>
      </div>
    );

  return (
    <SettingsSheet
      title="设置"
      description="统一管理接口、运行时、skills 和系统维护入口。"
      pages={pages}
      activePageId={activePageId}
      onPageChange={(pageId) => {
        setStatus(null);
        setActivePageId(pageId as SettingsPageId);
      }}
      onClose={onClose}
      status={status}
      footer={footer}
    >
      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <svg aria-hidden="true" className="h-6 w-6 animate-spin text-accent" viewBox="0 0 100 101" fill="none">
            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentColor" />
          </svg>
        </div>
      ) : content}
    </SettingsSheet>
  );
}
