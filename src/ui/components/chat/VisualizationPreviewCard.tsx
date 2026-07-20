import { memo } from "react";
import { ChevronDown, Globe } from "lucide-react";
import type { TechccVisualizationFollowUp } from "../../../shared/techcc-visualization-protocol";
import {
  OPEN_VISUALIZATION_PREVIEW_EVENT,
  type OpenVisualizationPreviewDetail,
} from "../../events";

export type VisualizationPreviewCardProps = {
  sessionId: string;
  fileName: string;
  title: string;
  onFollowUp?: (request: Omit<TechccVisualizationFollowUp, "type">) => void | Promise<void>;
};

export const VisualizationPreviewCard = memo(function VisualizationPreviewCard({
  sessionId,
  fileName,
  title,
  onFollowUp,
}: VisualizationPreviewCardProps) {
  const openPreview = () => {
    window.dispatchEvent(new CustomEvent<OpenVisualizationPreviewDetail>(OPEN_VISUALIZATION_PREVIEW_EVENT, {
      detail: { sessionId, fileName, title, onFollowUp },
    }));
  };

  return (
    <section
      className="rounded-[16px] border border-[#e4e6e9] bg-white px-[18px] py-[18px] shadow-none"
      aria-label={`网页预览：${title}`}
      data-techcc-visualization={fileName}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-[14px] bg-[#f4f5f6] text-[#63cdf3]" aria-hidden="true">
          <Globe className="h-8 w-8" strokeWidth={2.15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[18px] font-semibold leading-6 text-[#202124]">网页预览</span>
          <span className="mt-0.5 block truncate text-[15px] leading-5 text-[#8a8d91]">网站</span>
        </span>
        <button
          type="button"
          onClick={openPreview}
          title={`在右侧打开 ${title}`}
          aria-label={`在右侧打开 ${title}`}
          className="inline-flex h-[42px] min-w-[136px] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-[#e3e5e8] bg-white px-3.5 text-[16px] font-medium text-[#303236] transition-colors hover:border-[#cfd3d8] hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63cdf3]/35"
        >
          <span>打开方式</span>
          <ChevronDown className="h-4 w-4 text-[#92969b]" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
});
