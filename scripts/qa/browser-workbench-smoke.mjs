import { app, BrowserWindow } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

import { BrowserWorkbenchManager } from "../../dist-electron/electron/browser-manager.js";

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForIdle = async (manager, timeoutMs = 8000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = manager.getState();
    if (state.url && !state.loading) {
      await sleep(150);
      return manager.getState();
    }
    await sleep(100);
  }
  return manager.getState();
};

const makeFixture = () => {
  const dir = join(tmpdir(), "tech-cc-hub-browser-smoke");
  mkdirSync(dir, { recursive: true });
  const first = join(dir, "first.html");
  const second = join(dir, "second.html");
  writeFileSync(first, `<!doctype html>
<html>
  <head>
    <title>Browser Smoke First</title>
    <meta name="description" content="Smoke fixture for browser workbench.">
    <link rel="canonical" href="https://example.test/browser-smoke-first">
  </head>
  <body>
    <main>
      <h1>Browser Workbench Smoke</h1>
      <h2>Links</h2>
      <p id="lead">This page verifies extract, inspect, capture, console, annotation and navigation.</p>
      <a href="https://example.com/docs">Docs Link</a>
      <img alt="Inline Dot" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='10' fill='%231683ff'/%3E%3C/svg%3E">
    </main>
    <script>console.log("BROWSER_SMOKE_CONSOLE_READY");</script>
  </body>
</html>`, "utf8");
  writeFileSync(second, `<!doctype html>
<html><head><title>Browser Smoke Second</title></head><body><h1>Second Page</h1></body></html>`, "utf8");
  return {
    firstUrl: pathToFileURL(first).toString(),
    secondUrl: pathToFileURL(second).toString(),
  };
};

const run = async () => {
  await app.whenReady();
  const window = new BrowserWindow({
    show: true,
    width: 1000,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const manager = new BrowserWorkbenchManager(window);
  manager.setBounds({ x: 0, y: 0, width: 900, height: 700 });
  const fixture = makeFixture();
  const checks = [];

  const check = async (name, fn) => {
    try {
      const detail = await fn();
      checks.push({ name, ok: true, detail });
    } catch (error) {
      checks.push({ name, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  };

  await check("open_page", async () => {
    manager.open(fixture.firstUrl);
    const state = await waitForIdle(manager);
    if (!state.url.includes("first.html")) throw new Error(`unexpected url: ${state.url}`);
    return { url: state.url, title: state.title };
  });

  await check("get_state", async () => {
    const state = manager.getState();
    if (!state.title?.includes("Browser Smoke First")) throw new Error(`unexpected title: ${state.title}`);
    return state;
  });

  await check("extract_page", async () => {
    const result = await manager.extractPageSnapshot();
    if (!result.success || !result.snapshot) throw new Error(result.error || "no snapshot");
    if (!result.snapshot.text.includes("Browser Workbench Smoke")) throw new Error("missing body text");
    if (!result.snapshot.links.some((item) => item.text === "Docs Link")) throw new Error("missing link");
    if (!result.snapshot.images.some((item) => item.alt === "Inline Dot")) throw new Error("missing image");
    return {
      title: result.snapshot.title,
      headings: result.snapshot.headings.length,
      links: result.snapshot.links.length,
      images: result.snapshot.images.length,
      textLength: result.snapshot.text.length,
    };
  });

  await check("console_logs", async () => {
    const logs = manager.getConsoleLogs(20);
    if (!logs.some((item) => item.message.includes("BROWSER_SMOKE_CONSOLE_READY"))) {
      throw new Error("missing console log");
    }
    return { count: logs.length };
  });

  await check("capture_visible", async () => {
    const result = await manager.captureVisible();
    if (!result.success || !result.dataUrl?.startsWith("data:image/png;base64,")) {
      throw new Error(result.error || "invalid screenshot");
    }
    return { dataUrlLength: result.dataUrl.length };
  });

  await check("inspect_at_point", async () => {
    const hint = await manager.inspectAtPoint({ x: 80, y: 80 });
    if (!hint?.tagName) throw new Error("missing DOM hint");
    return {
      tagName: hint.tagName,
      selector: hint.selector,
      text: hint.text?.slice(0, 80),
    };
  });

  await check("annotation_mode", async () => {
    const enabled = await manager.setAnnotationMode(true);
    const disabled = await manager.setAnnotationMode(false);
    if (!enabled.annotationMode || disabled.annotationMode) throw new Error("annotation toggle failed");
    return { enabled: enabled.annotationMode, disabled: disabled.annotationMode };
  });

  await check("reload", async () => {
    manager.reload();
    const state = await waitForIdle(manager);
    if (!state.url.includes("first.html")) throw new Error(`unexpected reload url: ${state.url}`);
    return { url: state.url, title: state.title };
  });

  await check("back_forward", async () => {
    manager.open(fixture.secondUrl);
    await waitForIdle(manager);
    const afterSecond = manager.getState();
    manager.goBack();
    const afterBack = await waitForIdle(manager);
    manager.goForward();
    const afterForward = await waitForIdle(manager);
    if (!afterSecond.canGoBack) throw new Error("back unavailable after second navigation");
    if (!afterBack.url.includes("first.html")) throw new Error(`back failed: ${afterBack.url}`);
    if (!afterForward.url.includes("second.html")) throw new Error(`forward failed: ${afterForward.url}`);
    return { backUrl: afterBack.url, forwardUrl: afterForward.url };
  });

  await check("close_page", async () => {
    const state = manager.close();
    if (state.url) throw new Error(`close still has url: ${state.url}`);
    return state;
  });

  console.log(JSON.stringify({
    ok: checks.every((item) => item.ok),
    checks,
  }, null, 2));

  window.destroy();
  app.quit();
};

run().catch((error) => {
  console.error(error);
  app.quit();
  process.exitCode = 1;
});
