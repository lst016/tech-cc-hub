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
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

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
    <>
      <div className="fixed inset-0 z-50 bg-ink-900/28 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pt-14">
        <div
          className="mx-auto flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-ink-900/8 bg-[linear-gradient(180deg,rgba(252,253,255,0.98),rgba(244,247,251,0.98))] shadow-[0_-28px_80px_rgba(24,32,46,0.16)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-center pt-3">
            <div className="h-1.5 w-14 rounded-full bg-ink-900/10" />
          </div>

          <div className="flex items-start justify-between gap-4 border-b border-ink-900/8 px-6 pb-5 pt-4 sm:px-8">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold tracking-[0.18em] text-muted">SETTINGS</div>
              <div className="mt-2">
                <div className="text-xl font-semibold text-ink-900">{title}</div>
                <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
              </div>
            </div>

            <button
              type="button"
              className="rounded-full p-2 text-muted transition-colors hover:bg-white hover:text-ink-700"
              onClick={onClose}
              aria-label="关闭设置"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border-b border-ink-900/8 bg-white/58 px-4 py-4 lg:border-b-0 lg:border-r lg:px-5 lg:py-5">
              <div className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-2 lg:overflow-visible lg:pb-0">
                {pages.map((page) => {
                  const active = page.id === activePageId;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      className={`min-w-[180px] rounded-2xl border px-4 py-3 text-left transition-all lg:min-w-0 ${active ? "border-accent/24 bg-[linear-gradient(180deg,rgba(255,244,239,0.92),rgba(255,255,255,0.98))] shadow-[0_16px_30px_rgba(210,106,61,0.10)]" : "border-ink-900/8 bg-white/76 hover:border-ink-900/14 hover:bg-white"}`}
                      onClick={() => onPageChange(page.id)}
                    >
                      {page.eyebrow && (
                        <div className="text-[10px] font-semibold tracking-[0.16em] text-muted">{page.eyebrow}</div>
                      )}
                      <div className="mt-1 text-sm font-semibold text-ink-900">{page.label}</div>
                      {page.summary && (
                        <div className="mt-1 text-[11px] leading-5 text-muted">{page.summary}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="border-b border-ink-900/8 px-6 py-5 sm:px-8">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-muted">{activePage?.eyebrow || "PAGE"}</div>
                <div className="mt-2 text-lg font-semibold text-ink-900">{activePage?.title}</div>
                <p className="mt-1 text-sm leading-6 text-muted">{activePage?.description}</p>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
                {status && (
                  <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${toneClasses[status.tone]}`}>
                    {status.message}
                  </div>
                )}
                {children}
              </div>
            </section>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-900/8 px-6 py-4 sm:px-8">
            <div className="text-xs text-muted">
              这是通用设置骨架。后续新增配置页时，只需要挂一个新页面定义和对应内容组件。
            </div>
            {footer}
          </div>
        </div>
      </div>
    </>
  );
}
