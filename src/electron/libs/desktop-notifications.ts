import { app, BrowserWindow, Notification } from "electron";

import {
  buildCronDesktopNotification,
  buildSessionDesktopNotification,
  buildTaskExecutionDesktopNotification,
  shouldShowDesktopNotification,
  type CronNotificationInput,
  type DesktopNotificationIntent,
  type DesktopNotificationTarget,
  type DesktopNotificationWindowState,
  type SessionNotificationInput,
  type TaskExecutionNotificationInput,
} from "./desktop-notification-model.js";
import type { ServerEvent } from "../types.js";

export const TECH_CC_HUB_APP_USER_MODEL_ID = "com.devagentforge.techcchub";

const MAX_DEDUPE_KEYS = 200;
const shownDedupeKeys: string[] = [];
const shownDedupeKeySet = new Set<string>();

export function configureDesktopNotifications(): void {
  if (process.platform === "win32") {
    app.setAppUserModelId(TECH_CC_HUB_APP_USER_MODEL_ID);
  }
}

export function notifyTaskExecutionFinished(input: TaskExecutionNotificationInput): boolean {
  return showDesktopNotification(buildTaskExecutionDesktopNotification(input));
}

export function notifySessionFinished(input: SessionNotificationInput): boolean {
  return showDesktopNotification(buildSessionDesktopNotification(input));
}

export function notifyCronFinished(input: CronNotificationInput): boolean {
  return showDesktopNotification(buildCronDesktopNotification(input));
}

export function showDesktopNotification(intent: DesktopNotificationIntent | null): boolean {
  if (!intent) return false;
  if (!Notification.isSupported()) return false;
  if (shownDedupeKeySet.has(intent.dedupeKey)) return false;
  if (!shouldShowDesktopNotification(getDesktopNotificationWindowStates())) return false;

  rememberDedupeKey(intent.dedupeKey);

  const notification = new Notification({
    title: intent.title,
    body: intent.body,
    urgency: intent.urgency,
    silent: false,
  });

  notification.on("click", () => {
    openDesktopNotificationTarget(intent.target);
  });
  notification.show();
  return true;
}

export function openDesktopNotificationTarget(target: DesktopNotificationTarget): void {
  focusPrimaryWindow();
  const event: ServerEvent = {
    type: "desktop.notification.opened",
    payload: { target },
  };
  const payload = JSON.stringify(event);

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("server-event", payload);
    }
  }
}

function getDesktopNotificationWindowStates(): DesktopNotificationWindowState[] {
  return BrowserWindow.getAllWindows().map((window) => ({
    destroyed: window.isDestroyed(),
    focused: window.isFocused(),
    minimized: window.isMinimized(),
    visible: window.isVisible(),
  }));
}

function focusPrimaryWindow(): void {
  const window = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
  if (!window) return;

  if (window.isMinimized()) {
    window.restore();
  }
  if (!window.isVisible()) {
    window.show();
  }
  window.focus();

  if (process.platform === "darwin" || process.platform === "win32") {
    app.focus({ steal: true });
  }
}

function rememberDedupeKey(key: string): void {
  shownDedupeKeys.push(key);
  shownDedupeKeySet.add(key);

  while (shownDedupeKeys.length > MAX_DEDUPE_KEYS) {
    const staleKey = shownDedupeKeys.shift();
    if (staleKey) shownDedupeKeySet.delete(staleKey);
  }
}
