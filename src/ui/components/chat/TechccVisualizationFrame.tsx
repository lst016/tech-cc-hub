import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  MIN_TECHCC_VISUALIZATION_HEIGHT,
  parseTechccVisualizationMessage,
  type TechccVisualizationFollowUp,
  type TechccVisualizationLaunch,
} from "../../../shared/techcc-visualization-protocol";

export type TechccVisualizationFrameProps = {
  sessionId: string;
  fileName: string;
  title: string;
  onFollowUp?: (request: Omit<TechccVisualizationFollowUp, "type">) => void | Promise<void>;
  reloadKey?: string | number;
};

type VisualizationFrameInstanceProps = Omit<TechccVisualizationFrameProps, "reloadKey"> & {
  onReload: () => void;
};

function createTechccVisualizationFrameKey(
  sessionId: string,
  fileName: string,
  title: string,
  reloadKey: string | number,
  reloadAttempt: number,
): string {
  let hash = 2_166_136_261;
  const value = `${sessionId}\u0000${fileName}\u0000${title}`;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${String(reloadKey)}:${reloadAttempt}:${(hash >>> 0).toString(36)}`;
}

function VisualizationFrameInstance({
  sessionId,
  fileName,
  title,
  onFollowUp,
  onReload,
}: VisualizationFrameInstanceProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(MIN_TECHCC_VISUALIZATION_HEIGHT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFollowUp, setPendingFollowUp] = useState<Omit<TechccVisualizationFollowUp, "type"> | null>(null);
  const [launch, setLaunch] = useState<TechccVisualizationLaunch | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.electron.invoke<TechccVisualizationLaunch>(
      "techcc-visualization-create-launch",
      { sessionId, fileName },
    ).then((nextLaunch) => {
      if (cancelled) return;
      if (!nextLaunch?.url?.startsWith("techcc-visualize://") || !nextLaunch.nonce) {
        throw new Error("主进程返回了无效的可视化启动凭证。");
      }
      setLaunch(nextLaunch);
    }).catch((reason: unknown) => {
      if (cancelled) return;
      setIsLoading(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => {
      cancelled = true;
    };
  }, [fileName, sessionId]);

  useEffect(() => {
    if (!launch) return undefined;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = parseTechccVisualizationMessage(event.data, launch.nonce);
      if (!message) return;

      if (message.type === "resize") {
        setHeight(message.height);
        return;
      }
      if (message.type === "ready") {
        setIsLoading(false);
        return;
      }
      if (message.type === "error") {
        setIsLoading(false);
        setError(message.message);
        return;
      }
      if (!onFollowUp) {
        setError("当前交互视图无法发送后续请求。");
        return;
      }
      setPendingFollowUp((current) => current ?? { prompt: message.prompt, title: message.title });
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [launch, onFollowUp]);

  const confirmFollowUp = () => {
    if (!pendingFollowUp || !onFollowUp) return;
    const request = pendingFollowUp;
    setPendingFollowUp(null);
    try {
      const result = onFollowUp(request);
      void Promise.resolve(result).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return (
    <div className="relative h-full min-h-full bg-transparent" style={{ minHeight: MIN_TECHCC_VISUALIZATION_HEIGHT }}>
      {launch ? (
        <iframe
          ref={iframeRef}
          title={title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          src={launch.url}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setError("交互视图加载失败。");
          }}
          className="block w-full border-0 bg-transparent transition-[height] duration-150"
          style={{ height, minHeight: "100%" }}
        />
      ) : null}
      {isLoading ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/75 text-sm font-medium text-muted">
          正在加载交互视图…
        </div>
      ) : null}
      {pendingFollowUp && !error ? (
        <div
          role="alertdialog"
          aria-label="确认发送后续问题"
          className="absolute inset-x-0 bottom-0 flex flex-col gap-3 border-t border-black/8 bg-violet-50/95 px-4 py-3 shadow-[0_-8px_24px_rgba(76,29,149,0.08)] sm:flex-row sm:items-center"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-violet-900">
              交互视图请求继续对话{pendingFollowUp.title ? ` · ${pendingFollowUp.title}` : ""}
            </p>
            <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words pr-1 text-xs leading-5 text-ink-600">
              {pendingFollowUp.prompt}
            </p>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingFollowUp(null)}
              className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            >取消</button>
            <button
              type="button"
              onClick={confirmFollowUp}
              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            >发送到对话</button>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-white/95 px-5 text-center">
          <div>
            <p className="text-sm font-semibold text-red-600">交互视图发生错误</p>
            <p className="mt-1 max-w-xl break-words text-xs text-ink-600">{error}</p>
            <button
              type="button"
              onClick={onReload}
              className="mt-3 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            >
              重新加载
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export const TechccVisualizationFrame = memo(function TechccVisualizationFrame({
  sessionId,
  fileName,
  title,
  onFollowUp,
  reloadKey = 0,
}: TechccVisualizationFrameProps) {
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const frameKey = useMemo(
    () => createTechccVisualizationFrameKey(sessionId, fileName, title, reloadKey, reloadAttempt),
    [fileName, reloadAttempt, reloadKey, sessionId, title],
  );
  const reload = () => setReloadAttempt((attempt) => attempt + 1);

  return (
    <VisualizationFrameInstance
      key={frameKey}
      sessionId={sessionId}
      fileName={fileName}
      title={title}
      onFollowUp={onFollowUp}
      onReload={reload}
    />
  );
});
