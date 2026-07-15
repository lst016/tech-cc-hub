import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Image, Plus, Settings2, X } from "lucide-react";
import { AppModalOverlay } from "../AppModalOverlay";
import {
  DEFAULT_IMAGE_GENERATION_CONFIG,
  type ImageGenerationConfig,
} from "./image-generation-plugin";

const ASPECT_RATIOS: ImageGenerationConfig["aspectRatio"][] = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"];

function getDimensions(aspectRatio: ImageGenerationConfig["aspectRatio"], resolution: ImageGenerationConfig["resolution"]) {
  const base = resolution === "4K" ? 2 : 1;
  const dimensions: Record<ImageGenerationConfig["aspectRatio"], [number, number]> = {
    "16:9": [2848 * base, 1600 * base],
    "4:3": [2304 * base, 1728 * base],
    "1:1": [2048 * base, 2048 * base],
    "3:4": [1728 * base, 2304 * base],
    "9:16": [1600 * base, 2848 * base],
    "21:9": [3136 * base, 1344 * base],
  };
  return dimensions[aspectRatio];
}

export function ImageGenerationPluginMenu({
  disabled,
  onInsert,
  onInsertVisualization,
}: {
  disabled?: boolean;
  onInsert: () => void;
  onInsertVisualization: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-surface-secondary hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="添加插件"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="h-[19px] w-[19px]" aria-hidden="true" />
      </button>
      {open && !disabled && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-40 rounded-xl border border-black/6 bg-surface p-1.5 shadow-[0_18px_50px_rgba(22,24,29,0.14)]">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink-900 transition hover:bg-accent-subtle hover:text-accent"
            onClick={() => {
              onInsert();
              setOpen(false);
            }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent-subtle text-accent"><Image className="h-4 w-4" /></span>
            <span>生图</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-ink-900 transition hover:bg-accent-subtle hover:text-accent"
            onClick={() => {
              onInsertVisualization();
              setOpen(false);
            }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-md bg-violet-50 text-violet-600"><BarChart3 className="h-4 w-4" /></span>
            <span>可视化</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function ImageGenerationPluginChip({ onConfigure, onRemove }: { onConfigure: () => void; onRemove: () => void }) {
  return (
    <span className="mx-1 inline-flex select-none items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 align-baseline text-[14px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
      <button type="button" className="inline-flex items-center gap-1 outline-none" onClick={onConfigure} contentEditable={false}>
        <Image className="h-3.5 w-3.5" aria-hidden="true" />
        生图
        <Settings2 className="h-3 w-3" aria-hidden="true" />
      </button>
      <button type="button" aria-label="移除生图插件" className="rounded-sm p-0.5 hover:bg-blue-100" onClick={onRemove} contentEditable={false}>
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
    </span>
  );
}

export function ImageGenerationConfigDialog({ config, onCancel, onSave }: { config: ImageGenerationConfig; onCancel: () => void; onSave: (config: ImageGenerationConfig) => void }) {
  const [draft, setDraft] = useState(config);
  const updateAspectRatio = (aspectRatio: ImageGenerationConfig["aspectRatio"]) => {
    const [width, height] = getDimensions(aspectRatio, draft.resolution);
    setDraft((current) => ({ ...current, aspectRatio, width, height }));
  };
  const updateResolution = (resolution: ImageGenerationConfig["resolution"]) => {
    const [width, height] = getDimensions(draft.aspectRatio, resolution);
    setDraft((current) => ({ ...current, resolution, width, height }));
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AppModalOverlay className="z-[100] grid place-items-center bg-ink-900/35 p-5" role="presentation" onMouseDown={onCancel}>
      <section className="w-full max-w-[560px] rounded-2xl border border-black/6 bg-surface p-6 shadow-[0_24px_80px_rgba(22,24,29,0.24)]" role="dialog" aria-modal="true" aria-label="生图配置" data-keep-prompt-composer-visible="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div><h2 className="text-[18px] font-semibold text-ink-900">生图配置</h2><p className="mt-1 text-[13px] text-muted">本次发送将使用以下参数；不调整时使用默认值。</p></div>
          <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-surface-secondary" aria-label="关闭配置" onClick={onCancel}><X className="h-5 w-5" /></button>
        </header>
        <div className="grid gap-5">
          <fieldset><legend className="mb-2 text-[14px] font-medium text-ink-800">选择比例</legend><div className="grid grid-cols-3 gap-2">{ASPECT_RATIOS.map((ratio) => <button key={ratio} type="button" className={`h-9 rounded-lg border text-[13px] font-medium transition ${draft.aspectRatio === ratio ? "border-accent/40 bg-accent-subtle text-accent" : "border-black/8 text-ink-600 hover:bg-surface-secondary"}`} onClick={() => updateAspectRatio(ratio)}>{ratio}</button>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-[14px] font-medium text-ink-800">选择分辨率</legend><div className="flex gap-2">{(["2K", "4K"] as const).map((resolution) => <button key={resolution} type="button" className={`h-9 rounded-lg border px-4 text-[13px] font-medium transition ${draft.resolution === resolution ? "border-accent/40 bg-accent-subtle text-accent" : "border-black/8 text-ink-600 hover:bg-surface-secondary"}`} onClick={() => updateResolution(resolution)}>{resolution === "2K" ? "高清 2K" : "超清 4K"}</button>)}</div></fieldset>
          <fieldset><legend className="mb-2 text-[14px] font-medium text-ink-800">尺寸</legend><div className="flex items-center gap-2"><label className="flex h-10 items-center gap-2 rounded-lg border border-black/8 px-3 text-[13px] text-muted">W<input aria-label="宽度" className="w-20 text-right text-ink-900 outline-none" type="number" value={draft.width} onChange={(event) => setDraft((current) => ({ ...current, width: Number(event.target.value) || current.width }))} /></label><span className="text-muted">×</span><label className="flex h-10 items-center gap-2 rounded-lg border border-black/8 px-3 text-[13px] text-muted">H<input aria-label="高度" className="w-20 text-right text-ink-900 outline-none" type="number" value={draft.height} onChange={(event) => setDraft((current) => ({ ...current, height: Number(event.target.value) || current.height }))} /></label><span className="text-[13px] text-muted">PX</span></div></fieldset>
          <fieldset><legend className="mb-2 text-[14px] font-medium text-ink-800">选择图片数量</legend><div className="flex items-center gap-4"><input aria-label="图片数量滑块" className="h-1.5 flex-1 accent-[var(--color-accent)]" type="range" min="1" max="4" value={draft.count} onChange={(event) => setDraft((current) => ({ ...current, count: Number(event.target.value) }))} /><label className="flex h-9 items-center gap-1 rounded-lg border border-black/8 px-2 text-[13px]"><input aria-label="图片数量" className="w-8 text-center outline-none" type="number" min="1" max="4" value={draft.count} onChange={(event) => setDraft((current) => ({ ...current, count: Math.min(4, Math.max(1, Number(event.target.value) || 1)) }))} />张</label></div></fieldset>
        </div>
        <footer className="mt-7 flex justify-end gap-2"><button type="button" className="h-9 rounded-lg px-4 text-[13px] font-medium text-ink-600 hover:bg-surface-secondary" onClick={onCancel}>取消</button><button type="button" className="h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-white hover:bg-accent-hover" onClick={() => onSave(draft)}>保存配置</button></footer>
      </section>
    </AppModalOverlay>,
    document.body,
  );
}

export { DEFAULT_IMAGE_GENERATION_CONFIG };
