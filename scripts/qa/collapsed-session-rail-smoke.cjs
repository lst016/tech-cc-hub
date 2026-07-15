const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.COLLAPSED_SESSION_RAIL_QA_PORT || 4321);
const timeoutMs = Number(process.env.COLLAPSED_SESSION_RAIL_QA_TIMEOUT_MS || 45_000);
const baseUrl = `http://127.0.0.1:${port}`;
const qaUrl = `${baseUrl}/?__tech_cc_hub_browser_preview=1&qaCollapsedSessionRail=1`;
const artifactPath = path.join(repoRoot, ".omx", "artifacts", "collapsed-sidebar-hidden.png");

function startDevServer() {
  const args = ["run", "dev:react", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  const child = process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
        cwd: repoRoot,
        env: process.env,
        stdio: "pipe",
        windowsHide: true,
      })
    : spawn("npm", args, {
        cwd: repoRoot,
        env: process.env,
        stdio: "pipe",
        detached: true,
      });

  child.stdout?.on("data", (chunk) => process.stdout.write(String(chunk)));
  child.stderr?.on("data", (chunk) => process.stderr.write(String(chunk)));
  return child;
}

async function waitForHttp(server) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited before becoming ready (exit ${server.exitCode}).`);
    }
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error("Timed out waiting for Vite.");
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // The process may exit between the liveness check and taskkill.
    }
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function main() {
  const server = startDevServer();
  let browser;
  let page;
  try {
    await waitForHttp(server);
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });

    await page.goto(qaUrl, { waitUntil: "networkidle", timeout: timeoutMs });
    const sidebar = page.locator("[data-session-sidebar]");
    await sidebar.waitFor({ state: "visible", timeout: timeoutMs });

    await page.getByRole("button", { name: "收起左侧栏", exact: true }).click();
    await sidebar.waitFor({ state: "detached", timeout: timeoutMs });

    const collapsedLayout = await page.evaluate(() => {
      const main = document.querySelector("main");
      const composer = document.querySelector("[data-prompt-composer]");
      if (!main || !composer) return null;
      return {
        railCount: document.querySelectorAll("[data-collapsed-session-rail]").length,
        mainMarginLeft: window.getComputedStyle(main).marginLeft,
        composerMarginLeft: window.getComputedStyle(composer).marginLeft,
      };
    });
    assert.deepEqual(collapsedLayout, {
      railCount: 0,
      mainMarginLeft: "0px",
      composerMarginLeft: "0px",
    });

    await page.mouse.move(899, 559);
    await page.waitForTimeout(160);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({ path: artifactPath });
    assert.ok(fs.statSync(artifactPath).size > 0, "collapsed-state screenshot should be non-empty");

    await page.getByRole("button", { name: "展开左侧栏", exact: true }).click();
    await sidebar.waitFor({ state: "visible", timeout: timeoutMs });
    assert.deepEqual(browserErrors, [], `unexpected browser errors:\n${browserErrors.join("\n")}`);
    console.log("COLLAPSED_SIDEBAR_HIDDEN_QA_OK");
  } finally {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await stopProcessTree(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
