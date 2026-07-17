export type RunnerActivityWatchdogTimerHandle = {
  unref?: () => void;
};

export type RunnerActivityWatchdogOptions = {
  firstEventTimeoutMs: number;
  idleTimeoutMs: number;
  setTimer?: (callback: () => void, delayMs: number) => RunnerActivityWatchdogTimerHandle;
  clearTimer?: (handle: RunnerActivityWatchdogTimerHandle) => void;
};

export function createRunnerActivityWatchdog(
  onTimeout: (message: string) => void,
  options: RunnerActivityWatchdogOptions,
): {
  touch: () => void;
  pause: () => void;
  resume: () => void;
  dispose: () => void;
} {
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let receivedEvent = false;
  let pauseDepth = 0;
  let timer: RunnerActivityWatchdogTimerHandle | undefined;

  const dispose = () => {
    if (!timer) return;
    clearTimer(timer);
    timer = undefined;
  };

  const arm = () => {
    dispose();
    if (pauseDepth > 0) return;
    const timeoutMs = receivedEvent ? options.idleTimeoutMs : options.firstEventTimeoutMs;
    timer = setTimer(() => {
      timer = undefined;
      onTimeout(
        receivedEvent
          ? "运行超时：任务连续 5 分钟没有进展，已被中断。"
          : "运行超时：任务启动 2 分钟内没有进展，已被中断。",
      );
    }, timeoutMs);
    timer.unref?.();
  };

  const touch = () => {
    receivedEvent = true;
    arm();
  };

  const pause = () => {
    pauseDepth += 1;
    if (pauseDepth === 1) dispose();
  };

  const resume = () => {
    if (pauseDepth === 0) return;
    pauseDepth -= 1;
    if (pauseDepth === 0) arm();
  };

  arm();
  return { touch, pause, resume, dispose };
}
