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

const DEFAULT_PLUGINS: DefaultPlugin[] = [
  {
    id: "open-computer-use",
    name: "Open Computer Use",
    kind: "mcp-plugin",
    version: "0.1.48",
    description: "本机桌面控制 MCP 插件，作为插件体系的第一颗默认插件。",
    sourcePath: "plugins/open-computer-use",
    permissions: ["mcp.server", "desktop.read", "desktop.write", "accessibility", "screen-recording"],
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

function getPermissionHint(permissions?: OpenComputerUsePermissionStatus): string | null {
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

function showPluginActionToast(result: PluginInstallResult): void {
  const message = buildPluginActionToastMessage(result);
  const options = message.description ? { description: message.description } : undefined;
  if (message.kind === "success") {
    toast.success(message.title, options);
    return;
  }
  toast.error(message.title, options);
}

export function PluginsSettingsPage({ onStartGuideSession }: PluginsSettingsPageProps) {
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [checkingUpdatePluginId, setCheckingUpdatePluginId] = useState<string | null>(null);
  const [updatingPluginId, setUpdatingPluginId] = useState<string | null>(null);
  const [launchingGuidePluginId, setLaunchingGuidePluginId] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<PluginInstallResult | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<PluginRuntimeStatus | null>(null);
  const guideLaunchInFlightRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let statusLoaded = false;
    let lastStatus: PluginRuntimeStatus | null = null;
    const electron = window.electron as typeof window.electron & {
      invoke: (channel: string, ...args: unknown[]) => Promise<PluginRuntimeStatus>;
    };
    void electron.invoke("plugins:getOpenComputerUseStatus")
      .then((status) => {
        statusLoaded = true;
        lastStatus = status as PluginRuntimeStatus;
        if (mounted) setRuntimeStatus(status as PluginRuntimeStatus);
        return electron.invoke("plugins:checkOpenComputerUseUpdate");
      })
      .then((status) => {
        if (mounted) setRuntimeStatus(status as PluginRuntimeStatus);
      })
      .catch((error) => {
        if (!mounted) return;
        if (!statusLoaded) {
          setRuntimeStatus({ installed: false, connected: false });
          return;
        }
        setRuntimeStatus({
          installed: lastStatus?.installed ?? false,
          connected: lastStatus?.connected ?? false,
          version: lastStatus?.version,
          latestVersion: lastStatus?.latestVersion,
          updateAvailable: false,
          updateStatus: "error",
          updateError: error instanceof Error ? error.message : String(error),
          updateCheckedAt: Date.now(),
          permissions: lastStatus?.permissions,
        });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleInstall = (plugin: DefaultPlugin) => {
    void (async () => {
      setInstallingPluginId(plugin.id);
      setInstallResult(null);
      try {
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke("plugins:installOpenComputerUse") as PluginInstallResult;
        setInstallResult(result);
        showPluginActionToast(result);
        setRuntimeStatus({
          installed: result.installed,
          connected: result.connected,
          version: result.version,
          latestVersion: result.latestVersion,
          updateAvailable: result.updateAvailable,
          updateStatus: result.updateStatus,
          updateError: result.updateError,
          updateCheckedAt: result.updateCheckedAt,
          permissions: result.permissions,
        });
      } catch (error) {
        const result: PluginInstallResult = {
          success: false,
          installed: false,
          connected: false,
          message: "插件安装请求失败。",
          error: error instanceof Error ? error.message : String(error),
        };
        setInstallResult(result);
        showPluginActionToast(result);
      } finally {
        setInstallingPluginId(null);
      }
    })();
  };

  const handleCheckUpdate = (plugin: DefaultPlugin) => {
    void (async () => {
      setCheckingUpdatePluginId(plugin.id);
      try {
        const status = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginRuntimeStatus>;
        }).invoke("plugins:checkOpenComputerUseUpdate") as PluginRuntimeStatus;
        setRuntimeStatus(status);
      } catch (error) {
        setRuntimeStatus((current) => ({
          installed: current?.installed ?? false,
          connected: current?.connected ?? false,
          version: current?.version,
          latestVersion: current?.latestVersion,
          updateAvailable: false,
          updateStatus: "error",
          updateError: error instanceof Error ? error.message : String(error),
          updateCheckedAt: Date.now(),
          permissions: current?.permissions,
        }));
      } finally {
        setCheckingUpdatePluginId(null);
      }
    })();
  };

  const handleUpdate = (plugin: DefaultPlugin) => {
    void (async () => {
      setUpdatingPluginId(plugin.id);
      setInstallResult(null);
      try {
        const result = await (window.electron as typeof window.electron & {
          invoke: (channel: string, ...args: unknown[]) => Promise<PluginInstallResult>;
        }).invoke("plugins:updateOpenComputerUse") as PluginInstallResult;
        setInstallResult(result);
        showPluginActionToast(result);
        setRuntimeStatus({
          installed: result.installed,
          connected: result.connected,
          version: result.version,
          latestVersion: result.latestVersion,
          updateAvailable: result.updateAvailable,
          updateStatus: result.updateStatus,
          updateError: result.updateError,
          updateCheckedAt: result.updateCheckedAt,
          permissions: result.permissions,
        });
      } catch (error) {
        const result: PluginInstallResult = {
          success: false,
          installed: runtimeStatus?.installed ?? true,
          connected: runtimeStatus?.connected ?? false,
          version: runtimeStatus?.version,
          latestVersion: runtimeStatus?.latestVersion,
          updateAvailable: false,
          updateStatus: "error",
          updateError: error instanceof Error ? error.message : String(error),
          updateCheckedAt: Date.now(),
          message: "插件更新请求失败。",
          error: error instanceof Error ? error.message : String(error),
        };
        setInstallResult(result);
        showPluginActionToast(result);
      } finally {
        setUpdatingPluginId(null);
      }
    })();
  };

  const handleStartGuideSession = (plugin: DefaultPlugin) => {
    if (!onStartGuideSession || guideLaunchInFlightRef.current) return;
    guideLaunchInFlightRef.current = true;
    setLaunchingGuidePluginId(plugin.id);
    void Promise.resolve(onStartGuideSession({
      title: "Open Computer Use 引导安装",
      prompt: buildOpenComputerUseGuidePrompt(runtimeStatus),
      agentId: "open-computer-use-guide",
      allowedTools: "Read,Edit,MultiEdit,Write,Bash,Glob,Search,TodoWrite",
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
          const connected = runtimeStatus?.connected === true || (installResult?.success && installResult.connected);
          const installed = runtimeStatus?.installed === true || installResult?.installed === true;
          const permissions = installResult?.permissions ?? runtimeStatus?.permissions;
          const needsPermission = Boolean(permissions?.required && permissions.needsUserAction);
          const updateAvailable = Boolean(runtimeStatus?.updateAvailable || installResult?.updateAvailable);
          const latestVersion = runtimeStatus?.latestVersion ?? installResult?.latestVersion;
          const updateStatus = runtimeStatus?.updateStatus ?? installResult?.updateStatus;
          const updateError = runtimeStatus?.updateError ?? installResult?.updateError;
          const status = updateAvailable && installed
            ? statusMeta["update-available"]
            : connected
            ? statusMeta.ready
            : needsPermission
              ? statusMeta["needs-permission"]
              : installed
                ? statusMeta["needs-connect"]
                : statusMeta["not-installed"];
          const actionLabel = updatingPluginId === plugin.id
            ? "更新中..."
            : installingPluginId === plugin.id
              ? "处理中..."
              : updateAvailable && installed
                ? "更新"
                : connected
              ? "重新检查"
              : needsPermission
                ? "授权"
                : installed
                  ? "接入"
                  : "安装";
          const updateHint = updateAvailable && latestVersion
            ? `发现新版本 v${latestVersion}`
            : updateStatus === "up-to-date" && latestVersion
              ? `已是最新 v${latestVersion}`
              : updateStatus === "error"
                ? `扫描失败：${updateError ?? "未知错误"}`
                : latestVersion
                  ? `最新 v${latestVersion}`
                  : "未扫描更新";
          const guideLabel = launchingGuidePluginId === plugin.id ? "启动中..." : "Agent 引导安装";
          const permissionHint = getPermissionHint(permissions);

          return (
            <article
              key={plugin.id}
              className="grid min-w-[1120px] grid-cols-[minmax(320px,1fr)_140px_130px_220px_170px] items-start gap-4 px-4 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-[#1D2129]">{plugin.name}</h3>
                  <span className="rounded-full border border-[#E5E6EB] bg-[#F7F8FA] px-2 py-0.5 text-xs font-semibold text-[#4E5969]">
                    v{runtimeStatus?.version ?? plugin.version}
                  </span>
                </div>
                <div className={`mt-1 text-xs font-semibold ${
                  updateAvailable
                    ? "text-amber-700"
                    : updateStatus === "error"
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
                <div className="truncate font-medium text-[#1D2129]">GitHub</div>
                <div className="mt-1 truncate text-xs">{plugin.sourcePath}</div>
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#0E7490]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {plugin.permissions.length} 项权限
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
                    if (updateAvailable && installed) {
                      handleUpdate(plugin);
                      return;
                    }
                    handleInstall(plugin);
                  }}
                  disabled={installingPluginId === plugin.id || updatingPluginId === plugin.id}
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
                  {checkingUpdatePluginId === plugin.id ? "扫描中..." : "扫描更新"}
                </button>
                {onStartGuideSession && (
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
