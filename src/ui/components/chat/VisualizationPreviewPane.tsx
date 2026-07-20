import { useState } from "react";
import { Globe, RotateCw, X } from "lucide-react";
import type { OpenVisualizationPreviewDetail } from "../../events";
import { TechccVisualizationFrame } from "./TechccVisualizationFrame";

export function VisualizationPreviewPane({
  preview,
  onClose,
}: {
  preview: OpenVisualizationPreviewDetail;
  onClose: () => void;
}) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <section className="flex h-full min-h-0 flex-col bg-white" aria-label={`网页预览：${preview.title}`}>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#e5e7eb] bg-white px-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#f2f5f7] text-[#63cdf3]" aria-hidden="true">
          <Globe className="h-[18px] w-[18px]" strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-5 text-[#24272b]">{preview.title}</span>
          <span className="block truncate text-[11px] leading-4 text-[#8b9096]">{preview.fileName}</span>
        </span>
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          aria-label="重新加载网页预览"
          title="重新加载"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#6f747a] transition hover:bg-[#f1f3f5] hover:text-[#282b2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63cdf3]/35"
        >
          <RotateCw className="h-4 w-4" strokeWidth={1.9} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭网页预览"
          title="关闭"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#6f747a] transition hover:bg-[#f1f3f5] hover:text-[#282b2f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63cdf3]/35"
        >
          <X className="h-4 w-4" strokeWidth={1.9} />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto bg-[#f7f8fb]">
        <TechccVisualizationFrame
          sessionId={preview.sessionId}
          fileName={preview.fileName}
          title={preview.title}
          onFollowUp={preview.onFollowUp}
          reloadKey={reloadKey}
        />
      </div>
    </section>
  );
}
