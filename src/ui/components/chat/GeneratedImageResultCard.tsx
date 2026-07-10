// 生图结果卡片：把 image_generate 的成功结果渲染成图片缩略图 + 元数据 + 动作。
// 详见 .omx/plans/2026-07-10-image-generation-integration.md §9.3 / §9.4。
import { useEffect, useState } from "react";
import type { GeneratedImageArtifactLite } from "../../utils/generated-image-result";
import { buildContinueEditingReference } from "../../utils/generated-image-result";
import { copyTextToClipboard as copyText } from "../../utils/clipboard";
import { PREVIEW_OPEN_FILE_EVENT, PROMPT_FOCUS_EVENT } from "../../events";
import { useAppStore } from "../../store/useAppStore";

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

function useImageDataUrl(absolutePath: string): LoadState {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const result = await window.electron.readPreviewFile({
          cwd: "",
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
    <div className="flex flex-col gap-2 rounded-2xl border border-black/8 bg-white p-3">
      <div className="relative grid place-items-center overflow-hidden rounded-xl bg-[#f4f7fb]" style={{ minHeight: 120 }}>
        {loadState.status === "loading" && (
          <span className="text-[11px] text-muted">加载中…</span>
        )}
        {loadState.status === "missing" && (
          <div className="flex flex-col items-center gap-1 px-3 py-6 text-center">
            <svg className="h-6 w-6 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span className="text-[11px] text-muted">图片文件已移动或删除</span>
          </div>
        )}
        {loadState.status === "error" && (
          <span className="text-[11px] text-red-600">加载失败</span>
        )}
        {loadState.status === "loaded" && (
          <button
            type="button"
            className="block w-full cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={loadState.src}
              alt="生成图片"
              className="mx-auto max-h-64 max-w-full rounded-xl object-contain"
            />
          </button>
        )}
      </div>

      {artifact.revisedPrompt && (
        <p className="line-clamp-2 text-[11px] leading-5 text-muted">{artifact.revisedPrompt}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        {metaParts.map((part) => (
          <span key={part} className="rounded-full border border-black/8 bg-[#f4f7fb] px-2 py-0.5">{part}</span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ActionButton onClick={() => openFile(artifact.path)}>打开文件</ActionButton>
        <ActionButton onClick={() => openContainingFolder(artifact.path)}>所在目录</ActionButton>
        <ActionButton onClick={() => void copyText(artifact.path)}>复制路径</ActionButton>
      </div>

      {loadState.status === "loaded" && lightboxOpen && (
        <Lightbox src={loadState.src} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-full border border-black/8 bg-white px-2.5 py-0.5 text-[11px] font-medium text-ink-700 transition hover:border-accent/30 hover:text-accent"
      onClick={onClick}
    >
      {children}
    </button>
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

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
      onClick={onClose}
    >
      <img
        src={src}
        alt="生成图片大图"
        className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

function openFile(filePath: string) {
  window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, { detail: { filePath } }));
}

function openContainingFolder(filePath: string) {
  // 复用 preview-open-file，让预览面板处理；这里仅触发焦点
  window.dispatchEvent(new CustomEvent(PREVIEW_OPEN_FILE_EVENT, { detail: { filePath } }));
}

function continueEditing(artifacts: GeneratedImageArtifactLite[]) {
  const reference = buildContinueEditingReference(artifacts);
  if (!reference) return;
  const { prompt, setPrompt } = useAppStore.getState();
  setPrompt(prompt.trim() ? `${prompt.trim()}\n\n${reference}` : reference);
  window.dispatchEvent(new CustomEvent(PROMPT_FOCUS_EVENT));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
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
    <div className="mt-3 rounded-[22px] border border-black/6 bg-[#f4f7fb] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-fuchsia-100 text-fuchsia-700">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          {mode === "edit" ? "生图编辑" : "生图结果"}
        </span>
        {model && <span className="text-[11px] text-muted">{model}</span>}
        {profileName && <span className="text-[11px] text-muted">· {profileName}</span>}
        <span className="min-w-0 flex-1" />
        <span className="text-[11px] text-muted">{artifacts.length} 张</span>
      </div>

      <div className={isGrid ? "mt-3 grid grid-cols-2 gap-3" : "mt-3"}>
        {artifacts.map((artifact, index) => (
          <GeneratedImageThumb key={`${artifact.path}-${index}`} artifact={artifact} />
        ))}
      </div>

      {outputHint && (
        <p className="mt-2 text-[11px] text-muted">{outputHint}</p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ActionButton onClick={() => continueEditing(artifacts)}>继续编辑</ActionButton>
      </div>
    </div>
  );
}
