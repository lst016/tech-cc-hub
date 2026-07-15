const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.CRON_UI_QA_PORT || 4324);
const timeoutMs = Number(process.env.CRON_UI_QA_TIMEOUT_MS || 45_000);
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = path.join(repoRoot, ".omx", "artifacts", "cron-ui");

function qaUrl(scenario) {
  return `${baseUrl}/?__tech_cc_hub_browser_preview=1&qaCron=${scenario}`;
}

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

function watchBrowserErrors(page) {
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  return browserErrors;
}

async function openCronPage(page, scenario) {
  await page.goto(qaUrl(scenario), { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.getByRole("button", { name: "定时任务", exact: true }).click();
  await page.getByRole("heading", { name: "定时任务", exact: true }).waitFor({ timeout: timeoutMs });
  await page.waitForTimeout(100);

  const layout = await page.evaluate(() => ({
    title: document.title,
    meaningfulText: document.body.innerText.trim().length,
    hasFrameworkOverlay: Boolean(document.querySelector("vite-error-overlay, nextjs-portal")),
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));
  assert.ok(layout.title, "page should have a title");
  assert.ok(layout.meaningfulText > 50, "page should render meaningful content");
  assert.equal(layout.hasFrameworkOverlay, false, "page should not show a framework error overlay");
  assert.equal(layout.horizontalOverflow, false, "page should not overflow horizontally");
}

async function verifyPopulated(page) {
  const browserErrors = watchBrowserErrors(page);
  await openCronPage(page, "populated");

  for (const name of ["每日产品晨报", "周度项目复盘", "发布健康检查", "手动整理变更记录"]) {
    await page.getByText(name, { exact: true }).first().waitFor({ timeout: timeoutMs });
  }
  for (const label of [/总任务|全部任务/, /运行中|已启用/, /已暂停/, /异常/]) {
    await page.getByText(label).first().waitFor({ timeout: timeoutMs });
  }

  const card = page.getByRole("button", { name: "查看任务 每日产品晨报" });
  await card.focus();
  await page.keyboard.press("Enter");
  const detail = page.locator('aside[aria-label="任务详情：每日产品晨报"]');
  await detail.getByRole("heading", { name: "每日产品晨报", exact: true }).waitFor({ timeout: timeoutMs });

  const toggle = page.getByRole("switch", { name: "暂停任务 每日产品晨报" });
  await toggle.focus();
  await page.keyboard.press("Space");
  const pausedToggle = page.getByRole("switch", { name: "启用任务 每日产品晨报" });
  await pausedToggle.waitFor({ state: "visible", timeout: timeoutMs });
  assert.equal(await pausedToggle.isChecked(), false);

  await detail.getByRole("button", { name: "删除任务", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: /删除定时任务/ });
  await confirmation.waitFor({ state: "visible", timeout: timeoutMs });
  await confirmation.getByRole("button", { name: "取消", exact: true }).click();

  await page.getByRole("button", { name: "新建任务", exact: true }).first().click();
  await page.getByRole("dialog", { name: "新建定时任务" }).waitFor({ state: "visible", timeout: timeoutMs });
  assert.deepEqual(browserErrors, [], `unexpected populated-state browser errors:\n${browserErrors.join("\n")}`);
}

async function verifyEmpty(page) {
  const browserErrors = watchBrowserErrors(page);
  await openCronPage(page, "empty");
  await page.getByText(/暂无定时任务|还没有定时任务/).first().waitFor({ timeout: timeoutMs });
  await page.getByRole("button", { name: "新建任务", exact: true }).first().waitFor({ timeout: timeoutMs });
  assert.deepEqual(browserErrors, [], `unexpected empty-state browser errors:\n${browserErrors.join("\n")}`);
}

async function verifyError(page) {
  const browserErrors = watchBrowserErrors(page);
  await openCronPage(page, "error");
  await page.getByText(/加载.*失败|无法加载|获取任务失败/).first().waitFor({ timeout: timeoutMs });
  assert.ok(
    browserErrors.every((message) => message.includes("定时任务预览数据加载失败") || message.includes("useAllCronJobs")),
    `unexpected error-state browser errors:\n${browserErrors.join("\n")}`,
  );
}

async function captureScenario(browser, scenario, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const browserErrors = watchBrowserErrors(page);
  try {
    await openCronPage(page, scenario);
    if (scenario === "populated") {
      await page.getByText("每日产品晨报", { exact: true }).first().waitFor({ timeout: timeoutMs });
    } else if (scenario === "empty") {
      await page.getByText(/暂无定时任务|还没有定时任务/).first().waitFor({ timeout: timeoutMs });
    } else {
      await page.getByText(/加载.*失败|无法加载|获取任务失败/).first().waitFor({ timeout: timeoutMs });
    }
    const fileName = `${scenario}-${viewport.width}x${viewport.height}.png`;
    const artifactPath = path.join(artifactDir, fileName);
    await page.screenshot({ path: artifactPath, fullPage: true });
    assert.ok(fs.statSync(artifactPath).size > 0, `${fileName} should be non-empty`);
    if (scenario !== "error") {
      assert.deepEqual(browserErrors, [], `unexpected ${scenario} screenshot errors:\n${browserErrors.join("\n")}`);
    }
  } finally {
    await page.close();
  }
}

async function captureCreateDialog(browser, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const browserErrors = watchBrowserErrors(page);
  try {
    await openCronPage(page, "populated");
    await page.getByRole("button", { name: "新建任务", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新建定时任务" });
    await dialog.waitFor({ state: "visible", timeout: timeoutMs });
    const bounds = await dialog.locator(":scope > div").first().boundingBox();
    assert.ok(bounds, "create dialog should have visible bounds");
    assert.ok(bounds.x >= 0 && bounds.y >= 0, "create dialog should stay inside the top-left viewport bounds");
    assert.ok(bounds.x + bounds.width <= viewport.width + 1, "create dialog should fit the viewport width");
    assert.ok(bounds.y + bounds.height <= viewport.height + 1, "create dialog should fit the viewport height");

    const fileName = `create-dialog-${viewport.width}x${viewport.height}.png`;
    const artifactPath = path.join(artifactDir, fileName);
    await page.screenshot({ path: artifactPath });
    assert.ok(fs.statSync(artifactPath).size > 0, `${fileName} should be non-empty`);
    assert.deepEqual(browserErrors, [], `unexpected create-dialog browser errors:\n${browserErrors.join("\n")}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const server = startDevServer();
  let browser;
  try {
    await waitForHttp(server);
    fs.mkdirSync(artifactDir, { recursive: true });
    browser = await chromium.launch({ headless: true });

    const populatedPage = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    try {
      await verifyPopulated(populatedPage);
    } finally {
      await populatedPage.close();
    }

    const emptyPage = await browser.newPage({ viewport: { width: 960, height: 900 }, deviceScaleFactor: 1 });
    try {
      await verifyEmpty(emptyPage);
    } finally {
      await emptyPage.close();
    }

    const errorPage = await browser.newPage({ viewport: { width: 960, height: 900 }, deviceScaleFactor: 1 });
    try {
      await verifyError(errorPage);
    } finally {
      await errorPage.close();
    }

    for (const scenario of ["populated", "empty", "error"]) {
      await captureScenario(browser, scenario, { width: 1600, height: 1000 });
      await captureScenario(browser, scenario, { width: 960, height: 900 });
    }
    await captureCreateDialog(browser, { width: 1600, height: 1000 });
    await captureCreateDialog(browser, { width: 960, height: 900 });

    console.log("CRON_UI_QA_OK");
  } finally {
    await browser?.close().catch(() => {});
    await stopProcessTree(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
