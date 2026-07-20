const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.WOO_AUTH_SIDEBAR_QA_PORT || 4326);
const timeoutMs = Number(process.env.WOO_AUTH_SIDEBAR_QA_TIMEOUT_MS || 60_000);
const previewUrl = `http://127.0.0.1:${port}/?__tech_cc_hub_browser_preview=1&qaWooAuth=1`;
const artifactPath = path.join(repoRoot, ".omx", "artifacts", "woo-auth-sidebar.png");
const avatarArtifactPath = path.join(repoRoot, ".omx", "artifacts", "woo-auth-avatar.png");
const accountMenuArtifactPath = path.join(repoRoot, ".omx", "artifacts", "woo-account-menu.png");

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
    const page = await browser.newPage({ viewport: { width: 2048, height: 1250 }, deviceScaleFactor: 1 });
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      browserErrors.push(`console: ${text}`);
    });
    const avatarRequests = [];
    await page.route("https://s1-imfile.feishucdn.com/**", async (route) => {
      avatarRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="36" fill="#df6634"/><text x="36" y="45" text-anchor="middle" font-family="sans-serif" font-size="30" font-weight="700" fill="white">W</text></svg>',
      });
    });

    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const sidebar = page.locator("[data-session-sidebar]");
    await expect(sidebar).toBeVisible({ timeout: timeoutMs });

    const trigger = page.locator("[data-woo-auth-trigger]");
    const sidebarSettings = sidebar.getByRole("button", { name: "设置", exact: true });
    await expect(trigger).toBeVisible();
    await expect(sidebarSettings).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    const popover = page.locator("[data-woo-auth-popover]");
    await expect(popover).toHaveCount(0);
    await expect(page.getByLabel("用户名")).toHaveCount(0);
    await expect(page.locator(".fixed.inset-0.bg-black\\/35")).toHaveCount(0);

    const layout = await page.evaluate(() => {
      const sidebarElement = document.querySelector("[data-session-sidebar]");
      const triggerElement = document.querySelector("[data-woo-auth-trigger]");
      const cronElement = document.querySelector('button[aria-label="定时任务"]');
      const settingsElement = document.querySelector('button[aria-label="设置"]');
      if (![sidebarElement, triggerElement, cronElement, settingsElement].every((item) => item instanceof HTMLElement)) return null;
      const sidebarRect = sidebarElement.getBoundingClientRect();
      const triggerRect = triggerElement.getBoundingClientRect();
      const cronRect = cronElement.getBoundingClientRect();
      const settingsRect = settingsElement.getBoundingClientRect();
      return {
        accountIsLast: cronRect.bottom <= settingsRect.top && settingsRect.bottom <= triggerRect.top,
        accountAtBottom: sidebarRect.bottom - triggerRect.bottom <= 12,
      };
    });
    assert.deepEqual(layout, {
      accountIsLast: true,
      accountAtBottom: true,
    });

    mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({ path: artifactPath, fullPage: true });

    await trigger.click();
    await expect(popover).toBeVisible();
    await popover.getByRole("button", { name: "使用浏览器登录 Woo" }).click();
    await expect(popover).toBeHidden();
    await expect(trigger).toContainText("Woo QA 用户");
    assert.equal(
      await page.evaluate(() => window.sessionStorage.getItem("qa:woo-last-auth-channel")),
      "woo-auth:login-third-party",
    );
    await expect(sidebarSettings).toHaveCount(0);
    const sidebarAvatar = trigger.locator("[data-woo-avatar]");
    await expect(sidebarAvatar).toBeVisible();
    await expect.poll(async () => sidebarAvatar.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
    assert.ok(avatarRequests.length > 0, "Woo avatar request did not reach the allowed Feishu CDN");
    await page.screenshot({ path: avatarArtifactPath, fullPage: true });

    await trigger.click();
    await expect(popover).toBeVisible();
    await expect(popover.getByText("Woo QA 用户", { exact: true })).toBeVisible();
    const accountMenu = popover.getByRole("menu", { name: "Woo 账号菜单" });
    await expect(accountMenu).toBeVisible();
    await expect(sidebarSettings).toHaveCount(0);
    for (const itemName of ["剩余用量", "设置", "退出登录"]) {
      await expect(accountMenu.getByRole("menuitem", { name: itemName })).toBeVisible();
    }
    assert.equal(await accountMenu.getByRole("menuitem", { name: "隐藏宠物" }).count(), 0);
    assert.equal(await accountMenu.getByRole("menuitem", { name: "邀请好友" }).count(), 0);
    await expect(accountMenu.getByText("Ctrl+,", { exact: true })).toHaveCount(0);
    const menuBox = await popover.boundingBox();
    const triggerBox = await trigger.boundingBox();
    assert.ok(menuBox && triggerBox, "account menu capture bounds are unavailable");
    await page.mouse.move(500, 300);
    await page.screenshot({
      path: accountMenuArtifactPath,
      clip: {
        x: Math.max(0, Math.min(menuBox.x, triggerBox.x) - 6),
        y: Math.max(0, menuBox.y - 6),
        width: Math.max(menuBox.width, triggerBox.width) + 12,
        height: triggerBox.y + triggerBox.height - menuBox.y + 12,
      },
    });

    await page.setViewportSize({ width: 900, height: 560 });
    const authenticatedCompactLayout = await popover.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        insideViewport: rect.top >= 0 && rect.left >= 0 && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
        noDocumentOverflow: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });
    assert.deepEqual(authenticatedCompactLayout, { insideViewport: true, noDocumentOverflow: true });
    await page.setViewportSize({ width: 2048, height: 1250 });
    await accountMenu.getByRole("menuitem", { name: "剩余用量" }).click();
    await expect(popover).toBeHidden();
    assert.equal(
      await page.evaluate(() => window.sessionStorage.getItem("qa:woo-last-external-url")),
      "https://dream.pocketcity.com/user",
    );

    await sidebarAvatar.evaluate((image) => image.dispatchEvent(new Event("error")));
    await expect(trigger.locator("[data-woo-avatar-fallback]")).toBeVisible();
    await expect(sidebarAvatar).toHaveCount(0);

    await trigger.click();
    await popover.getByRole("menuitem", { name: "退出登录" }).click();
    await expect(popover).toBeHidden();
    await expect(trigger).toContainText("登录 Woo 账号");
    await expect(sidebarSettings).toBeVisible();

    await page.setViewportSize({ width: 900, height: 560 });
    await trigger.click();
    await expect(popover).toBeVisible();
    await popover.getByRole("button", { name: "使用浏览器登录 Woo" }).click();
    await expect(popover).toBeHidden();
    await expect(trigger).toContainText("Woo QA 用户");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

    assert.deepEqual(browserErrors, [], `unexpected browser errors:\n${browserErrors.join("\n")}`);
    console.log(`WOO_AUTH_SIDEBAR_QA_OK ${artifactPath} ${avatarArtifactPath} ${accountMenuArtifactPath}`);
  } finally {
    await browser?.close().catch(() => {});
    stopProcess(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
