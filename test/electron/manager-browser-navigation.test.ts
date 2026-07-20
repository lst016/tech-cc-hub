import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserView, BrowserWindow } from "electron";

import { BrowserWorkbenchManager } from "../../src/electron/browser-manager.js";

type CookieSyncOutcome = { imported: number };

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class FakeWebContents {
  readonly id = 1;
  readonly loadCalls: string[] = [];
  reloadCalls = 0;
  goBackCalls = 0;
  canGoBackValue = false;
  destroyed = false;
  nextLoadError: Error | null = null;
  currentUrl: string;
  private windowOpenHandler: ((details: { url: string }) => { action: string }) | null = null;

  readonly debugger = {
    on: () => undefined,
    removeListener: () => undefined,
    isAttached: () => true,
    attach: () => undefined,
    detach: () => undefined,
    sendCommand: async () => ({}),
  };

  constructor(initialUrl: string) {
    this.currentUrl = initialUrl;
  }

  getURL(): string {
    return this.currentUrl;
  }

  getTitle(): string {
    return "Test page";
  }

  isLoading(): boolean {
    return false;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  canGoBack(): boolean {
    return this.canGoBackValue;
  }

  canGoForward(): boolean {
    return false;
  }

  setWindowOpenHandler(handler: (details: { url: string }) => { action: string }): void {
    this.windowOpenHandler = handler;
  }

  openWindow(url: string): { action: string } {
    assert.ok(this.windowOpenHandler, "Expected a window-open handler");
    return this.windowOpenHandler({ url });
  }

  on(): void {}

  loadURL(url: string): Promise<void> {
    this.loadCalls.push(url);
    if (this.nextLoadError) {
      const error = this.nextLoadError;
      this.nextLoadError = null;
      return Promise.reject(error);
    }
    this.currentUrl = url;
    return Promise.resolve();
  }

  reload(): void {
    this.reloadCalls += 1;
  }

  goBack(): void {
    this.goBackCalls += 1;
  }

  close(): void {
    this.destroyed = true;
  }
}

class FakeBrowserView {
  readonly webContents: FakeWebContents;

  constructor(initialUrl: string) {
    this.webContents = new FakeWebContents(initialUrl);
  }

  setBounds(): void {}

  setAutoResize(): void {}
}

class FakeBrowserWindow {
  readonly webContents = { send: () => undefined };
  destroyed = false;
  removeBrowserViewCalls = 0;

  setBrowserView(): void {}

  removeBrowserView(): void {
    if (this.destroyed) throw new TypeError("Object has been destroyed");
    this.removeBrowserViewCalls += 1;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

function createManagerHarness(initialUrl = "") {
  const view = new FakeBrowserView(initialUrl);
  const window = new FakeBrowserWindow();
  const pendingSyncs = new Map<string, ReturnType<typeof deferred<CookieSyncOutcome>>>();
  const syncCalls: string[] = [];
  const manager = new BrowserWorkbenchManager(
    window as unknown as BrowserWindow,
    undefined,
    {
      createView: () => view as unknown as BrowserView,
      syncCookies: (url: string) => {
        syncCalls.push(url);
        const pending = deferred<CookieSyncOutcome>();
        pendingSyncs.set(url, pending);
        return pending.promise;
      },
    },
  );
  return { manager, pendingSyncs, syncCalls, webContents: view.webContents, window };
}

function resolveSync(
  pendingSyncs: Map<string, ReturnType<typeof deferred<CookieSyncOutcome>>>,
  url: string,
  outcome: CookieSyncOutcome,
): void {
  const pending = pendingSyncs.get(url);
  assert.ok(pending, `Expected pending cookie sync for ${url}`);
  pending.resolve(outcome);
}

async function settleNavigation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("BrowserWorkbenchManager.open keeps a delayed older URL from loading after the latest URL", async () => {
  const { manager, pendingSyncs, webContents } = createManagerHarness();

  const stateA = manager.open("https://example.test/a");
  manager.open("https://example.test/b");

  assert.equal(stateA.url, "");
  assert.deepEqual(webContents.loadCalls, []);

  resolveSync(pendingSyncs, "https://example.test/b", { imported: 0 });
  await settleNavigation();
  resolveSync(pendingSyncs, "https://example.test/a", { imported: 0 });
  await settleNavigation();

  assert.deepEqual(webContents.loadCalls, ["https://example.test/b"]);
});

test("BrowserWorkbenchManager.open suppresses an older same-URL cookie reload", async () => {
  const urlA = "https://example.test/a";
  const { manager, pendingSyncs, webContents } = createManagerHarness(urlA);

  manager.open(urlA);
  manager.open("https://example.test/b");

  resolveSync(pendingSyncs, "https://example.test/b", { imported: 0 });
  await settleNavigation();
  resolveSync(pendingSyncs, "https://example.test/a", { imported: 1 });
  await settleNavigation();

  assert.equal(webContents.reloadCalls, 0);
  assert.deepEqual(webContents.loadCalls, ["https://example.test/b"]);
});

test("BrowserWorkbenchManager.goBack supersedes a delayed open", async () => {
  const nextUrl = "https://example.test/a";
  const { manager, pendingSyncs, webContents } = createManagerHarness("https://example.test/current");
  webContents.canGoBackValue = true;

  manager.open(nextUrl);
  manager.goBack();
  resolveSync(pendingSyncs, nextUrl, { imported: 0 });
  await settleNavigation();

  assert.equal(webContents.goBackCalls, 1);
  assert.deepEqual(webContents.loadCalls, []);
});

test("BrowserWorkbenchManager.open supersedes a delayed popup navigation", async () => {
  const popupUrl = "https://example.test/popup";
  const nextUrl = "https://example.test/b";
  const { manager, pendingSyncs, webContents } = createManagerHarness();

  manager.open("about:blank");
  resolveSync(pendingSyncs, "about:blank", { imported: 0 });
  await settleNavigation();
  assert.deepEqual(webContents.openWindow(popupUrl), { action: "deny" });
  manager.open(nextUrl);

  resolveSync(pendingSyncs, nextUrl, { imported: 0 });
  await settleNavigation();
  resolveSync(pendingSyncs, popupUrl, { imported: 0 });
  await settleNavigation();

  assert.deepEqual(webContents.loadCalls, ["about:blank", nextUrl]);
});

test("BrowserWorkbenchManager.close blocks a delayed URL load", async () => {
  const { manager, pendingSyncs, webContents } = createManagerHarness();

  manager.open("https://example.test/a");
  manager.close();
  resolveSync(pendingSyncs, "https://example.test/a", { imported: 0 });
  await settleNavigation();

  assert.deepEqual(webContents.loadCalls, []);
});

test("BrowserWorkbenchManager.close blocks a delayed same-URL cookie reload", async () => {
  const url = "https://example.test/a";
  const { manager, pendingSyncs, webContents } = createManagerHarness(url);

  manager.open(url);
  manager.close();
  resolveSync(pendingSyncs, url, { imported: 1 });
  await settleNavigation();

  assert.equal(webContents.reloadCalls, 0);
});

test("BrowserWorkbenchManager.close is idempotent after its BrowserWindow is destroyed", async () => {
  const { manager, pendingSyncs, webContents, window } = createManagerHarness();
  const url = "https://example.test/a";

  manager.open(url);
  window.destroyed = true;

  assert.doesNotThrow(() => manager.close());
  assert.doesNotThrow(() => manager.close());
  assert.equal(window.removeBrowserViewCalls, 0);
  assert.equal(manager.hasLiveView(), false);

  resolveSync(pendingSyncs, url, { imported: 0 });
  await settleNavigation();
  assert.deepEqual(webContents.loadCalls, []);
});

test("BrowserWorkbenchManager exposes the latest main-frame load failure", async () => {
  const url = "https://unreachable.example.test";
  const { manager, pendingSyncs, webContents } = createManagerHarness();
  webContents.nextLoadError = new Error("ERR_NAME_NOT_RESOLVED");

  manager.open(url);
  resolveSync(pendingSyncs, url, { imported: 0 });
  await settleNavigation();

  assert.match(manager.getState().error ?? "", /ERR_NAME_NOT_RESOLVED/);
  assert.equal(manager.getState().loading, false);
});

test("BrowserWorkbenchManager deduplicates identical in-flight cookie syncs", async () => {
  const url = "https://example.test/same";
  const { manager, pendingSyncs, syncCalls, webContents } = createManagerHarness();

  manager.open(url);
  manager.open(url);

  assert.deepEqual(syncCalls, [url]);
  resolveSync(pendingSyncs, url, { imported: 0 });
  await settleNavigation();
  assert.deepEqual(webContents.loadCalls, [url]);
});
