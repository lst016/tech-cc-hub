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
} from "../types";
import { ApiProfilesSettingsPage } from "./settings/ApiProfilesSettingsPage";
import { AgentRulesSettingsPage } from "./settings/AgentRulesSettingsPage";
import {
  ChannelsSettingsPage,
  getChannelSettingsSummary,
  type ChannelGuideSessionRequest,
} from "./settings/ChannelsSettingsPage";
import { GlobalJsonSettingsPage } from "./settings/GlobalJsonSettingsPage";
import { ModelRoutingSettingsPage } from "./settings/ModelRoutingSettingsPage";
import { SettingsSheet, type SettingsPageDefinition } from "./settings/SettingsSheet";
import { SkillsManagementPage } from "./settings/SkillsManagementPage";
import { PluginsSettingsPage } from "./settings/PluginsSettingsPage";
import { AboutPage } from "./settings/AboutPage";
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
  onStartMaintenanceSession: (prompt: string, options?: SystemSessionLaunchOptions) => Promise<void>;
}

type GlobalRuntimeConfig = Record<string, unknown>;

type SystemSessionLaunchOptions = {
  titleHint?: string;
  agentId?: string;
  allowedTools?: string;
};

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
    "",
    "设计还原默认规则：只要用户提供截图、Figma 图、页面参考图，并要求生成或修改 UI/前端代码，请优先使用设计 MCP。单张参考图先用 design_inspect_image 生成结构化视觉摘要；已有页面后再用 design_capture_current_view / design_compare_current_view / design_compare_images 生成当前截图、三栏比照图和差异图，再按差异修 UI。",
    "",
    "## 自动优化沉淀默认规则",
    "",
    "自动优化或复盘后，稳定规则类内容必须进入 Rules，而不是 Memory。Rules 包括长期行为约束、默认策略、工具调用政策、项目约定、命名规范、验收口径和禁止项。",
    "",
    "Memory 只用于记录最近做了什么、当前状态、未完成事项、风险、接手线索和短期事实，不承载长期规则或方法论。",
    "",
    "如果优化建议可以沉淀成可复用流程、模板、脚本、触发条件或输入输出协议，优先建议新增或优化 Skills；Rules 只保留何时使用这些 Skills 的触发约束。",
    "",
    "当一条内容同时像 Rules 和 Memory 时，优先归入 Rules；同时像 Rules 和 Skills 时，把约束放 Rules，把执行细节放 Skills。",
    "",
    "## 工具调用优化默认规则",
    "",
    "已知多个具体文件需要查看时，优先并发读取，不要串行一个个 Read。",
    "",
    "目标文件不明确时，先用一次只读 Bash 搜索/筛选收敛范围，例如 rg/find/sed/awk，再读取少量命中文件。",
    "",
    "避免碎片链路：ls -> cat -> grep -> cat。能用一次 rg 或一次批量只读命令得到结论时，不要拆成多次工具调用。",
    "",
    "只读批量操作可以合并；写入、删除、移动、安装、提交等有副作用操作不要混进批量 Bash。",
    "",
    "复盘时如果发现同目录串行多次 Read、重复 Bash、ls/cat/grep 链路，应优先建议改成并发读取或先搜索收敛。",
    "",
    "## Karpathy Coding Guardrails 默认规则",
    "",
    "来源：https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md",
    "",
    "编码前先澄清假设、歧义和取舍；不确定时要显式说明，不要假装已经理解。",
    "",
    "优先选择能解决问题的最小实现；不要增加用户没有要求的功能、抽象、配置项或防御性复杂度。",
    "",
    "修改必须外科手术式收敛；只触碰完成本次请求必需的代码，匹配现有风格，不顺手重构无关区域。",
    "",
    "多步骤任务需要先定义可验证的成功标准；修 bug 和重构应优先有复现/验收路径，再进入实现闭环。",
  ].join("\n"),
  userClaudeRoot: "~/.claude",
  userAgentsPath: "~/.claude/CLAUDE.md",
  userAgentsMarkdown: "",
};

const SETTINGS_PAGES: SettingsPageDefinition[] = [
  {
    id: "profiles",
    label: "AI接口",
    eyebrow: "API",
    title: "AI接口",
    description: "维护 API 网关、密钥、模型池，并定义默认主模型和角色模型的分工方式。",
    summary: "网关、密钥、模型池",
  },
  {
    id: "channels",
    label: "渠道连接",
    eyebrow: "CHANNELS",
    title: "渠道连接",
    description: "配置 Telegram、飞书/Lark 和其他远程聊天入口。",
    summary: "Telegram / 飞书",
  },
  {
    id: "plugins",
    label: "插件系统",
    eyebrow: "PLUGINS",
    title: "插件系统",
    description: "管理默认插件、MCP 能力和本机权限状态。",
    summary: "Open Computer Use",
  },
  {
    id: "skills",
    label: "技能管理",
    eyebrow: "SKILLS",
    title: "技能中心",
    description: "发现、安装和管理技能，配置场景与工具同步。",
    summary: "技能与场景",
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
    id: "about",
    label: "关于",
    eyebrow: "ABOUT",
    title: "关于",
    description: "查看版本、检查更新、系统维护和获取支持资源。",
    summary: "版本、更新与维护",
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runtimeSource, setRuntimeSource] = useState<DevElectronRuntimeSource>(() => getDevElectronRuntimeSource());
  const [status, setStatus] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [globalConfigParseError, setGlobalConfigParseError] = useState<string | null>(null);
  const electronApi = window.electron as typeof window.electron & {
    getAgentRuleDocuments?: () => Promise<AgentRuleDocuments>;
    saveUserAgentRuleDocument?: (markdown: string) => Promise<{ success: boolean; error?: string }>;
  };

  useEffect(() => {
    if (initialPageId) {
      setActivePageId(initialPageId);
    }
  }, [initialPageId]);

  const loadSettings = useCallback(() => {
    setLoading(true);
    void Promise.all([
      window.electron.getApiConfig(),
      window.electron.getGlobalConfig(),
      typeof electronApi.getAgentRuleDocuments === "function"
        ? electronApi.getAgentRuleDocuments()
        : Promise.resolve(DEFAULT_AGENT_RULE_DOCUMENTS),
    ])
      .then(([apiSettings, globalSettings, ruleDocuments]) => {
        const normalizedGlobalSettings = typeof globalSettings === "object" && globalSettings !== null && !Array.isArray(globalSettings)
          ? globalSettings as GlobalRuntimeConfig
          : {};
        const normalizedProfiles = apiSettings.profiles.length > 0
          ? apiSettings.profiles.map((profile) => normalizeProfile(profile))
          : [createProfile()];

        setApiConfigSettings({ profiles: normalizedProfiles });
        setProfiles(normalizedProfiles);
        setActivePageId(initialPageId ?? "profiles");
        const globalConfigText = JSON.stringify(normalizedGlobalSettings, null, 2);
        setGlobalConfigText(globalConfigText);
        setGlobalConfigParseError(validateGlobalConfigText(globalConfigText));
        setCloseSidebarOnBrowserOpen(getCloseSidebarOnBrowserOpen(normalizedGlobalSettings));
        const normalizedRuleDocuments = ruleDocuments ?? DEFAULT_AGENT_RULE_DOCUMENTS;
        setAgentRuleDocuments(normalizedRuleDocuments);
        setUserAgentMarkdown(normalizedRuleDocuments.userAgentsMarkdown);
      })
      .catch((error) => {
        console.error("Failed to load settings:", error);
        setStatus({ tone: "error", message: "加载设置失败。" });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [electronApi, initialPageId, setApiConfigSettings]);

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
        summary: `共 ${profiles.length} 个配置 · ${buildRoutingSummary(enabledProfile)}`,
      };
    }
    if (page.id === "skills") {
      return {
        ...page,
        summary: "技能与场景管理",
      };
    }
    if (page.id === "plugins") {
      return {
        ...page,
        summary: "默认插件与 MCP",
      };
    }
    if (page.id === "channels") {
      return {
        ...page,
        summary: getChannelSettingsSummary(globalConfigText),
      };
    }
    return page;
  }), [enabledProfile, globalConfigText, profiles.length]);

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

  const handleStartGuideSession = useCallback(async (request: ChannelGuideSessionRequest) => {
    setStatus(null);
    try {
      await onStartMaintenanceSession(request.prompt, {
        titleHint: request.title,
        agentId: request.agentId,
        allowedTools: request.allowedTools,
      });
      onClose();
    } catch (error) {
      console.error("Failed to launch guide session:", error);
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "启动引导会话失败。",
      });
      throw error;
    }
  }, [onClose, onStartMaintenanceSession]);

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

    if (profileError) {
      setStatus({ tone: "error", message: profileError });
      return;
    }
    if (globalError) {
      setGlobalConfigParseError(globalError);
      setStatus({ tone: "error", message: "全局配置 JSON 不合法，请先修正后再保存。" });
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
      const [apiResult, globalResult, ruleResult] = await Promise.all([
        window.electron.saveApiConfig({ profiles: nextProfiles }),
        window.electron.saveGlobalConfig(normalizedGlobalConfig),
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
      setStatus({ tone: "success", message: "设置已保存。" });
    } catch (error) {
      console.error("Failed to save settings:", error);
      setStatus({ tone: "error", message: "保存设置失败。" });
    } finally {
      setSaving(false);
    }
  };

  let content = (
    <>
      <ModelRoutingSettingsPage profiles={profiles} onChange={updateProfiles} />
      <div className="mt-6">
        <ApiProfilesSettingsPage profiles={profiles} runtimeSource={runtimeSource} onChange={updateProfiles} />
      </div>
    </>
  );
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
  if (activePageId === "channels") {
    content = (
      <ChannelsSettingsPage
        configText={globalConfigText}
        parseError={globalConfigParseError}
        onChange={handleGlobalConfigChange}
        onStartGuideSession={handleStartGuideSession}
      />
    );
  }
  if (activePageId === "skills") {
    content = <SkillsManagementPage />;
  }
  if (activePageId === "plugins") {
    content = <PluginsSettingsPage />;
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
  if (activePageId === "about") {
    content = <AboutPage onStartMaintenanceSession={onStartMaintenanceSession} onClose={onClose} />;
  }

  const footer = activePageId === "about" || activePageId === "skills" || activePageId === "plugins"
    ? null
    : (
      <div className="flex gap-3">
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
