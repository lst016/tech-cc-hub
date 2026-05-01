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
  title: string;
  description: string;
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

export function SettingsSheet({
  title,
  description,
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
                    {page.label.slice(0, 1).toUpperCase()}
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
        <div className="mx-auto flex min-h-full w-full max-w-[1360px] flex-col px-10 py-12">
          <header className="border-b border-[#E5E6EB] pb-6">
            <div className="text-[13px] font-semibold tracking-[0.16em] text-[#86909C]">SETTINGS</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#1D2129]">{title}</h1>
            <p className="mt-2 max-w-3xl text-base leading-7 text-[#6B778C]">{description}</p>
          </header>

          <section className="min-h-0 flex-1 py-7 pb-28">
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
