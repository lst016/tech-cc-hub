import { useEffect, useRef, useState } from "react";

export type InlineOption = {
  value: string;
  label: string;
};

export function InlineDropdown({
  label,
  value,
  options,
  disabled,
  onChange,
  minWidthClass,
}: {
  label: string;
  value: string;
  options: InlineOption[];
  disabled: boolean;
  minWidthClass: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const displayLabel = options.find((option) => option.value === value)?.label ?? (options[0]?.label ?? "请选择");

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex h-8 ${minWidthClass} items-center justify-between gap-1 rounded-xl bg-white px-2 text-xs text-ink-700`}
    >
      <span
        className={`whitespace-nowrap text-muted ${disabled ? "" : "cursor-pointer select-none"}`}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
      >
        {label}
      </span>
      <button
        type="button"
        className={`inline-flex h-7 min-w-[58px] items-center justify-between gap-1 rounded-lg bg-white px-2 text-[13px] text-ink-800 transition ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-secondary"}`}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        <span className="max-w-[58px] truncate">{displayLabel}</span>
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""} text-ink-500`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="absolute right-0 bottom-full z-20 mb-2 w-full overflow-hidden rounded-xl border border-black/12 bg-white/98 shadow-lg">
          <div className="max-h-40 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`flex h-9 w-full items-center px-3 text-left text-sm transition ${option.value === value ? "bg-accent-subtle text-accent" : "text-ink-800 hover:bg-surface-secondary"}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
