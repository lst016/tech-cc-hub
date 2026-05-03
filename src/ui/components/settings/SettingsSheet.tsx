import { useEffect, type ReactNode } from "react";

export type SettingsStatusTone = "error" | "success" | "info";

export type SettingsPageDefinition = {
  id: string;
  label: string;
  eyebrow?: string;
  title: string;
  description: string;
  summary?: string;
};

type SettingsSheetProps = {
  pages: SettingsPageDefinition[];
  activePageId: string;
  onPageChange: (pageId: string) => void;
  onClose: () => void;
  status?: {
    tone: SettingsStatusTone;
    message: string;
  } | null;
  footer: ReactNode;
  children: ReactNode;
};

const toneClasses: Record<SettingsStatusTone, string> = {
  error: "border-error/20 bg-error-light text-error",
  success: "border-success/20 bg-success-light text-success",
  info: "border-accent/20 bg-accent/8 text-ink-800",
};

const PAGE_ICONS: Record<string, ReactNode> = {
  profiles: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
  routing: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <path d="M7 13l5 5 5-5" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
    </svg>
  ),
  channels: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  plugins: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 3h8v5H8z" />
      <path d="M10 8v3" />
      <path d="M14 8v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M9 15h6" />
      <path d="M9 18h3" />
    </svg>
  ),
  skills: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  ),
  "global-json": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
    </svg>
  ),
  "agent-rules": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  ),
  "system-maintenance": (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
};

export function SettingsSheet({
  pages,
  activePageId,
  onPageChange,
  onClose,
  status,
  footer,
  children,
}: SettingsSheetProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[40000] flex overflow-hidden bg-[#F5F6F8] text-[#1D2129]">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#E5E6EB] bg-[#EEF0F3] px-5 py-7">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#111318] text-lg font-black text-white shadow-[0_14px_30px_rgba(17,19,24,0.16)]">
            T
          </div>
          <div>
            <div className="text-xl font-bold tracking-tight text-[#1D2129]">tech-cc-hub</div>
            <div className="mt-0.5 text-xs font-medium text-[#86909C]">Agent Workbench</div>
          </div>
        </div>

        <nav className="mt-10 min-h-0 flex-1 overflow-y-auto">
          <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8A94A6]">设置</div>
          <div className="space-y-1.5">
            {pages.map((page) => {
              const active = page.id === activePageId;
              return (
                <button
                  key={page.id}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition ${active ? "bg-[#DDE0E7] text-[#1D2129] shadow-[inset_0_0_0_1px_rgba(29,33,41,0.04)]" : "text-[#4E5969] hover:bg-white/70 hover:text-[#1D2129]"}`}
                  onClick={() => onPageChange(page.id)}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold ${active ? "border-[#C9CDD4] bg-white text-[#1D2129]" : "border-transparent bg-white/46 text-[#86909C]"}`}>
                    {PAGE_ICONS[page.id] ?? page.label.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{page.label}</span>
                    {page.summary && (
                      <span className="mt-0.5 block truncate text-xs text-[#86909C]">{page.summary}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-6">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl bg-[#DDE0E7] px-4 py-3 text-[15px] font-semibold text-[#1D2129] transition hover:bg-[#D3D7E0]"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 18 9 12l6-6" />
              <path d="M20 12H9" />
            </svg>
            返回聊天
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[1360px] flex-col px-10 pt-8">
          <section className="min-h-0 flex-1 pb-28">
            {status && (
              <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${toneClasses[status.tone]}`}>
                {status.message}
              </div>
            )}
            {children}
          </section>

          <footer className="sticky bottom-0 -mx-10 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E6EB] bg-[#F5F6F8]/92 px-10 py-4 backdrop-blur">
            <div className="text-xs text-[#86909C]">设置作为独立工作区展示，返回聊天后会保留当前会话上下文。</div>
            {footer}
          </footer>
        </div>
      </main>
    </div>
  );
}
