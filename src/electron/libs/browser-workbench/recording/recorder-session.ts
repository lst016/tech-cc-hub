import type {
  BrowserWorkbenchRecordedAction,
  BrowserWorkbenchRecordingActionKind,
  BrowserWorkbenchRecordingSession,
  BrowserWorkbenchRecordingStartInput,
  BrowserWorkbenchRecordingStatus,
  BrowserWorkbenchRecordingTarget,
} from "./types.js";

const MAX_RECORDED_ACTIONS = 500;
const MAX_TEXT_LENGTH = 160;
const FILL_COALESCE_MS = 2500;

export function safeRecordingText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function safeRawString(value: unknown, maxLength = 10_000): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readTarget(raw: Record<string, unknown>): BrowserWorkbenchRecordingTarget | undefined {
  const rawTarget = raw.target && typeof raw.target === "object" ? raw.target as Record<string, unknown> : raw;
  const target: BrowserWorkbenchRecordingTarget = {
    selector: safeRawString(rawTarget.selector, 2000),
    role: safeRecordingText(rawTarget.role, 80),
    name: safeRecordingText(rawTarget.name, 120),
    text: safeRecordingText(rawTarget.text, 120),
    tagName: safeRecordingText(rawTarget.tagName, 40)?.toLowerCase(),
    inputType: safeRecordingText(rawTarget.inputType, 40)?.toLowerCase(),
  };
  return Object.values(target).some(Boolean) ? target : undefined;
}

function normalizeKind(kind: unknown): BrowserWorkbenchRecordingActionKind | undefined {
  if (
    kind === "click" ||
    kind === "fill" ||
    kind === "select" ||
    kind === "check" ||
    kind === "uncheck" ||
    kind === "press" ||
    kind === "scroll" ||
    kind === "navigate" ||
    kind === "assertVisible" ||
    kind === "assertText" ||
    kind === "assertUrl" ||
    kind === "assertTitle" ||
    kind === "assertCount" ||
    kind === "assertAttribute" ||
    kind === "assertScreenshot" ||
    kind === "assertResponse"
  ) {
    return kind;
  }
  return undefined;
}

function targetKey(target?: BrowserWorkbenchRecordingTarget): string {
  if (!target) return "";
  return [
    target.selector ?? "",
    target.role ?? "",
    target.name ?? "",
    target.text ?? "",
    target.tagName ?? "",
    target.inputType ?? "",
  ].join("\u0000");
}

export function isSameRecordingUrl(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return a === b;
}

function normalizeRecordedAction(raw: unknown): BrowserWorkbenchRecordedAction | null {
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  const kind = normalizeKind(payload.kind);
  if (!kind) return null;

  const url = safeRawString(payload.url, 4000) ?? "";
  const target = readTarget(payload);
  const timestamp = safeNumber(payload.timestamp) ?? Date.now();
  const action: BrowserWorkbenchRecordedAction = {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `recorded-${timestamp}-${Math.random().toString(16).slice(2)}`,
    kind,
    timestamp,
    url,
    title: safeRecordingText(payload.title, 160),
    target,
    value: safeRawString(payload.value, 10_000),
    key: safeRecordingText(payload.key, 80),
    checked: typeof payload.checked === "boolean" ? payload.checked : undefined,
    scrollX: safeNumber(payload.scrollX),
    scrollY: safeNumber(payload.scrollY),
    source: payload.source === "navigation" ? "navigation" : "page",
  };

  if ((kind === "click" || kind === "fill" || kind === "select" || kind === "check" || kind === "uncheck" || kind === "assertVisible" || kind === "assertText" || kind === "assertCount" || kind === "assertAttribute") && !target?.selector && !target?.role && !target?.text) {
    return null;
  }
  if (kind === "fill" && action.value === undefined) return null;
  if (kind === "select" && action.value === undefined) return null;
  if (kind === "press" && !action.key) return null;
  if (kind === "scroll" && action.scrollX === undefined && action.scrollY === undefined) return null;
  if (kind === "navigate" && !action.url) return null;
  if ((kind === "assertUrl" || kind === "assertTitle" || kind === "assertScreenshot" || kind === "assertResponse") && action.value === undefined) return null;
  if (kind === "assertCount" && action.value === undefined) return null;
  if (kind === "assertAttribute" && (!action.key || action.value === undefined)) return null;
  return action;
}

export function createBrowserWorkbenchRecordingSession(input: BrowserWorkbenchRecordingStartInput): BrowserWorkbenchRecordingSession {
  return {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `recording-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startedAt: Date.now(),
    startUrl: input.url,
    startTitle: input.title,
    viewport: input.viewport,
    actions: [],
  };
}

export function getBrowserWorkbenchRecordingStatus(session: BrowserWorkbenchRecordingSession | null): BrowserWorkbenchRecordingStatus {
  if (!session) {
    return {
      recording: false,
      actionCount: 0,
    };
  }
  return {
    recording: true,
    id: session.id,
    startedAt: session.startedAt,
    url: session.startUrl,
    title: session.startTitle,
    actionCount: session.actions.length,
  };
}

export function appendBrowserWorkbenchRecordedAction(
  session: BrowserWorkbenchRecordingSession,
  raw: unknown,
): BrowserWorkbenchRecordedAction | null {
  const action = normalizeRecordedAction(raw);
  if (!action) return null;

  const last = session.actions[session.actions.length - 1];
  if (action.kind === "navigate") {
    if (!session.actions.length && isSameRecordingUrl(action.url, session.startUrl)) return null;
    if (last?.kind === "navigate" && isSameRecordingUrl(last.url, action.url)) return null;
  }

  if (action.kind === "fill" && last?.kind === "fill" && targetKey(last.target) === targetKey(action.target)) {
    if (action.timestamp - last.timestamp <= FILL_COALESCE_MS) {
      Object.assign(last, {
        timestamp: action.timestamp,
        value: action.value,
        url: action.url || last.url,
        title: action.title || last.title,
      });
      return last;
    }
  }

  if (action.kind === "scroll" && last?.kind === "scroll" && isSameRecordingUrl(last.url, action.url)) {
    Object.assign(last, {
      timestamp: action.timestamp,
      scrollX: action.scrollX,
      scrollY: action.scrollY,
    });
    return last;
  }

  session.actions.push(action);
  if (session.actions.length > MAX_RECORDED_ACTIONS) {
    session.actions.splice(0, session.actions.length - MAX_RECORDED_ACTIONS);
  }
  return action;
}
