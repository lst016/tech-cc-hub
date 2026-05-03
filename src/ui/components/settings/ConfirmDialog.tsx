// Source: CV from skills-manager components/ConfirmDialog.tsx
import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  title?: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  tone?: "danger" | "warning";
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  message,
  details,
  confirmLabel,
  tone = "danger",
  onClose,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white border border-[#E5E6EB] rounded-xl w-full max-w-sm p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-[#1D2129] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            {title || "确认操作"}
          </h2>
          <button onClick={onClose} className="text-[#86909C] hover:text-[#4E5969] p-1 rounded transition-colors outline-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[13px] text-[#4E5969] mb-5">{message}</p>
        {details && details.length > 0 ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {details.map((detail) => (
              <span
                key={detail}
                className="rounded-full border border-[#E5E6EB] bg-[#F5F6F8] px-2.5 py-1 text-[13px] text-[#4E5969]"
              >
                {detail}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-[4px] text-[13px] font-medium text-[#4E5969] hover:text-[#1D2129] hover:bg-[#F2F3F5] transition-colors outline-none"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={
              tone === "warning"
                ? "px-3 py-1.5 rounded-[4px] bg-accent hover:bg-accent-hover text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-accent outline-none"
                : "px-3 py-1.5 rounded-[4px] bg-red-600/90 hover:bg-red-500 text-white text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/50 outline-none"
            }
          >
            {loading ? "处理中..." : confirmLabel || "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
