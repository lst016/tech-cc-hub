import { useEffect, useState } from "react";
import type { AppUpdateStatus } from "../types";

export function UpdateToast() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [dismissedState, setDismissedState] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = window.electron.onAppUpdateStatus((next) => {
      if (next.status === "available" || next.status === "downloaded") {
        if (dismissedState === next.status) return;
        setStatus(next);
        setVisible(true);
        const timer = window.setTimeout(() => setVisible(false), 8000);
        return () => window.clearTimeout(timer);
      }
    });
    return unsubscribe;
  }, [dismissedState]);

  if (!visible || !status) return null;

  const isDownloaded = status.status === "downloaded";
  const message = isDownloaded
    ? `新版本已下载完成，点击重启安装`
    : `发现新版本 v${status.version ?? "?"}，可下载安装`;

  const handleAction = async () => {
    if (isDownloaded) {
      await window.electron.installAppUpdate();
    } else {
      await window.electron.downloadAppUpdate();
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    setDismissedState(status.status);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[50000] animate-[slideUp_0.3s_ease-out]">
      <div className="flex items-center gap-4 rounded-2xl border border-ink-900/10 bg-white/95 px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isDownloaded ? "bg-emerald-500" : "bg-accent"}`} />
          <span className="text-sm font-medium text-ink-800">{message}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${
              isDownloaded ? "bg-emerald-600 hover:bg-emerald-700" : "bg-accent hover:bg-accent-hover"
            }`}
            onClick={handleAction}
          >
            {isDownloaded ? "重启安装" : "下载"}
          </button>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-400 transition hover:bg-ink-900/10"
            onClick={handleDismiss}
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
