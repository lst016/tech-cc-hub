import { useState, useRef, useCallback } from "react";
import { AppModalOverlay } from "./AppModalOverlay";

interface Attachment {
  id: string;
  dataUrl: string;
  name: string;
}

let nextAttachmentId = 0;

function createAttachment(dataUrl: string, name: string): Attachment {
  return { id: `att-${nextAttachmentId++}`, dataUrl, name };
}

async function readFileAsDataUrl(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_ATTACHMENTS = 10;

interface FeedbackDialogProps {
  onClose: () => void;
}

export function FeedbackDialog({ onClose }: FeedbackDialogProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; issueUrl?: string; error?: string; fallback?: boolean; message?: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addAttachments = useCallback((files: File[]) => {
    setAttachments((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      if (remaining <= 0) {
        alert(`最多支持 ${MAX_ATTACHMENTS} 张图片。`);
        return prev;
      }
      const candidates = files.filter((f) => f.type.startsWith("image/")).slice(0, remaining);
      if (candidates.length === 0) {
        alert("请选择图片文件。");
        return prev;
      }
      if (candidates.length < files.length) {
        alert(`已过滤非图片文件，新增 ${candidates.length} 张图片。`);
      }
      const newAttachments = candidates.map((f) => createAttachment("", f.name));
      Promise.all(
        candidates.map(async (f, i) => {
          const dataUrl = await readFileAsDataUrl(f);
          setAttachments((current) => {
            const updated = [...current];
            const idx = updated.findIndex((a) => a.id === newAttachments[i]!.id);
            if (idx !== -1) updated[idx] = { ...updated[idx]!, dataUrl };
            return updated;
          });
        }),
      );
      return [...prev, ...newAttachments];
    });
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        addAttachments(Array.from(files));
      }
      e.target.value = "";
    },
    [addAttachments],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        addAttachments(imageFiles);
      }
    },
    [addAttachments],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        addAttachments(Array.from(files));
      }
    },
    [addAttachments],
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed && attachments.length === 0) {
      alert("请填写反馈内容或添加图片。");
      return;
    }

    const readyAttachments = attachments.filter((a) => a.dataUrl);
    if (attachments.length > 0 && readyAttachments.length === 0) {
      alert("图片正在加载中，请稍后再提交。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await window.electron.submitFeedback({
        body: trimmed || "(无文字描述)",
        images: readyAttachments.map((a) => ({ dataUrl: a.dataUrl, name: a.name })),
      });
      setResult(res);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSubmitting(false);
    }
  }, [body, attachments]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const charCount = body.length;
  const resultMessage = result?.message ?? (result?.fallback ? "已打开 GitHub Issue 草稿页，请在浏览器中确认提交。" : "已提交反馈，感谢你的贡献！");
  const resultActionLabel = result?.fallback ? "打开草稿" : "查看 Issue";

  return (
    <AppModalOverlay
      aria-label="需求反馈"
      className="z-[40000] flex items-center justify-center bg-ink-900/20 px-4 py-8 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className={`flex w-full max-w-xl flex-col rounded-2xl border border-ink-900/5 bg-surface p-6 shadow-elevated transition-all ${
          dragOver ? "ring-2 ring-accent ring-offset-2" : ""
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-ink-800">需求反馈</div>
          <button
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-surface-tertiary hover:text-ink-700"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          提交功能需求或问题反馈，我们会根据反馈持续优化软件。
        </p>

        {/* Body text */}
        <div className="mt-4">
          <textarea
            ref={textareaRef}
            className="min-h-[140px] w-full resize-y rounded-xl border border-ink-900/10 bg-surface-secondary p-3.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            placeholder="描述你的需求或遇到的问题...（可直接粘贴图片）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={handlePaste}
            disabled={submitting || !!result}
          />
          <div className="mt-1 text-right text-[11px] text-muted-light">{charCount} 字</div>
        </div>

        {/* Attachments area */}
        <div className="mt-3">
          {attachments.length > 0 && (
            <div className="mb-3 grid grid-cols-3 gap-2">
              {attachments.map((att) => (
                <div key={att.id} className="group relative overflow-hidden rounded-xl border border-ink-900/10">
                  {att.dataUrl ? (
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="h-24 w-full object-cover bg-surface-secondary"
                    />
                  ) : (
                    <div className="flex h-24 w-full items-center justify-center bg-surface-secondary">
                      <svg className="h-5 w-5 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
                    aria-label={`移除 ${att.name}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 truncate bg-black/40 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                    {att.name}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {attachments.length > 0 && attachments.length < MAX_ATTACHMENTS && (
              <span className="inline-flex items-center text-[11px] text-muted-light">
                还可添加 {MAX_ATTACHMENTS - attachments.length} 张
              </span>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* Result */}
        {result && (
          <div
            className={`mt-4 rounded-xl border p-3.5 text-sm ${
              result.success
                ? "border-emerald-500/24 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {result.success ? (
              <div className="flex items-center gap-2">
                <span>{resultMessage}</span>
                {result.issueUrl && (
                  <a
                    href={result.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto shrink-0 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(result.issueUrl, "_blank");
                    }}
                  >
                    {resultActionLabel}
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>提交失败：{result.error}</span>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="ml-auto shrink-0 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700"
                >
                  重试
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!result && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || !!result || attachments.length >= MAX_ATTACHMENTS}
              className="inline-flex items-center gap-2 rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-700 transition hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-45"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>上传图片</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-700 transition hover:bg-surface-tertiary"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || (!body.trim() && attachments.length === 0)}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <svg aria-hidden="true" className="h-4 w-4 animate-spin" viewBox="0 0 100 101" fill="none">
                      <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
                      <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="white" />
                    </svg>
                    <span>提交中...</span>
                  </>
                ) : (
                  "提交反馈"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppModalOverlay>
  );
}
