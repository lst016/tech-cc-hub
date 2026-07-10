import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  componentStack: string;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
    componentStack: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      error,
      componentStack: "",
    };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[renderer] uncaught React error", error, info);
    this.setState({
      error,
      componentStack: info.componentStack ?? "",
    });
  }

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f4ee] px-6 py-10 text-[#1f2937]">
        <div className="w-full max-w-3xl rounded-3xl border border-black/10 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            开发环境渲染层发生异常，界面被错误边界接管，避免继续白屏。
          </div>
          <h1 className="mt-5 text-2xl font-semibold">Renderer Crash</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            先看下面的报错和组件栈，再结合终端里的 `[renderer]` / `[main-window]` 日志定位具体组件。
          </p>
          <div className="mt-5 rounded-2xl border border-black/10 bg-slate-950 p-4 text-sm text-slate-100">
            <div className="font-semibold text-red-300">{error.name}: {error.message}</div>
            {error.stack && (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">
                {error.stack}
              </pre>
            )}
            {componentStack && (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words border-t border-white/10 pt-3 text-xs leading-6 text-slate-400">
                {componentStack.trim()}
              </pre>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              onClick={() => window.location.reload()}
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  }
}
