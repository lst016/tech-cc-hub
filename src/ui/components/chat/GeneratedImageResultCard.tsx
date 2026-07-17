// 生图结果卡片：把 image_generate 的成功结果渲染成图片缩略图 + 元数据 + 动作。
// 详见 .omx/plans/2026-07-10-image-generation-integration.md §9.3 / §9.4。
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Copy,
  Download,
  FolderOpen,
  ImageIcon,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import type { GeneratedImageArtifactLite } from "../../utils/generated-image-result";
import { buildContinueEditingReference } from "../../utils/generated-image-result";
import { copyTextToClipboard as copyText } from "../../utils/clipboard";
import {
  OPEN_WORKSPACE_PLUGIN_EVENT,
  PREVIEW_OPEN_FILE_EVENT,
  PROMPT_FOCUS_EVENT,
  type OpenWorkspacePluginDetail,
} from "../../events";
import { useAppStore } from "../../store/useAppStore";
import { AppModalOverlay } from "../AppModalOverlay";

type GeneratedImageResultCardProps = {
  mode: "generate" | "edit";
  model?: string;
  profileName?: string;
  artifacts: GeneratedImageArtifactLite[];
  outputHint?: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "loaded"; src: string }
  | { status: "missing" }
  | { status: "error"; message: string };

function getImagePreviewCwd(absolutePath: string): string {
  const separatorIndex = Math.max(absolutePath.lastIndexOf("/"), absolutePath.lastIndexOf("\\"));
  return separatorIndex > 0 ? absolutePath.slice(0, separatorIndex) : ".";
}

function useImageDataUrl(absolutePath: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await window.electron.readPreviewFile({
          cwd: getImagePreviewCwd(absolutePath),
          path: absolutePath,
        });
        if (cancelled) return;
        if (result.success && typeof result.content === "string" && result.content.startsWith("data:")) {
          setState({ status: "loaded", src: result.content });
        } else {
          // 文件不存在或读取失败：局部降级，不让整个 EventCard 崩溃
          setState({ status: "missing" });
        }
      } catch (error) {
        if (cancelled) return;
        setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [absolutePath]);

  return state;
}

function GeneratedImageThumb({ artifact }: { artifact: GeneratedImageArtifactLite }) {
  const loadState = useImageDataUrl(artifact.path);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const metaParts: string[] = [];
  if (artifact.width && artifact.height) {
    metaParts.push(`${artifact.width}×${artifact.height}`);
  }
  if (artifact.mimeType) {
    metaParts.push(artifact.mimeType.replace("image/", "").toUpperCase());
  }
  if (artifact.sizeBytes) {
    metaParts.push(formatBytes(artifact.sizeBytes));
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div
        className="relative grid place-items-center overflow-hidden rounded-xl bg-[#242831]"
        style={{ minHeight: 260 }}
      >
        {loadState.status === "loading" && (
          <span className="text-xs text-white/60">加载中…</span>
        )}
        {loadState.status === "missing" && (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-white/55">
            <ImageIcon className="h-7 w-7" strokeWidth={1.6} />
            <span className="text-xs">图片文件已移动或删除</span>
          </div>
        )}
        {loadState.status === "error" && (
          <span className="text-xs text-red-300">加载失败</span>
        )}
        {loadState.status === "loaded" && (
          <button
            type="button"
            className="flex w-full cursor-zoom-in items-center justify-center p-4"
            onClick={() => setLightboxOpen(true)}
            aria-label="查看生成图片大图"
          >
            <img
              src={loadState.src}
              alt="生成图片"
              className="max-h-[520px] max-w-full rounded-lg object-contain shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
            />
          </button>
        )}
      </div>

      <div className="flex min-h-5 flex-wrap items-center gap-x-2 text-xs text-muted">
        {metaParts.length > 0 ? metaParts.map((part, index) => (
          <span key={part} className="inline-flex items-center gap-2">
            {index > 0 && <span className="text-black/20">·</span>}
            {part}
          </span>
        )) : <span>图片文件</span>}
      </div>

      {artifact.revisedPrompt && (
        <p className="line-clamp-2 text-xs leading-5 text-muted">{artifact.revisedPrompt}</p>
      )}

      <div className="flex flex-wrap items-center gap-1 border-t border-black/8 pt-2">
        {loadState.status === "loaded" && (
          <ToolbarButton icon={Download} onClick={() => downloadImage(loadState.src, artifact.path)}>下载</ToolbarButton>
        )}
        <ToolbarButton icon={Pencil} onClick={openCanvasEditor}>在画布中编辑</ToolbarButton>
        <ToolbarButton icon={FolderOpen} onClick={() => openFile(artifact.path)}>打开文件</ToolbarButton>
        <MoreActionsMenu artifactPath={artifact.path} />
      </div>

      {loadState.status === "loaded" && lightboxOpen && (
        <Lightbox src={loadState.src} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}

type ToolbarButtonProps = {
  icon: typeof Download;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ icon: Icon, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-700 transition-colors hover:bg-black/5 hover:text-ink"
      onClick={onClick}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      {children}
    </button>
  );
}

function MoreActionsMenu({ artifactPath }: { artifactPath: string }) {
  return (
    <details className="group relative">
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-700 transition-colors hover:bg-black/5 hover:text-ink [&::-webkit-details-marker]:hidden">
        <MoreHorizontal className="h-4 w-4" strokeWidth={1.8} />
        更多
      </summary>
      <div className="absolute bottom-10 left-0 z-20 min-w-32 overflow-hidden rounded-xl border border-black/10 bg-white p-1 shadow-[0_12px_32px_rgba(15,23,42,0.16)]">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-ink-700 hover:bg-black/5"
          onClick={() => openContainingFolder(artifactPath)}
        >
          <FolderOpen className="h-4 w-4" strokeWidth={1.8} />
          所在目录
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-ink-700 hover:bg-black/5"
          onClick={() => void copyText(artifactPath)}
        >
          <Copy className="h-4 w-4" strokeWidth={1.8} />
          复制路径
        </button>
      </div>
    </details>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AppModalOverlay
      className="z-50 grid h-dvh w-dvw place-items-center bg-black/70 p-6"
      onClick={onClose}
      aria-label="生成图片大图预览"
    >
      <img
        src={src}
        alt="生成图片大图"
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </AppModalOverlay>,
    document.body,
  );
}

function openFile(filePath: string) {
  window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, { detail: { filePath } }));
}

function openContainingFolder(filePath: string) {
  // 复用 preview-open-file，让预览面板处理；这里仅触发焦点
  window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, { detail: { filePath } }));
}

function downloadImage(src: string, filePath: string) {
  const pathParts = filePath.split(/[\\/]/);
  const anchor = document.createElement("a");
  anchor.href = src;
  anchor.download = pathParts.at(-1) || "generated-image.png";
  anchor.click();
}

function continueEditing(artifacts: GeneratedImageArtifactLite[]) {
  const reference = buildContinueEditingReference(artifacts);
  if (!reference) return;
  const { prompt, setPrompt } = useAppStore.getState();
  setPrompt(prompt.trim() ? `${prompt.trim()}\n\n${reference}` : reference);
  window.dispatchEvent(new CustomEvent(PROMPT_FOCUS_EVENT));
}

function openCanvasEditor() {
  window.dispatchEvent(new CustomEvent<OpenWorkspacePluginDetail>(OPEN_WORKSPACE_PLUGIN_EVENT, {
    detail: { pluginId: "codex-canvas" },
  }));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatModelName(model: string): string {
  if (/^gpt-image-\d+$/i.test(model)) {
    return model.replace(/^gpt-image-/i, "GPT Image ");
  }
  return model;
}

function shouldShowOutputHint(outputHint?: string): boolean {
  if (!outputHint?.trim()) return false;
  return !/^Generated image saved locally\.?$/i.test(outputHint.trim());
}

export function GeneratedImageResultCard({
  mode,
  model,
  profileName,
  artifacts,
  outputHint,
}: GeneratedImageResultCardProps) {
  const isGrid = artifacts.length > 1;
  return (
    <div className="mt-3">
      <div className="overflow-visible rounded-2xl border border-black/10 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
        <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-black/8 px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <ImageIcon className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <span className="text-sm font-semibold text-ink">
            {mode === "edit" ? "生图编辑" : "生图结果"}
          </span>
          {model && (
            <span className="rounded-md border border-black/8 bg-[#f7f8fa] px-2 py-1 text-[11px] font-medium text-muted">
              {formatModelName(model)}
            </span>
          )}
          {profileName && <span className="text-[11px] text-muted">· {profileName}</span>}
          <span className="min-w-0 flex-1" />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
            已完成{isGrid ? ` · ${artifacts.length} 张` : ""}
          </span>
        </div>

        <div className={isGrid ? "grid grid-cols-1 gap-4 p-4 2xl:grid-cols-2" : "p-4"}>
          {artifacts.map((artifact, index) => (
            <GeneratedImageThumb key={`${artifact.path}-${index}`} artifact={artifact} />
          ))}
        </div>
      </div>

      {shouldShowOutputHint(outputHint) && (
        <p className="mt-2 px-1 text-xs text-muted">{outputHint}</p>
      )}

      <button
        type="button"
        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-700 transition-colors hover:bg-black/5 hover:text-ink"
        onClick={() => continueEditing(artifacts)}
      >
        <Pencil className="h-4 w-4" strokeWidth={1.8} />
        继续编辑
      </button>
    </div>
  );
}
