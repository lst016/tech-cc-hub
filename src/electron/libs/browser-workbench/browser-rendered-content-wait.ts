import type {
  BrowserRenderedContentInput,
  BrowserRenderedContentResult,
} from "./browser-rendered-content.js";

export type BrowserRenderedContentWaitInput = BrowserRenderedContentInput & {
  previousFingerprint?: string;
  untilText?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  stableMs?: number;
};

export type BrowserRenderedContentWaitResult = {
  success: boolean;
  result?: BrowserRenderedContentResult;
  error?: string;
  attempts: number;
  elapsedMs: number;
  conditionMatched: boolean;
  timedOut: boolean;
  matchReason?: "changed" | "text" | "changed+text" | "stable";
};

type BrowserRenderedContentResponse = {
  success: boolean;
  result?: BrowserRenderedContentResult;
  error?: string;
};

type WaitDependencies = {
  now: () => number;
  sleep: (milliseconds: number) => Promise<void>;
};

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value!)));
}

function matchReason(hasPrevious: boolean, hasText: boolean): BrowserRenderedContentWaitResult["matchReason"] {
  if (hasPrevious && hasText) return "changed+text";
  if (hasPrevious) return "changed";
  if (hasText) return "text";
  return "stable";
}

export async function waitForBrowserRenderedContent(
  read: (input: BrowserRenderedContentInput) => Promise<BrowserRenderedContentResponse>,
  input: BrowserRenderedContentWaitInput = {},
  dependencies: WaitDependencies = {
    now: Date.now,
    sleep: async (milliseconds) => await new Promise((resolve) => setTimeout(resolve, milliseconds)),
  },
): Promise<BrowserRenderedContentWaitResult> {
  const startedAt = dependencies.now();
  const timeoutMs = clampInteger(input.timeoutMs, 30_000, 100, 60_000);
  const pollIntervalMs = clampInteger(input.pollIntervalMs, 500, 100, 5_000);
  const previousFingerprint = input.previousFingerprint?.trim();
  const untilText = input.untilText?.trim();
  const hasPrevious = Boolean(previousFingerprint);
  const hasText = Boolean(untilText);
  const stableMs = clampInteger(input.stableMs, hasPrevious || hasText ? 0 : 800, 0, 10_000);
  const readInput: BrowserRenderedContentInput = {
    selector: input.selector,
    maxSurfaces: input.maxSurfaces,
    maxChars: input.maxChars,
    includeSvg: input.includeSvg,
  };
  let attempts = 0;
  let lastResult: BrowserRenderedContentResult | undefined;
  let lastFingerprint: string | undefined;
  let stableSince = startedAt;

  for (;;) {
    const response = await read(readInput);
    attempts += 1;
    const observedAt = dependencies.now();
    if (!response.success || !response.result) {
      return {
        success: false,
        error: response.error ?? "Rendered-content read failed while waiting for output.",
        attempts,
        elapsedMs: Math.max(0, observedAt - startedAt),
        conditionMatched: false,
        timedOut: false,
      };
    }
    lastResult = response.result;
    if (lastFingerprint !== response.result.fingerprint) {
      lastFingerprint = response.result.fingerprint;
      stableSince = observedAt;
    }
    const combinedText = response.result.surfaces.flatMap((surface) => (
      surface.semantics.map((semantic) => semantic.text ?? "")
    )).join("\n");
    const changedMatches = !hasPrevious || response.result.fingerprint !== previousFingerprint;
    const textMatches = !hasText || combinedText.includes(untilText!);
    const stableMatches = stableMs === 0 || observedAt - stableSince >= stableMs;
    const matched = response.result.semanticSurfaceCount > 0 && changedMatches && textMatches && stableMatches;
    if (matched) {
      return {
        success: true,
        result: response.result,
        attempts,
        elapsedMs: Math.max(0, observedAt - startedAt),
        conditionMatched: true,
        timedOut: false,
        matchReason: matchReason(hasPrevious, hasText),
      };
    }
    const elapsedMs = Math.max(0, observedAt - startedAt);
    if (elapsedMs >= timeoutMs) {
      return {
        success: true,
        result: lastResult,
        attempts,
        elapsedMs,
        conditionMatched: false,
        timedOut: true,
      };
    }
    await dependencies.sleep(Math.min(pollIntervalMs, timeoutMs - elapsedMs));
  }
}
