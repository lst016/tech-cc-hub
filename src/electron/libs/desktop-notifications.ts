import { app, BrowserWindow, nativeImage, Notification, shell } from "electron";

import {
  buildDesktopNotificationAttentionCue,
  buildCronDesktopNotification,
  buildSessionDesktopNotification,
  buildTaskExecutionDesktopNotification,
  type DesktopNotificationAttentionCue,
  type CronNotificationInput,
  type DesktopNotificationIntent,
  type DesktopNotificationTarget,
  type DesktopNotificationWindowState,
  type SessionNotificationInput,
  type TaskExecutionNotificationInput,
} from "./desktop-notification-model.js";
import {
  createUnreadBadgePng,
  formatUnreadBadgeCount,
} from "./desktop-unread-badge.js";
import type { ServerEvent } from "../types.js";

export const TECH_CC_HUB_APP_USER_MODEL_ID = "com.devagentforge.techcchub";

const MAX_DEDUPE_KEYS = 200;
const WINDOWS_TASKBAR_FLASH_MS = 60_000;
const DESKTOP_NOTIFICATION_AUTO_CLOSE_MS = 6_000;
const shownDedupeKeys: string[] = [];
const shownDedupeKeySet = new Set<string>();
const activeFlashTimers = new Map<number, ReturnType<typeof setTimeout>>();
let desktopNotificationLifecycleConfigured = false;
let unreadDesktopNotificationCount = 0;

export function configureDesktopNotifications(): void {
  if (process.platform === "win32") {
    app.setAppUserModelId(TECH_CC_HUB_APP_USER_MODEL_ID);
  }
  if (desktopNotificationLifecycleConfigured) return;

  desktopNotificationLifecycleConfigured = true;
  app.on("browser-window-created", (_event, window) => {
    window.on("focus", clearDesktopUnreadBadge);
    applyDesktopUnreadBadgeToWindow(window);
  });
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
  if (shownDedupeKeySet.has(intent.dedupeKey)) return false;

  const attentionCue = buildDesktopNotificationAttentionCue(intent, getDesktopNotificationWindowStates());
  if (!attentionCue) return false;

  rememberDedupeKey(intent.dedupeKey);
  incrementDesktopUnreadBadge();
  showAttentionCue(attentionCue);

  if (!Notification.isSupported()) return true;

  const notification = new Notification({
    title: intent.title,
    body: intent.body,
    urgency: intent.urgency,
    silent: false,
    timeoutType: attentionCue.timeoutType,
  });

  notification.on("click", () => {
    openDesktopNotificationTarget(intent.target);
    notification.close();
  });
  notification.show();

  const closeTimer = setTimeout(() => {
    notification.close();
  }, DESKTOP_NOTIFICATION_AUTO_CLOSE_MS);
  notification.once("close", () => {
    clearTimeout(closeTimer);
  });
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

  focusDesktopWindow(window);
}

export function focusDesktopWindow(window: BrowserWindow): boolean {
  if (window.isDestroyed()) return false;

  clearDesktopUnreadBadge();
  stopWindowAttention(window);
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
  return true;
}

function incrementDesktopUnreadBadge(): void {
  unreadDesktopNotificationCount += 1;
  refreshDesktopUnreadBadge();
}

function clearDesktopUnreadBadge(): void {
  if (unreadDesktopNotificationCount === 0) return;
  unreadDesktopNotificationCount = 0;
  refreshDesktopUnreadBadge();
}

function refreshDesktopUnreadBadge(): void {
  if (process.platform !== "win32") return;
  for (const window of BrowserWindow.getAllWindows()) {
    applyDesktopUnreadBadgeToWindow(window);
  }
}

function applyDesktopUnreadBadgeToWindow(window: BrowserWindow): void {
  if (process.platform !== "win32" || window.isDestroyed()) return;
  if (unreadDesktopNotificationCount === 0) {
    window.setOverlayIcon(null, "No unread completed tasks");
    return;
  }

  const label = formatUnreadBadgeCount(unreadDesktopNotificationCount);
  const overlay = nativeImage.createFromBuffer(createUnreadBadgePng(unreadDesktopNotificationCount));
  if (overlay.isEmpty()) return;
  window.setOverlayIcon(
    overlay,
    `${label} unread completed ${unreadDesktopNotificationCount === 1 ? "task" : "tasks"}`,
  );
}

function showAttentionCue(cue: DesktopNotificationAttentionCue): void {
  if (cue.playSound) {
    shell.beep();
  }
  if (!cue.flashTaskbar) return;

  for (const window of BrowserWindow.getAllWindows()) {
    requestWindowAttention(window);
  }
}

function requestWindowAttention(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  if (process.platform !== "win32" && process.platform !== "linux") return;

  stopWindowAttention(window);
  window.flashFrame(true);

  const timer = setTimeout(() => {
    stopWindowAttention(window);
  }, WINDOWS_TASKBAR_FLASH_MS);
  activeFlashTimers.set(window.id, timer);

  window.once("focus", () => {
    stopWindowAttention(window);
  });
  window.once("closed", () => {
    clearWindowAttentionTimer(window.id);
  });
}

function stopWindowAttention(window: BrowserWindow): void {
  clearWindowAttentionTimer(window.id);
  if (!window.isDestroyed() && (process.platform === "win32" || process.platform === "linux")) {
    window.flashFrame(false);
  }
}

function clearWindowAttentionTimer(windowId: number): void {
  const timer = activeFlashTimers.get(windowId);
  if (timer) {
    clearTimeout(timer);
  }
  activeFlashTimers.delete(windowId);
}

function rememberDedupeKey(key: string): void {
  shownDedupeKeys.push(key);
  shownDedupeKeySet.add(key);

  while (shownDedupeKeys.length > MAX_DEDUPE_KEYS) {
    const staleKey = shownDedupeKeys.shift();
    if (staleKey) shownDedupeKeySet.delete(staleKey);
  }
}
