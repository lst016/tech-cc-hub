const { execFileSync, spawn } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const previewPort = Number(process.env.SIDEBAR_PLAN_PREVIEW_QA_PORT || 4317);
const previewUrl = process.env.SIDEBAR_PLAN_PREVIEW_QA_URL
  || `http://127.0.0.1:${previewPort}/?__tech_cc_hub_browser_preview=1&qaPlanPreview=1`;
const artifactPath = path.join(repoRoot, ".omx", "artifacts", "sidebar-plan-preview.png");
const timeoutMs = Number(process.env.SIDEBAR_PLAN_PREVIEW_QA_TIMEOUT_MS || 60000);

function startPreviewServer() {
  const args = ["run", "dev:react", "--", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"];
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
  child.kill("SIGTERM");
}

async function waitForPreview() {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(previewUrl, { redirect: "manual" });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${previewUrl}: ${lastError?.message || "unknown error"}`);
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
  const preview = startPreviewServer();
  let browser;
  try {
    await waitForPreview();
    const executablePath = findBrowserExecutable();
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage({ viewport: { width: 1200, height: 820 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      errors.push(text);
    });

    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const sidebar = page.locator("aside.left-0");
    await expect(sidebar).toBeVisible({ timeout: 15000 });

    const workspaceButton = sidebar.getByRole("button", { name: /tech-cc-hub/i }).first();
    await expect(workspaceButton).toBeVisible();
    await workspaceButton.click();

    const planButton = sidebar.locator('button[aria-label^="查看执行计划"]');
    await expect(planButton).toBeVisible({ timeout: 10000 });
    await planButton.hover();

    const previewCard = page.locator("[data-session-plan-preview]");
    await expect(previewCard).toBeVisible();
    await expect(previewCard.getByText("检查聊天列表现有数据链路", { exact: true })).toBeVisible();
    await expect(previewCard.getByText("实现计划清单悬浮预览", { exact: true })).toBeVisible();
    await expect(previewCard.getByText("验证键盘与边界定位", { exact: true })).toBeVisible();
    await expect(previewCard.getByText("运行定向测试与视觉验收", { exact: true })).toBeVisible();
    await expect(previewCard.locator('[data-plan-step-status="completed"]')).toHaveCount(2);
    await expect(previewCard.locator('[data-plan-step-status="in_progress"]')).toHaveCount(1);
    await expect(previewCard.locator('[data-plan-step-status="pending"]')).toHaveCount(1);

    mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({ path: artifactPath, fullPage: true });

    await planButton.focus();
    await expect(previewCard).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(previewCard).toBeHidden();

    if (errors.length > 0) {
      throw new Error(`Unexpected browser errors:\n${errors.join("\n")}`);
    }

    console.log(`SIDEBAR_PLAN_PREVIEW_QA_OK ${artifactPath}`);
  } finally {
    await browser?.close().catch(() => {});
    stopProcess(preview);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
