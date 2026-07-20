import { useEffect, useId, useRef, useState } from "react";
import { Logout, Right, SettingTwo, SpeedOne } from "@icon-park/react";

export type WooAuthState = {
  status: "anonymous" | "authenticated";
  user: {
    universalUserId: string;
    realName?: string;
    userHandle?: string;
    userEmail?: string;
    avatarUrl?: string;
  } | null;
  loginMethods: {
    password: boolean;
    email: boolean;
    thirdParty: boolean;
  } | null;
  error?: string;
};

type WooAuthDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStateChange: (state: WooAuthState) => void;
  onOpenSettings?: () => void;
};

const anonymousState: WooAuthState = {
  status: "anonymous",
  user: null,
  loginMethods: null,
};

function getWooAuthInvoke() {
  return window.electron.invoke as (channel: string, input?: unknown) => Promise<unknown>;
}

type WooAvatarUser = {
  realName?: string;
  userHandle?: string;
  avatarUrl?: string;
} | null;

export function WooAvatar({ user, size = "large" }: { user: WooAvatarUser; size?: "menu" | "small" | "large" }) {
  const className = size === "large" ? "h-10 w-10 text-sm" : size === "small" ? "h-8 w-8 text-xs" : "h-7 w-7 text-xs";
  const avatarUrl = user?.avatarUrl?.trim() ?? "";
  const [failedUrl, setFailedUrl] = useState("");
  if (avatarUrl && failedUrl !== avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        data-woo-avatar
        className={`${className} shrink-0 rounded-full object-cover`}
        onError={() => setFailedUrl(avatarUrl)}
      />
    );
  }
  return (
    <span data-woo-avatar-fallback className={`${className} flex shrink-0 items-center justify-center rounded-full bg-ink-900/10 font-semibold text-ink-600`}>
      {(user?.realName || user?.userHandle || "W").slice(0, 1).toUpperCase()}
    </span>
  );
}

const WOO_USAGE_URL = "https://dream.pocketcity.com/user";
const accountMenuItemClass = "flex h-[42px] w-full items-center gap-3 rounded-[13px] px-3 text-left text-[15px] font-medium text-[#292d32] transition-colors hover:bg-[#ededed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25";
const accountMenuIconProps = {
  theme: "outline" as const,
  size: 20,
  fill: "currentColor",
  strokeWidth: 2.4,
};

export function WooAuthDialog({ open, onOpenChange, onStateChange, onOpenSettings }: WooAuthDialogProps) {
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"password" | "email">("password");
  const [state, setState] = useState<WooAuthState>(anonymousState);
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [mail, setMail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-woo-auth-trigger]")) return;
      onOpenChange(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    const focusFrame = window.requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    });
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessage("");
      try {
        const result = await getWooAuthInvoke()("woo-auth:get-login-methods") as WooAuthState;
        if (cancelled) return;
        setState(result);
        onStateChange(result);
        if (result.loginMethods?.email && !result.loginMethods.password) setMode("email");
        if (result.loginMethods?.password && !result.loginMethods.email) setMode("password");
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "无法读取 Woo 登录配置。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [onStateChange, open]);

  const handlePasswordLogin = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await getWooAuthInvoke()("woo-auth:login-password", { userName, password }) as WooAuthState;
      setState(result);
      onStateChange(result);
      setPassword("");
      if (result.status === "authenticated") onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Woo 密码登录失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleSendCode = async () => {
    setBusy(true);
    setMessage("");
    try {
      await getWooAuthInvoke()("woo-auth:send-email-code", { mail });
      setMessage("验证码已发送，请查收邮箱。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证码发送失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleEmailLogin = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await getWooAuthInvoke()("woo-auth:login-email", { mail, code }) as WooAuthState;
      setState(result);
      onStateChange(result);
      setCode("");
      if (result.status === "authenticated") onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Woo 邮箱登录失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleThirdPartyLogin = async () => {
    setBusy(true);
    setMessage("已打开浏览器，请在浏览器中完成 Woo 登录。");
    try {
      const result = await getWooAuthInvoke()("woo-auth:login-third-party") as WooAuthState;
      setState(result);
      onStateChange(result);
      if (result.status === "authenticated") onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Woo 第三方登录失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await getWooAuthInvoke()("woo-auth:logout") as WooAuthState;
      setState(result);
      onStateChange(result);
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Woo 账号退出失败。");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenUsage = async () => {
    setMessage("");
    try {
      const result = await getWooAuthInvoke()("shell:openExternal", WOO_USAGE_URL) as { success?: boolean; error?: string };
      if (result?.success === false) throw new Error(result.error || "无法打开剩余用量页面。");
      onOpenChange(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法打开剩余用量页面。");
    }
  };

  if (!open) return null;
  const allowPassword = state.loginMethods?.password !== false;
  const allowEmail = state.loginMethods?.email !== false;
  const allowThirdParty = state.loginMethods?.thirdParty === true;
  const hasLoginMethod = allowPassword || allowEmail || allowThirdParty;
  const authenticatedMenu = !loading && state.status === "authenticated";
  const displayName = state.user?.realName || state.user?.userHandle || "Woo 用户";

  return (
    <div
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={state.status === "authenticated" ? "Woo 账号" : "登录 Woo 账号"}
      tabIndex={-1}
      data-woo-auth-popover
      className={`absolute bottom-full left-0 right-0 z-[160] outline-none ${authenticatedMenu
        ? "mb-3.5 overflow-hidden rounded-[18px] border border-[#d3d7dc] bg-[#fcfcfc] p-1.5 shadow-[0_14px_36px_rgba(31,41,55,0.14)]"
        : "mb-2 max-h-[min(560px,calc(100vh-88px))] overflow-y-auto rounded-xl border border-black/10 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.2)]"
      }`}
    >
      {!authenticatedMenu && <div className="flex items-start justify-between gap-3 border-b border-black/8 px-3.5 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink-900">
            {state.status === "authenticated" ? "Woo 账号" : "登录 Woo 账号"}
          </h2>
          {state.status === "anonymous" && (
            <p className="mt-0.5 text-[11px] leading-4 text-muted">登录后使用 Woo 项目授权与元数据能力</p>
          )}
        </div>
        <button
          type="button"
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-black/5 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          onClick={() => onOpenChange(false)}
          aria-label="关闭 Woo 账号面板"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>}

      {loading ? (
        <div className="space-y-3 px-3.5 py-4" aria-label="正在加载 Woo 账号">
          <div className="h-8 animate-pulse rounded-lg bg-black/5" />
          <div className="h-9 animate-pulse rounded-lg bg-black/5" />
          <div className="h-9 animate-pulse rounded-lg bg-black/5" />
        </div>
      ) : state.status === "authenticated" ? (
        <div>
          <div className="flex h-12 items-center gap-2.5 px-3">
            <WooAvatar user={state.user} size="menu" />
            <div className="min-w-0 flex-1 truncate text-[15px] font-medium text-[#202428]">
              {displayName}
            </div>
          </div>
          <div className="mx-3 h-px bg-black/8" />
          <div className="mt-1 space-y-0.5" role="menu" aria-label="Woo 账号菜单">
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleOpenUsage()}
              className={`${accountMenuItemClass} bg-[#ededed]`}
            >
              <SpeedOne {...accountMenuIconProps} className="shrink-0 text-[#5b6168]" />
              <span className="min-w-0 flex-1 truncate">剩余用量</span>
              <Right theme="outline" size={18} fill="currentColor" strokeWidth={2.2} className="shrink-0 text-[#757b81]" />
            </button>
            <button
              type="button"
              role="menuitem"
              className={accountMenuItemClass}
              onClick={() => {
                onOpenChange(false);
                onOpenSettings?.();
              }}
            >
              <SettingTwo {...accountMenuIconProps} className="shrink-0 text-[#5b6168]" />
              <span className="min-w-0 flex-1 truncate">设置</span>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void handleLogout()}
              className={`${accountMenuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Logout {...accountMenuIconProps} className="shrink-0 text-[#5b6168]" />
              <span className="min-w-0 flex-1 truncate">{busy ? "正在退出..." : "退出登录"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5">
          {allowThirdParty && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleThirdPartyLogin()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M11.5 4H16v4.5M9 11l7-7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 11v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {busy ? "等待浏览器登录..." : "使用浏览器登录 Woo"}
            </button>
          )}

          {allowThirdParty && (allowPassword || allowEmail) && (
            <div className="my-3 flex items-center gap-2 text-[11px] text-muted" aria-hidden="true">
              <span className="h-px flex-1 bg-black/8" />
              <span>或</span>
              <span className="h-px flex-1 bg-black/8" />
            </div>
          )}

          {allowPassword && allowEmail && (
            <div className="mb-3 flex rounded-lg bg-ink-900/5 p-1">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${mode === "password" ? "bg-white font-medium text-ink-900 shadow-sm" : "text-muted hover:text-ink-800"}`}
              >
                密码登录
              </button>
              <button
                type="button"
                onClick={() => setMode("email")}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${mode === "email" ? "bg-white font-medium text-ink-900 shadow-sm" : "text-muted hover:text-ink-800"}`}
              >
                邮箱验证码
              </button>
            </div>
          )}

          {mode === "password" && allowPassword && (
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void handlePasswordLogin(); }}>
              <label className="block text-xs font-medium text-ink-700">
                用户名
                <input
                  value={userName}
                  onChange={(event) => setUserName(event.target.value)}
                  autoComplete="username"
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block text-xs font-medium text-ink-700">
                密码
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !userName.trim() || !password}
                className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "正在登录..." : "登录"}
              </button>
            </form>
          )}

          {mode === "email" && allowEmail && (
            <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void handleEmailLogin(); }}>
              <label className="block text-xs font-medium text-ink-700">
                邮箱
                <input
                  value={mail}
                  onChange={(event) => setMail(event.target.value)}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                <label className="min-w-0 text-xs font-medium text-ink-700">
                  验证码
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    inputMode="numeric"
                    className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/10"
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !mail.trim()}
                  onClick={() => void handleSendCode()}
                  className="h-[38px] shrink-0 rounded-lg border border-black/10 px-2.5 text-xs font-medium text-ink-700 transition-colors hover:bg-black/4 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  发送验证码
                </button>
              </div>
              <button
                type="submit"
                disabled={busy || !mail.trim() || !code.trim()}
                className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "正在登录..." : "登录"}
              </button>
            </form>
          )}

          {!hasLoginMethod && !message && (
            <p className="rounded-lg bg-ink-900/5 px-3 py-2 text-xs leading-5 text-ink-700">当前 Woo 配置未启用可用登录方式。</p>
          )}
        </div>
      )}

      {message && (
        <p className="mx-3.5 mb-3.5 rounded-lg bg-ink-900/5 px-3 py-2 text-xs leading-5 text-ink-700" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
