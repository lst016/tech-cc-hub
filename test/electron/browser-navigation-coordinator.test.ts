import assert from "node:assert/strict";
import test from "node:test";

import {
  BrowserNavigationCoordinator,
  runIfCurrentBrowserNavigation,
} from "../../src/electron/libs/browser-workbench/browser-navigation-coordinator.js";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test("only the latest navigation generation remains current", () => {
  const coordinator = new BrowserNavigationCoordinator();

  const generationA = coordinator.begin();
  const generationB = coordinator.begin();

  assert.equal(coordinator.isCurrent(generationA), false);
  assert.equal(coordinator.isCurrent(generationB), true);

  coordinator.invalidate();

  assert.equal(coordinator.isCurrent(generationA), false);
  assert.equal(coordinator.isCurrent(generationB), false);
});

test("an older delayed URL load cannot overwrite the latest navigation", async () => {
  const coordinator = new BrowserNavigationCoordinator();
  const navigationA = deferred();
  const navigationB = deferred();
  const navigatedUrls: string[] = [];

  const startNavigation = async (url: string, waitForCookies: Promise<void>) => {
    const generation = coordinator.begin();
    await waitForCookies;
    runIfCurrentBrowserNavigation(
      coordinator,
      generation,
      () => true,
      () => navigatedUrls.push(url),
    );
  };

  const pendingA = startNavigation("https://example.test/a", navigationA.promise);
  const pendingB = startNavigation("https://example.test/b", navigationB.promise);

  navigationB.resolve();
  await pendingB;
  navigationA.resolve();
  await pendingA;

  assert.deepEqual(navigatedUrls, ["https://example.test/b"]);
});

test("an older delayed same-URL reload cannot run after a newer open", async () => {
  const coordinator = new BrowserNavigationCoordinator();
  const reloadA = deferred();
  const loadB = deferred();
  const navigationActions: string[] = [];

  const generationA = coordinator.begin();
  const pendingReloadA = reloadA.promise.then(() => {
    runIfCurrentBrowserNavigation(
      coordinator,
      generationA,
      () => true,
      () => navigationActions.push("reload A"),
    );
  });

  const generationB = coordinator.begin();
  const pendingLoadB = loadB.promise.then(() => {
    runIfCurrentBrowserNavigation(
      coordinator,
      generationB,
      () => true,
      () => navigationActions.push("load B"),
    );
  });

  loadB.resolve();
  await pendingLoadB;
  reloadA.resolve();
  await pendingReloadA;

  assert.deepEqual(navigationActions, ["load B"]);
});

test("a current generation cannot navigate a replaced or destroyed view", () => {
  const coordinator = new BrowserNavigationCoordinator();
  const generation = coordinator.begin();
  const navigationActions: string[] = [];

  runIfCurrentBrowserNavigation(
    coordinator,
    generation,
    () => false,
    () => navigationActions.push("navigate replaced view"),
  );

  assert.deepEqual(navigationActions, []);
});
