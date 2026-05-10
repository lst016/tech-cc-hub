import { RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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

type FigmaOfficialMode = "remote" | "desktop";
type FigmaOfficialAuthProvider = "direct" | "codex";

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
// The Electron runner injects enabled Claude Code plugins into Agent SDK sessions.
const FIGMA_AGENT_GUIDE_ENABLED = true;

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
    name: "Figma 官方 MCP",
    kind: "mcp-plugin",
    version: "remote",
    description: "Figma 官方远程 MCP，用于从 Figma 链接和 Frame 获取设计上下文并辅助实现 UI。",
    sourcePath: FIGMA_MCP_URL,
    sourceLabel: "Remote HTTP MCP",
    permissions: ["mcp.remote", "figma.oauth", "design.read"],
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
    if (status?.authProvider === "codex") {
      return "Figma 授权有时效，失效后请点击 Codex 官方授权刷新。";
    }
    return status?.authHint ?? "Figma 授权有时效，失效后需要重新授权。";
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
    "你在 tech-cc-hub 的系统工作区里，目标是使用 Figma 官方 MCP 获取设计上下文并实现 UI。",
    "",
    "第一版只聚焦 Figma 链接/Frame/图层到 UI 实现，不要宣称 write-to-canvas 或 live UI capture 已完成。",
    `官方 MCP URL: ${FIGMA_MCP_URL}`,
    `官方 Desktop MCP URL: ${FIGMA_DESKTOP_MCP_URL}`,
    "预期 server name: figma",
    "如果出现 401/403/auth/token/expired/oauth/unauthorized，请判断为 Figma 授权缺失或过期，引导用户重新授权，不要重装插件。",
    "当前 tech-cc-hub 会把本机已安装的 Claude Code 官方 Figma plugin 作为 Agent SDK local plugin 注入会话；优先使用该插件提供的 Figma MCP 和 Skills。",
    "如果需要授权，优先走 Figma MCP 的 OAuth 流程，不要切到 Codex OAuth；如果远程 OAuth 反复失败，再引导用户在插件卡片点击「使用桌面 MCP」。",
    "",
    "Agent 引导 OAuth 规则：",
    "1. 先检查 Figma MCP 工具是否可用；如果工具提示需要 OAuth，触发 MCP 授权流程。",
    "2. 拿到授权 URL 后，系统会自动打开外部浏览器并复制链接；你仍必须调用 `AskUserQuestion` 等待用户确认，不能只用普通文本回复后结束本回合。",
    "3. `AskUserQuestion` 里必须提供两个选项：`授权已完成（localhost 页面正常加载）` 和 `localhost 页面打不开，改用 Figma Desktop MCP`。",
    "4. 如果用户选择授权已完成，继续检查 Figma 工具是否已经可用，或让用户提供 Figma 链接/Frame。",
    "5. 不要要求用户粘贴 callback URL，除非客户端明确要求提交 callback URL；优先让 Claude/Figma MCP 自己完成 OAuth 状态恢复。",
    "6. 如果用户说 localhost 页面打不开，停止远程 OAuth 重试，引导用户打开 Figma 桌面版，在设计文件 Dev Mode 中启用 Desktop MCP Server，然后回到插件卡片点「使用桌面 MCP」。",
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
    if (mode === "desktop") return kind === "desktop-unavailable" ? "切回 Codex 授权" : "刷新 Codex 授权";
    if (kind === "misconfigured") return "修复并授权";
    if (kind === "auth-expired") return "Codex 重新授权";
    if (kind === "ready") return "刷新 Codex 授权";
    if (kind === "not-configured") return "Codex 授权接入";
    return "Codex 授权 Figma";
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
    const toolHint = typeof toolCount === "number" && toolCount > 0
      ? ` · 已检测 ${toolCount} 个 MCP 工具`
      : "";
    return mode === "desktop"
      ? `能力：${formatFigmaCapabilities(capabilities)} · Desktop MCP ${status?.desktopUrl ?? result?.desktopUrl ?? FIGMA_DESKTOP_MCP_URL}`
      : `能力：${formatFigmaCapabilities(capabilities)}${toolHint} · ${authProvider === "codex" ? "Codex 官方 OAuth" : "授权过期后需重新授权"}`;
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
    void (async () => {
      setInstallingPluginId(plugin.id);
      try {
        const channel = plugin.id === FIGMA_OFFICIAL_ID
          ? "plugins:connectFigmaCodexOfficial"
          : "plugins:installOpenComputerUse";
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke(channel) as PluginInstallResult;
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
        description: "请使用 Codex 授权接入，或切换到 Figma Desktop MCP。",
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
      allowedTools: isFigma ? "*" : "Read,Edit,MultiEdit,Write,Bash,Glob,Search,TodoWrite",
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
        <div className="grid min-w-[1120px] grid-cols-[minmax(320px,1fr)_140px_130px_220px_170px] border-b border-[#E5E6EB] bg-[#F7F8FA] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#8A94A6]">
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

          return (
            <article
              key={plugin.id}
              className="grid min-w-[1120px] grid-cols-[minmax(320px,1fr)_140px_130px_220px_170px] items-start gap-4 px-4 py-4"
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
                <div className="truncate font-medium text-[#1D2129]">{plugin.sourceLabel}</div>
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
