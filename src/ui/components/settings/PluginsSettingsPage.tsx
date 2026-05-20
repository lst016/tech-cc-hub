import { Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_RESTRICTED_ALLOWED_TOOLS_TEXT } from "../../../shared/claude-agent-teams";
import { buildPluginActionToastMessage } from "./plugin-toast-messages";

type PluginStatus = "not-installed" | "needs-permission" | "needs-connect" | "ready" | "update-available";
type PluginUpdateStatus = "unknown" | "up-to-date" | "update-available" | "error";

type DefaultPlugin = {
  id: string;
  name: string;
  kind: string;
  version: string;
  description: string;
  sourcePath: string;
  sourceLabel: string;
  permissions: string[];
};

type OpenComputerUsePermissionStatus = {
  platform: string;
  required: boolean;
  accessibility: "granted" | "missing" | "not-required" | "unknown";
  screenRecording: "granted" | "missing" | "not-required" | "unknown";
  needsUserAction: boolean;
  openedSystemSettings: boolean;
};

type FigmaOfficialStatusKind =
  | "not-configured"
  | "configured"
  | "needs-auth"
  | "auth-expired"
  | "desktop-unavailable"
  | "misconfigured"
  | "ready";

type FigmaOfficialMode = "remote" | "desktop" | "rest";
type FigmaOfficialAuthProvider = "direct" | "codex" | "pat";

type PluginInstallResult = {
  success: boolean;
  installed: boolean;
  connected: boolean;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  updateStatus?: PluginUpdateStatus;
  updateError?: string;
  updateCheckedAt?: number;
  message: string;
  error?: string;
  permissions?: OpenComputerUsePermissionStatus;
  status?: FigmaOfficialStatusKind;
  authHint?: string;
  url?: string;
  desktopUrl?: string;
  mode?: FigmaOfficialMode;
  authProvider?: FigmaOfficialAuthProvider;
  capabilities?: string[];
  tools?: string[];
  toolCount?: number;
  lastToolCheckedAt?: number;
  accountLabel?: string;
};

type PluginRuntimeStatus = {
  installed: boolean;
  connected: boolean;
  version?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  updateStatus?: PluginUpdateStatus;
  updateError?: string;
  updateCheckedAt?: number;
  permissions?: OpenComputerUsePermissionStatus;
  status?: FigmaOfficialStatusKind;
  message?: string;
  authHint?: string;
  url?: string;
  desktopUrl?: string;
  mode?: FigmaOfficialMode;
  authProvider?: FigmaOfficialAuthProvider;
  capabilities?: string[];
  tools?: string[];
  toolCount?: number;
  lastToolCheckedAt?: number;
  accountLabel?: string;
};

type PluginGuideSessionRequest = {
  title: string;
  prompt: string;
  agentId?: string;
  allowedTools?: string;
};

type PluginsSettingsPageProps = {
  onStartGuideSession?: (request: PluginGuideSessionRequest) => Promise<void> | void;
};

const OPEN_COMPUTER_USE_ID = "open-computer-use";
const FIGMA_OFFICIAL_ID = "figma-official";
const FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
const FIGMA_DESKTOP_MCP_URL = "http://127.0.0.1:3845/mcp";
const FIGMA_REST_API_URL = "https://api.figma.com/v1";
const FIGMA_TOKEN_SETTINGS_URL = "https://www.figma.com/settings";
// The Electron runner injects enabled Claude Code plugins into Agent SDK sessions.
const FIGMA_AGENT_GUIDE_ENABLED = false;

const DEFAULT_PLUGINS: DefaultPlugin[] = [
  {
    id: OPEN_COMPUTER_USE_ID,
    name: "Open Computer Use",
    kind: "mcp-plugin",
    version: "0.1.48",
    description: "本机桌面控制 MCP 插件，作为插件体系的第一颗默认插件。",
    sourcePath: "plugins/open-computer-use",
    sourceLabel: "GitHub",
    permissions: ["mcp.server", "desktop.read", "desktop.write", "accessibility", "screen-recording"],
  },
  {
    id: FIGMA_OFFICIAL_ID,
    name: "Figma Token / REST API",
    kind: "api-token-plugin",
    version: "PAT",
    description: "使用 Figma Personal Access Token 读取文件/节点，提取设计摘要和 tokens，内置设计系统/UX 审查，生成 Tailwind 初稿，并查看评论、版本、组件样式、变量、Dev Resources 和导出图片 URL，不依赖 Codex OAuth。",
    sourcePath: FIGMA_REST_API_URL,
    sourceLabel: "Figma REST API",
    permissions: ["figma.token", "figma.rest", "design.read", "ux.audit", "metadata", "library", "variables"],
  },
];

const statusMeta: Record<PluginStatus, { label: string; className: string }> = {
  "not-installed": {
    label: "未安装",
    className: "border-amber-500/20 bg-amber-50 text-amber-800",
  },
  "needs-permission": {
    label: "待授权",
    className: "border-orange-500/20 bg-orange-50 text-orange-800",
  },
  "needs-connect": {
    label: "待接入",
    className: "border-blue-500/20 bg-blue-50 text-blue-700",
  },
  ready: {
    label: "可用",
    className: "border-emerald-500/20 bg-emerald-50 text-emerald-700",
  },
  "update-available": {
    label: "可更新",
    className: "border-amber-500/20 bg-amber-50 text-amber-800",
  },
};

const figmaStatusMeta: Record<FigmaOfficialStatusKind, { label: string; className: string }> = {
  "not-configured": statusMeta["not-installed"],
  configured: statusMeta["needs-connect"],
  "needs-auth": statusMeta["needs-permission"],
  "auth-expired": statusMeta["needs-permission"],
  "desktop-unavailable": statusMeta["needs-permission"],
  misconfigured: statusMeta["needs-connect"],
  ready: statusMeta.ready,
};

function getPermissionHint(plugin: DefaultPlugin, status?: PluginRuntimeStatus): string | null {
  if (plugin.id === FIGMA_OFFICIAL_ID) {
    if (status?.status === "desktop-unavailable") {
      return "未检测到 Figma Desktop 本地 MCP，请打开 Figma 桌面版并启用 Dev Mode MCP Server。";
    }
    if (status?.authProvider === "pat" || status?.mode === "rest") {
      return status.connected
        ? "Figma Token 已保存到本机配置；失效后重新输入即可。"
        : "请输入 Figma Personal Access Token，保存前会先校验 /v1/me。";
    }
    if (status?.authProvider === "codex") {
      return "Figma 授权有时效，失效后请点击 Codex 官方授权刷新。";
    }
    return status?.authHint ?? "普通用户建议使用 Figma Personal Access Token 接入。";
  }
  const permissions = status?.permissions;
  if (!permissions?.required) return null;
  if (!permissions.needsUserAction) return "macOS 权限已就绪。";
  return "macOS 还需要授权 Accessibility / Screen Recording。";
}

function buildOpenComputerUseGuidePrompt(status: PluginRuntimeStatus | null): string {
  return [
    "你在 tech-cc-hub 的系统工作区里，目标是把 Open Computer Use 安装并接入到可用状态。",
    "",
    "请按这个顺序处理，不能只安装 npm 包就结束：",
    "1. 检查本机是否存在 open-computer-use 命令，先运行 open-computer-use --version。",
    "2. 如果未安装，在 Windows 使用 npm.cmd install -g open-computer-use；其他平台使用 npm install -g open-computer-use。安装后再次验证 --version。",
    "3. 检查 open-computer-use mcp 是否可用，至少运行 open-computer-use mcp --help 或等价安全检查，不要执行真实桌面操作测试。",
    "4. 确认 tech-cc-hub 全局运行时配置写入 plugins.open-computer-use 和 mcpServers.open-computer-use：mcpServers.open-computer-use 应为 type=stdio，command=open-computer-use，args=[\"mcp\"]。",
    "5. 如果当前运行时提供 plugins:installOpenComputerUse 或等价 IPC/MCP 管理入口，优先使用内置入口完成安装和写 MCP；否则再按代码里的 connectOpenComputerUsePlugin 结构编辑配置。",
    "6. 权限检查：Windows/Linux 不需要 macOS Accessibility / Screen Recording；macOS 必须提示并引导授权这两项，授权未完成时不能报告为可用。",
    "7. 完成后给出：open-computer-use 版本、MCP 配置是否写入、权限状态、是否还需要重启应用/刷新 MCP，以及最小复测命令。",
    "",
    "当前 UI 看到的 Open Computer Use 状态快照：",
    "```json",
    JSON.stringify(status ?? { installed: false, connected: false }, null, 2),
    "```",
  ].join("\n");
}

function buildFigmaOfficialGuidePrompt(status: PluginRuntimeStatus | null): string {
  return [
    "你在 tech-cc-hub 的系统工作区里，目标是使用 Figma Token / REST API 获取设计上下文并实现 UI。",
    "",
    "优先使用普通用户可用的 Figma Personal Access Token 模式，不要依赖 Codex OAuth。",
    `Figma REST API URL: ${FIGMA_REST_API_URL}`,
    `官方 MCP URL: ${FIGMA_MCP_URL}`,
    `官方 Desktop MCP URL: ${FIGMA_DESKTOP_MCP_URL}`,
    "PAT 保存后，Agent 会使用内置 MCP 工具：figma_get_current_user、figma_get_file_metadata、figma_read_design、figma_summarize_design、figma_extract_design_tokens、figma_get_design_playbook、figma_audit_design、figma_generate_tailwind_code、figma_get_image_urls、figma_export_node_images、figma_get_image_fills、figma_list_file_versions、figma_list_file_comments、figma_list_file_library、figma_get_file_variables、figma_get_dev_resources。",
    "如果出现 401/403/auth/token/unauthorized，请判断为 Figma Token 缺失、无效或权限不足，引导用户重新输入 PAT，不要重装插件。",
    "",
    "Agent 使用规则：",
    "1. 用户给 Figma 链接时，先按任务选择工具：概览用 figma_get_file_metadata，节点原始 JSON 用 figma_read_design，Agent 实现上下文优先用 figma_summarize_design。",
    "2. 需要设计语言时调用 figma_extract_design_tokens；需要设计理论/设计系统增强时先用 figma_get_design_playbook，再用 figma_audit_design 审查 Figma 节点；需要先出代码草稿时调用 figma_generate_tailwind_code，但落地时必须复用当前项目组件并截图校对。",
    "3. 需要视觉参考图时优先调用 figma_export_node_images，把返回的 imagePath 交给 design_inspect_image；figma_get_image_urls 只用于查看临时导出 URL。",
    "4. 需要设计系统上下文时调用 figma_list_file_library 和 figma_get_file_variables；需要协作上下文时调用 figma_list_file_comments、figma_list_file_versions、figma_get_dev_resources。",
    "5. 只有用户明确要用桌面实时选区，才切到 Figma Desktop MCP。",
    "",
    "当前 Figma 插件状态快照：",
    "```json",
    JSON.stringify(status ?? { installed: false, connected: false }, null, 2),
    "```",
  ].join("\n");
}

function showPluginActionToast(result: PluginInstallResult): void {
  const message = buildPluginActionToastMessage(result);
  const options = message.description ? { description: message.description } : undefined;
  if (message.kind === "success") {
    toast.success(message.title, options);
    return;
  }
  toast.error(message.title, options);
}

function toRuntimeStatus(result: PluginInstallResult): PluginRuntimeStatus {
  return {
    installed: result.installed,
    connected: result.connected,
    version: result.version,
    latestVersion: result.latestVersion,
    updateAvailable: result.updateAvailable,
    updateStatus: result.updateStatus,
    updateError: result.updateError,
    updateCheckedAt: result.updateCheckedAt,
    permissions: result.permissions,
    status: result.status,
    message: result.message,
    authHint: result.authHint,
    url: result.url,
    capabilities: result.capabilities,
    desktopUrl: result.desktopUrl,
    mode: result.mode,
    authProvider: result.authProvider,
    tools: result.tools,
    toolCount: result.toolCount,
    lastToolCheckedAt: result.lastToolCheckedAt,
    accountLabel: result.accountLabel,
  };
}

function getPluginStatusMeta(plugin: DefaultPlugin, status?: PluginRuntimeStatus, result?: PluginInstallResult) {
  if (plugin.id === FIGMA_OFFICIAL_ID) {
    return figmaStatusMeta[status?.status ?? result?.status ?? "not-configured"];
  }

  const connected = status?.connected === true || (result?.success && result.connected);
  const installed = status?.installed === true || result?.installed === true;
  const permissions = result?.permissions ?? status?.permissions;
  const needsPermission = Boolean(permissions?.required && permissions.needsUserAction);
  const updateAvailable = Boolean(status?.updateAvailable || result?.updateAvailable);

  if (updateAvailable && installed) return statusMeta["update-available"];
  if (connected) return statusMeta.ready;
  if (needsPermission) return statusMeta["needs-permission"];
  if (installed) return statusMeta["needs-connect"];
  return statusMeta["not-installed"];
}

function getPrimaryActionLabel(plugin: DefaultPlugin, status?: PluginRuntimeStatus, result?: PluginInstallResult, busy = false): string {
  if (busy) return "处理中...";

  if (plugin.id === FIGMA_OFFICIAL_ID) {
    const kind = status?.status ?? result?.status ?? "not-configured";
    const mode = status?.mode ?? result?.mode;
    if (kind === "ready" && mode === "rest") return "更新 Token";
    if (kind === "auth-expired") return "重新输入 Token";
    if (kind === "misconfigured") return "输入 Token 修复";
    if (mode === "desktop") return "输入 Token";
    if (kind === "not-configured") return "输入 Figma Token";
    return "输入 Token";
  }

  const connected = status?.connected === true || (result?.success && result.connected);
  const installed = status?.installed === true || result?.installed === true;
  const needsPermission = Boolean((result?.permissions ?? status?.permissions)?.required && (result?.permissions ?? status?.permissions)?.needsUserAction);
  if (Boolean(status?.updateAvailable || result?.updateAvailable) && installed) return "更新";
  if (connected) return "重新检查";
  if (needsPermission) return "授权";
  if (installed) return "接入";
  return "安装";
}

function getUpdateHint(plugin: DefaultPlugin, status?: PluginRuntimeStatus, result?: PluginInstallResult): string {
  if (plugin.id === FIGMA_OFFICIAL_ID) {
    const capabilities = status?.capabilities ?? result?.capabilities ?? ["design-context"];
    const mode = status?.mode ?? result?.mode ?? "remote";
    const authProvider = status?.authProvider ?? result?.authProvider;
    const toolCount = status?.toolCount ?? result?.toolCount;
    const accountLabel = status?.accountLabel ?? result?.accountLabel;
    const toolHint = typeof toolCount === "number" && toolCount > 0
      ? ` · ${toolCount} 个内置工具`
      : "";
    if (mode === "desktop") {
      return `能力：${formatFigmaCapabilities(capabilities)} · Desktop MCP ${status?.desktopUrl ?? result?.desktopUrl ?? FIGMA_DESKTOP_MCP_URL}`;
    }
    if (mode === "rest" || authProvider === "pat") {
      return `能力：${formatFigmaCapabilities(capabilities)}${toolHint} · Figma Token${accountLabel ? ` · ${accountLabel}` : ""}`;
    }
    return `能力：${formatFigmaCapabilities(capabilities)}${toolHint} · ${authProvider === "codex" ? "Codex 官方 OAuth" : "可输入 Token 接入"}`;
  }

  const latestVersion = status?.latestVersion ?? result?.latestVersion;
  const updateStatus = status?.updateStatus ?? result?.updateStatus;
  const updateError = status?.updateError ?? result?.updateError;
  if (Boolean(status?.updateAvailable || result?.updateAvailable) && latestVersion) return `发现新版本 v${latestVersion}`;
  if (updateStatus === "up-to-date" && latestVersion) return `已是最新 v${latestVersion}`;
  if (updateStatus === "error") return `扫描失败：${updateError ?? "未知错误"}`;
  if (latestVersion) return `最新 v${latestVersion}`;
  return "未扫描更新";
}

function formatFigmaCapabilities(capabilities: string[]): string {
  const labels: Record<string, string> = {
    "design-context": "设计上下文",
    "selection-context": "选区上下文",
    "file-api": "文件 API",
    "image-export": "图片导出",
  };
  return capabilities.map((capability) => labels[capability] ?? capability).join("、");
}

export function PluginsSettingsPage({ onStartGuideSession }: PluginsSettingsPageProps) {
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [checkingUpdatePluginId, setCheckingUpdatePluginId] = useState<string | null>(null);
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null);
  const [launchingGuidePluginId, setLaunchingGuidePluginId] = useState<string | null>(null);
  const [installResults, setInstallResults] = useState<Record<string, PluginInstallResult>>({});
  const [runtimeStatuses, setRuntimeStatuses] = useState<Record<string, PluginRuntimeStatus>>({});
  const [figmaTokenPanelOpen, setFigmaTokenPanelOpen] = useState(false);
  const [figmaTokenDraft, setFigmaTokenDraft] = useState("");
  const [figmaTokenVisible, setFigmaTokenVisible] = useState(false);
  const guideLaunchInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    const electron = window.electron as typeof window.electron & {
      invoke: (channel: string, ...args: unknown[]) => Promise<PluginRuntimeStatus>;
    };

    void Promise.all([
      electron.invoke("plugins:getOpenComputerUseStatus")
        .then(async (status) => {
          const checked = await electron.invoke("plugins:checkOpenComputerUseUpdate").catch(() => status);
          return [OPEN_COMPUTER_USE_ID, checked] as const;
        })
        .catch((error) => [OPEN_COMPUTER_USE_ID, {
          installed: false,
          connected: false,
          updateStatus: "error" as const,
          updateError: error instanceof Error ? error.message : String(error),
        }] as const),
      electron.invoke("plugins:getFigmaOfficialStatus")
        .then((status) => [FIGMA_OFFICIAL_ID, status] as const)
        .catch((error) => [FIGMA_OFFICIAL_ID, {
          installed: false,
          connected: false,
          status: "not-configured" as const,
          updateStatus: "error" as const,
          updateError: error instanceof Error ? error.message : String(error),
        }] as const),
    ]).then((entries) => {
      if (!mounted) return;
      setRuntimeStatuses(Object.fromEntries(entries) as Record<string, PluginRuntimeStatus>);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setPluginStatus = (pluginId: string, status: PluginRuntimeStatus) => {
    setRuntimeStatuses((current) => ({ ...current, [pluginId]: status }));
  };

  const setPluginResult = (pluginId: string, result: PluginInstallResult) => {
    setInstallResults((current) => ({ ...current, [pluginId]: result }));
    setPluginStatus(pluginId, toRuntimeStatus(result));
  };

  const handleInstall = (plugin: DefaultPlugin) => {
    if (plugin.id === FIGMA_OFFICIAL_ID) {
      setFigmaTokenPanelOpen(true);
      return;
    }

    void (async () => {
      setInstallingPluginId(plugin.id);
      try {
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke("plugins:installOpenComputerUse") as PluginInstallResult;
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
      } catch (error) {
        const result: PluginInstallResult = {
          success: false,
          installed: runtimeStatuses[plugin.id]?.installed ?? false,
          connected: runtimeStatuses[plugin.id]?.connected ?? false,
          message: "插件请求失败。",
          error: error instanceof Error ? error.message : String(error),
        };
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
      } finally {
        setInstallingPluginId(null);
      }
    })();
  };

  const handleFigmaDesktopConnect = (plugin: DefaultPlugin) => {
    void (async () => {
      setInstallingPluginId(plugin.id);
      try {
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke("plugins:connectFigmaDesktopOfficial") as PluginInstallResult;
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
      } catch (error) {
        const current = runtimeStatuses[plugin.id];
        const result: PluginInstallResult = {
          success: false,
          installed: current?.installed ?? true,
          connected: current?.connected ?? false,
          status: "desktop-unavailable",
          message: "Figma Desktop MCP 检查失败。",
          error: error instanceof Error ? error.message : String(error),
        };
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
      } finally {
        setInstallingPluginId(null);
      }
    })();
  };

  const handleFigmaPatConnect = (plugin: DefaultPlugin) => {
    const token = figmaTokenDraft.trim();
    if (!token) {
      toast.error("请先输入 Figma Token");
      return;
    }

    void (async () => {
      setInstallingPluginId(plugin.id);
      try {
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke("plugins:connectFigmaPatOfficial", token) as PluginInstallResult;
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
        if (result.success) {
          setFigmaTokenDraft("");
          setFigmaTokenPanelOpen(false);
          setFigmaTokenVisible(false);
        }
      } catch (error) {
        const current = runtimeStatuses[plugin.id];
        const result: PluginInstallResult = {
          success: false,
          installed: current?.installed ?? true,
          connected: current?.connected ?? false,
          status: current?.status ?? "needs-auth",
          message: "Figma Token 保存失败。",
          error: error instanceof Error ? error.message : String(error),
        };
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
      } finally {
        setInstallingPluginId(null);
      }
    })();
  };

  const handleOpenFigmaTokenSettings = () => {
    void (async () => {
      try {
        await (window.electron as typeof window.electron & {
          invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>;
        }).invoke?.("shell:openExternal", FIGMA_TOKEN_SETTINGS_URL);
        toast.info("已打开 Figma 设置页", {
          description: "进入 Security / Personal access tokens 后生成 Token。",
        });
      } catch (error) {
        toast.error("打开 Figma 设置页失败", {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    })();
  };

  const handleCheckUpdate = (plugin: DefaultPlugin) => {
    if (plugin.id === FIGMA_OFFICIAL_ID) {
      void (async () => {
        setCheckingUpdatePluginId(plugin.id);
        try {
          const status = await (window.electron as typeof window.electron & {
            invoke: (channel: string, ...args: unknown[]) => Promise<PluginRuntimeStatus>;
          }).invoke("plugins:getFigmaOfficialStatus") as PluginRuntimeStatus;
          setPluginStatus(plugin.id, status);
        } finally {
          setCheckingUpdatePluginId(null);
        }
      })();
      return;
    }

    void (async () => {
      setCheckingUpdatePluginId(plugin.id);
      try {
        const status = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginRuntimeStatus>;
        }).invoke("plugins:checkOpenComputerUseUpdate") as PluginRuntimeStatus;
        setPluginStatus(plugin.id, status);
      } catch (error) {
        const current = runtimeStatuses[plugin.id];
        setPluginStatus(plugin.id, {
          installed: current?.installed ?? false,
          connected: current?.connected ?? false,
          version: current?.version,
          latestVersion: current?.latestVersion,
          updateAvailable: false,
          updateStatus: "error",
          updateError: error instanceof Error ? error.message : String(error),
          updateCheckedAt: Date.now(),
          permissions: current?.permissions,
        });
      } finally {
        setCheckingUpdatePluginId(null);
      }
    })();
  };

  const handleUpdate = (plugin: DefaultPlugin) => {
    void (async () => {
      setUpdatingPluginId(plugin.id);
      try {
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke("plugins:updateOpenComputerUse") as PluginInstallResult;
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
      } catch (error) {
        const current = runtimeStatuses[plugin.id];
        const result: PluginInstallResult = {
          success: false,
          installed: current?.installed ?? true,
          connected: current?.connected ?? false,
          version: current?.version,
          latestVersion: current?.latestVersion,
          updateAvailable: false,
          updateStatus: "error",
          updateError: error instanceof Error ? error.message : String(error),
          updateCheckedAt: Date.now(),
          message: "插件更新请求失败。",
          error: error instanceof Error ? error.message : String(error),
        };
        setPluginResult(plugin.id, result);
        showPluginActionToast(result);
      } finally {
        setUpdatingPluginId(null);
      }
    })();
  };

  const handleStartGuideSession = (plugin: DefaultPlugin) => {
    if (!onStartGuideSession || guideLaunchInFlightRef.current) return;
    const isFigma = plugin.id === FIGMA_OFFICIAL_ID;
    if (isFigma && !FIGMA_AGENT_GUIDE_ENABLED) {
      toast.info("Figma Agent 引导授权已暂停", {
        description: "请直接输入 Figma Token，或切换到 Figma Desktop MCP。",
      });
      return;
    }
    guideLaunchInFlightRef.current = true;
    setLaunchingGuidePluginId(plugin.id);
    const status = runtimeStatuses[plugin.id] ?? null;
    void Promise.resolve(onStartGuideSession({
      title: isFigma ? "Figma 官方 MCP 引导接入" : "Open Computer Use 引导安装",
      prompt: isFigma ? buildFigmaOfficialGuidePrompt(status) : buildOpenComputerUseGuidePrompt(status),
      agentId: isFigma ? "figma-official-mcp-guide" : "open-computer-use-guide",
      allowedTools: isFigma ? "*" : DEFAULT_RESTRICTED_ALLOWED_TOOLS_TEXT,
    })).catch(() => {
      guideLaunchInFlightRef.current = false;
      setLaunchingGuidePluginId(null);
    });
  };

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E6EB] pb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-[#8A94A6]">PLUGIN RUNTIME</div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-[#1D2129]">插件系统</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#6B778C]">
            管理默认插件、MCP 能力和本机权限状态。
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#E5E6EB] bg-white shadow-[0_12px_28px_rgba(24,32,46,0.04)]">
        <div className="grid min-w-[1040px] grid-cols-[minmax(270px,1fr)_130px_110px_190px_220px] border-b border-[#E5E6EB] bg-[#F7F8FA] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#8A94A6]">
          <span>插件</span>
          <span>类型</span>
          <span>状态</span>
          <span>来源</span>
          <span>操作</span>
        </div>

        {DEFAULT_PLUGINS.map((plugin) => {
          const runtimeStatus = runtimeStatuses[plugin.id];
          const installResult = installResults[plugin.id];
          const status = getPluginStatusMeta(plugin, runtimeStatus, installResult);
          const updateHint = getUpdateHint(plugin, runtimeStatus, installResult);
          const permissionHint = getPermissionHint(plugin, runtimeStatus);
          const updateAvailable = Boolean(runtimeStatus?.updateAvailable || installResult?.updateAvailable);
          const installed = runtimeStatus?.installed === true || installResult?.installed === true;
          const isBusy = installingPluginId === plugin.id || updatingPluginId === plugin.id;
          const actionLabel = getPrimaryActionLabel(plugin, runtimeStatus, installResult, isBusy);
          const showGuideButton = Boolean(onStartGuideSession) && (plugin.id !== FIGMA_OFFICIAL_ID || FIGMA_AGENT_GUIDE_ENABLED);
          const guideLabel = launchingGuidePluginId === plugin.id ? "启动中..." : plugin.id === FIGMA_OFFICIAL_ID ? "Agent 引导接入" : "Agent 引导安装";
          const needsPermission = Boolean(runtimeStatus?.permissions?.required && runtimeStatus.permissions.needsUserAction) || runtimeStatus?.status === "auth-expired" || runtimeStatus?.status === "needs-auth";
          const sourceLabel = plugin.id === FIGMA_OFFICIAL_ID
            ? runtimeStatus?.mode === "desktop"
              ? "Figma Desktop MCP"
              : runtimeStatus?.mode === "remote"
                ? "Remote HTTP MCP"
                : "Figma REST API"
            : plugin.sourceLabel;

          return (
            <article
              key={plugin.id}
              className="grid min-w-[1040px] grid-cols-[minmax(270px,1fr)_130px_110px_190px_220px] items-start gap-4 px-4 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#1D2129]">{plugin.name}</h3>
                  <span className="rounded-full border border-[#E5E6EB] bg-[#F7F8FA] px-2 py-0.5 text-xs font-semibold text-[#4E5969]">
                    {runtimeStatus?.version ? `v${runtimeStatus.version}` : plugin.version}
                  </span>
                </div>
                <div className={`mt-1 text-xs font-semibold ${
                  updateAvailable
                    ? "text-amber-700"
                    : runtimeStatus?.updateStatus === "error"
                      ? "text-red-600"
                      : "text-[#86909C]"
                }`}>
                  {updateHint}
                </div>
                <p className="mt-1 text-sm leading-5 text-[#6B778C]">{plugin.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {plugin.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="rounded-md border border-[#DADDE5] bg-white px-2 py-0.5 text-xs font-medium text-[#4E5969]"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>

              <span className="mt-1 rounded-full border border-[#E5E6EB] bg-[#F7F8FA] px-2.5 py-1 text-xs font-semibold text-[#4E5969]">
                {plugin.kind}
              </span>

              <span className={`mt-1 w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                {status.label}
              </span>

              <div className="min-w-0 text-sm leading-5 text-[#6B778C]">
                <div className="truncate font-medium text-[#1D2129]">{sourceLabel}</div>
                <div className="mt-1 truncate text-xs">{runtimeStatus?.url ?? plugin.sourcePath}</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#0E7490]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {plugin.id === FIGMA_OFFICIAL_ID ? `权限标签 ${plugin.permissions.length} 个` : `${plugin.permissions.length} 项权限`}
                </div>
                {permissionHint && (
                  <div className={`mt-1 text-xs font-medium ${needsPermission ? "text-orange-700" : "text-emerald-700"}`}>
                    {permissionHint}
                  </div>
                )}
              </div>

              <div className="mt-0.5 grid gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-[#1D2129] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#2B303B] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    if (plugin.id !== FIGMA_OFFICIAL_ID && updateAvailable && installed) {
                      handleUpdate(plugin);
                      return;
                    }
                    handleInstall(plugin);
                  }}
                  disabled={isBusy}
                >
                  {actionLabel}
                </button>
                {plugin.id === FIGMA_OFFICIAL_ID && figmaTokenPanelOpen && (
                  <div className="grid gap-2 rounded-lg border border-[#DADDE5] bg-[#F7F8FA] p-2">
                    <label className="text-[11px] font-semibold text-[#4E5969]" htmlFor="figma-pat-input">
                      Personal Access Token
                    </label>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <input
                        id="figma-pat-input"
                        type={figmaTokenVisible ? "text" : "password"}
                        value={figmaTokenDraft}
                        onChange={(event) => setFigmaTokenDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleFigmaPatConnect(plugin);
                          }
                        }}
                        placeholder="粘贴 Figma PAT"
                        className="min-w-0 flex-1 rounded-md border border-[#DADDE5] bg-white px-2 py-1.5 text-xs font-medium text-[#1D2129] outline-none transition placeholder:text-[#A8B0BD] focus:border-[#1677FF]"
                        disabled={isBusy}
                      />
                      <button
                        type="button"
                        title={figmaTokenVisible ? "隐藏 Token" : "显示 Token"}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#DADDE5] bg-white text-[#4E5969] transition hover:bg-[#F2F3F5] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => setFigmaTokenVisible((value) => !value)}
                        disabled={isBusy}
                      >
                        {figmaTokenVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-[#1677FF] px-2 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0E63D8] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => handleFigmaPatConnect(plugin)}
                        disabled={isBusy || !figmaTokenDraft.trim()}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        保存并测试
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[#DADDE5] bg-white px-2 py-1.5 text-xs font-semibold text-[#4E5969] transition hover:bg-[#F2F3F5] disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => {
                          setFigmaTokenPanelOpen(false);
                          setFigmaTokenDraft("");
                          setFigmaTokenVisible(false);
                        }}
                        disabled={isBusy}
                      >
                        取消
                      </button>
                    </div>
                    <button
                      type="button"
                      className="rounded-md border border-[#BFD7EA] bg-white px-2 py-1.5 text-xs font-semibold text-[#2563A8] transition hover:border-[#8CBCE5] hover:bg-[#F1F8FF] disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={handleOpenFigmaTokenSettings}
                      disabled={isBusy}
                    >
                      打开 Token 页面
                    </button>
                    <div className="text-[11px] leading-4 text-[#86909C]">
                      Token 只保存在本机配置；基础勾 current_user:read、file_content:read。更多工具按需勾 file_metadata:read、file_versions:read、file_comments:read、library_content:read、file_variables:read、file_dev_resources:read。
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#DADDE5] bg-white px-3 py-2 text-xs font-semibold text-[#4E5969] transition hover:border-[#C9CDD4] hover:bg-[#F7F8FA] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleCheckUpdate(plugin)}
                  disabled={checkingUpdatePluginId === plugin.id || installingPluginId === plugin.id || updatingPluginId === plugin.id}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${checkingUpdatePluginId === plugin.id ? "animate-spin" : ""}`} />
                  {checkingUpdatePluginId === plugin.id ? "扫描中..." : plugin.id === FIGMA_OFFICIAL_ID ? "刷新状态" : "扫描更新"}
                </button>
                {plugin.id === FIGMA_OFFICIAL_ID && (
                  <button
                    type="button"
                    className="rounded-lg border border-[#BFD7EA] bg-[#F1F8FF] px-3 py-2 text-xs font-semibold text-[#2563A8] transition hover:border-[#8CBCE5] hover:bg-[#E5F2FF] disabled:cursor-not-allowed disabled:border-[#E5E6EB] disabled:bg-[#F7F8FA] disabled:text-[#86909C]"
                    onClick={() => handleFigmaDesktopConnect(plugin)}
                    disabled={isBusy}
                  >
                    {runtimeStatus?.mode === "desktop" ? "检查桌面 MCP" : "使用桌面 MCP"}
                  </button>
                )}
                {showGuideButton && (
                  <button
                    type="button"
                    className="rounded-lg border border-[#F0C7B4] bg-[#FFF4EF] px-3 py-2 text-xs font-semibold text-[#C9572C] transition hover:border-[#D96B3A] hover:bg-[#FFEADF] disabled:cursor-not-allowed disabled:border-[#E5E6EB] disabled:bg-[#F7F8FA] disabled:text-[#86909C]"
                    onClick={() => handleStartGuideSession(plugin)}
                    disabled={launchingGuidePluginId === plugin.id}
                  >
                    {guideLabel}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
