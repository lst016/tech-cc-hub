const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { existsSync, statSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.SLASH_COMMAND_QA_PORT || 4327);
const timeoutMs = Number(process.env.SLASH_COMMAND_QA_TIMEOUT_MS || 60_000);
const previewUrl = `http://127.0.0.1:${port}/?__tech_cc_hub_browser_preview=1`;
const artifactPath = path.join(tmpdir(), "tech-cc-hub-slash-command.png");

function startPreviewServer() {
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

function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } catch {
      // The process can exit between the liveness check and taskkill.
    }
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForPreview(server) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited before becoming ready (exit ${server.exitCode}).`);
    try {
      const response = await fetch(previewUrl, { redirect: "manual" });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw lastError || new Error(`Timed out waiting for ${previewUrl}`);
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined,
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

async function main() {
  const server = startPreviewServer();
  let browser;
  try {
    await waitForPreview(server);
    const executablePath = findBrowserExecutable();
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      browserErrors.push(`console: ${text}`);
    });

    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const trigger = page.getByRole("button", { name: "打开 Slash 命令列表" });
    await expect(trigger).toBeVisible({ timeout: timeoutMs });
    await expect(trigger.locator("svg.lucide-slash")).toHaveCount(1);
    await expect(trigger.locator("svg.lucide-plus")).toHaveCount(0);

    await trigger.click();
    await expect(page.getByText("可用 Slash 命令", { exact: true })).toBeVisible();
    await expect(page.getByText("Codex 会话命令", { exact: true })).toBeVisible();
    await page.screenshot({ path: artifactPath, fullPage: true });

    await page.setViewportSize({ width: 1100, height: 700 });
    await expect(trigger).toBeVisible();
    const box = await trigger.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 1100, "Slash button should stay inside the compact viewport");
    assert.deepEqual(browserErrors, [], `unexpected browser errors:\n${browserErrors.join("\n")}`);
    assert.ok(statSync(artifactPath).size > 0, "Slash command screenshot should be non-empty");

    console.log(`SLASH_COMMAND_QA_OK ${artifactPath}`);
  } finally {
    await browser?.close().catch(() => {});
    stopProcess(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
