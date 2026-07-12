const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.COLLAPSED_SESSION_RAIL_QA_PORT || 4321);
const timeoutMs = Number(process.env.COLLAPSED_SESSION_RAIL_QA_TIMEOUT_MS || 45000);
const baseUrl = `http://127.0.0.1:${port}`;
const qaUrl = `${baseUrl}/?__tech_cc_hub_browser_preview=1&qaCollapsedSessionRail=1`;
const artifactPath = path.join(repoRoot, ".omx", "artifacts", "collapsed-session-rail.png");
const githubTitle = "github提交下版本吧";
const githubSummary = "GitHub 最新已经是 v0.1.55，所以这次需要发 v0.1.56。但当前工作区还有约 60 个其他未提交修改，而刚才安装包也包含它们。请确认：v0.1.56 是否要包含这些修改。";
const backgroundTitle = "后台构建发布包";
const bottomTitle = "核对长回复的底部会话";
const markBTitle = "检查安装包清单";
const markBSummary = "安装包、blockmap 和 latest.yml 已经全部列入核对清单。";
const fallbackSummary = "暂无回复摘要";
const processShutdownTimeoutMs = 3_000;

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

function hasProcessExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForProcessExit(child, waitMs) {
  if (hasProcessExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.removeListener("exit", handleExit);
      resolve(exited);
    };
    const handleExit = () => finish(true);
    child.once("exit", handleExit);
    if (hasProcessExited(child)) {
      finish(true);
      return;
    }
    if (settled) return;
    timer = setTimeout(() => finish(hasProcessExited(child)), waitMs);
  });
}

function posixProcessGroupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    return true;
  }
}

function signalPosixProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

async function waitForPosixProcessGroupExit(child, pid, waitMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline && posixProcessGroupExists(pid)) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (posixProcessGroupExists(pid)) return false;
  await waitForProcessExit(child, Math.min(1_000, waitMs));
  return true;
}

async function stopProcessTree(child) {
  if (!child) return;
  if (process.platform === "win32") {
    if (hasProcessExited(child)) return;
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // The process may exit between the liveness check and taskkill.
    }
    await waitForProcessExit(child, processShutdownTimeoutMs);
    return;
  }

  const pid = child.pid;
  if (!pid) return;
  if (!posixProcessGroupExists(pid)) {
    await waitForProcessExit(child, 1_000);
    return;
  }
  signalPosixProcessGroup(pid, "SIGTERM");
  const terminated = await waitForPosixProcessGroupExit(child, pid, processShutdownTimeoutMs);
  if (!terminated) {
    signalPosixProcessGroup(pid, "SIGKILL");
    await waitForPosixProcessGroupExit(child, pid, processShutdownTimeoutMs);
  }
  await waitForProcessExit(child, 1_000);
}

async function waitForHttp(server) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
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
  throw new Error(`Timed out waiting for ${baseUrl}: ${lastError?.message || "unknown error"}`);
}

async function launchChromium() {
  const attempts = [
    { label: "Playwright Chromium", options: {} },
    { label: "installed Chrome", options: { channel: "chrome" } },
    { label: "installed Edge", options: { channel: "msedge" } },
  ];
  const failures = [];
  for (const attempt of attempts) {
    try {
      return await chromium.launch({ headless: true, ...attempt.options });
    } catch (error) {
      failures.push(`${attempt.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`Unable to launch Chromium.\n${failures.join("\n")}`);
}

async function waitForCardText(card, expected) {
  await card.waitFor({ state: "visible", timeout: timeoutMs });
  await card.locator("p").getByText(expected, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
}

async function assertUnreadAccent(button, expected, label) {
  const hasAccent = await button.locator("span").evaluateAll((spans) => (
    spans.some((span) => span.classList.contains("bg-accent"))
  ));
  assert.equal(hasAccent, expected, label);
}

async function assertCardWithinViewport(card, viewportHeight, label) {
  const box = await card.boundingBox();
  assert.ok(box, `${label}: preview card should have a bounding box`);
  assert.ok(
    box.y + box.height <= viewportHeight - 12 + 1,
    `${label}: card bottom ${box.y + box.height} exceeds ${viewportHeight - 12}`,
  );
}

async function installFallbackSummaryObserver(page) {
  await page.evaluate((expectedSummary) => {
    const state = { observed: false, observer: null };
    const inspect = () => {
      const summary = document.querySelector("[data-session-preview-card] p")?.textContent?.trim();
      if (summary !== expectedSummary) return;
      state.observed = true;
      state.observer?.disconnect();
      state.observer = null;
    };
    const observer = new MutationObserver(inspect);
    state.observer = observer;
    window.__collapsedSessionRailFallbackObservation = state;
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    inspect();
  }, fallbackSummary);
}

async function cleanupFallbackSummaryObserver(page) {
  if (!page) return;
  await page.evaluate(() => {
    const state = window.__collapsedSessionRailFallbackObservation;
    state?.observer?.disconnect();
    delete window.__collapsedSessionRailFallbackObservation;
  }).catch(() => {});
}

async function main() {
  let server = null;
  let browser = null;
  let page = null;
  const browserErrors = [];

  try {
    server = startDevServer();
    await waitForHttp(server);
    browser = await launchChromium();
    page = await browser.newPage({ viewport: { width: 900, height: 560 } });
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`[console:error] ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`[pageerror] ${error.stack || error.message}`));
    await page.route(/^http:\/\/localhost:(?:3000|4173|5173|8000|8001|8080)\/$/, (route) => route.abort("aborted"));

    await page.goto(qaUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const collapseButton = page.getByRole("button", { name: "收起左侧栏", exact: true });
    await collapseButton.waitFor({ state: "visible", timeout: timeoutMs });

    // The lifecycle transition intentionally happens while the full Sidebar owns the screen.
    await page.waitForTimeout(900);
    await collapseButton.click();

    const rail = page.locator("[data-collapsed-session-rail]");
    await rail.waitFor({ state: "visible", timeout: timeoutMs });
    const railButtons = rail.locator('button[aria-label^="打开会话："]');
    const railButtonCount = await railButtons.count();
    assert.ok(railButtonCount >= 8, `expected at least 8 collapsed session marks, received ${railButtonCount}`);

    const offsets = await page.evaluate(() => {
      const railElement = document.querySelector("[data-collapsed-session-rail]");
      const main = document.querySelector("main");
      const composer = document.querySelector("[data-prompt-composer]");
      if (!railElement || !main || !composer) return null;
      const railBox = railElement.getBoundingClientRect();
      return {
        railRight: railBox.right,
        mainLeft: main.getBoundingClientRect().left,
        composerLeft: composer.getBoundingClientRect().left,
      };
    });
    assert.ok(offsets, "rail, main, and composer should all be rendered");
    assert.ok(offsets.mainLeft >= offsets.railRight - 1, "main should be offset past the collapsed rail");
    assert.ok(offsets.composerLeft >= offsets.railRight - 1, "composer should be offset past the collapsed rail");

    await page.evaluate(() => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLButtonElement && activeElement.getAttribute("aria-label") === "展开左侧栏") {
        activeElement.blur();
      }
    });
    await page.mouse.move(899, 559);
    await page.waitForTimeout(220);
    const visibleTooltips = await page.evaluate(() => (
      Array.from(document.querySelectorAll("[role=tooltip]"))
        .map((tooltip) => ({
          text: tooltip.textContent?.trim() || "",
          opacity: Number.parseFloat(window.getComputedStyle(tooltip).opacity),
        }))
        .filter((tooltip) => tooltip.opacity > 0.01)
    ));
    assert.deepEqual(visibleTooltips, [], `tooltips must be hidden before screenshot: ${JSON.stringify(visibleTooltips)}`);

    const card = page.locator("[data-session-preview-card]");
    const githubMark = page.getByRole("button", { name: `打开会话：${githubTitle}`, exact: true });
    await githubMark.hover();
    await waitForCardText(card, githubSummary);
    assert.equal((await card.locator('[id$="-title"]').textContent())?.trim(), githubTitle);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({ path: artifactPath });

    // Focus belongs to mark A, but preview ownership moves to hovered mark B.
    const markA = page.getByRole("button", { name: "打开会话：梳理更新说明", exact: true });
    const markB = page.getByRole("button", { name: `打开会话：${markBTitle}`, exact: true });
    await markA.focus();
    await markB.hover();
    await waitForCardText(card, markBSummary);
    assert.equal((await card.locator('[id$="-title"]').textContent())?.trim(), markBTitle);
    await page.mouse.move(899, 559);
    await page.waitForTimeout(240);
    assert.equal(await card.count(), 0, "mark B preview should close even while mark A remains focused");

    await markB.focus();
    await card.waitFor({ state: "visible", timeout: timeoutMs });
    await markB.press("Escape");
    await card.waitFor({ state: "detached", timeout: timeoutMs });

    assert.notEqual(await markA.getAttribute("aria-current"), "page", "Enter target must start non-active");
    await markA.focus();
    await markA.press("Enter");
    await page.waitForFunction((title) => (
      document.querySelector(`button[aria-label="打开会话：${title}"]`)?.getAttribute("aria-current") === "page"
    ), "梳理更新说明", { timeout: timeoutMs });

    assert.notEqual(await markB.getAttribute("aria-current"), "page", "Space target must start non-active");
    await markB.focus();
    await markB.press("Space");
    await page.waitForFunction((title) => (
      document.querySelector(`button[aria-label="打开会话：${title}"]`)?.getAttribute("aria-current") === "page"
    ), markBTitle, { timeout: timeoutMs });
    assert.notEqual(await markA.getAttribute("aria-current"), "page", "Space selection must move away from the Enter target");

    const backgroundMark = page.getByRole("button", { name: `打开会话：${backgroundTitle}`, exact: true });
    await assertUnreadAccent(backgroundMark, true, "completed background session should be unread after collapse");
    await page.getByRole("button", { name: "展开左侧栏", exact: true }).click();
    await page.getByRole("button", { name: "收起左侧栏", exact: true }).click();
    await assertUnreadAccent(backgroundMark, true, "unread accent should survive expanding and collapsing the Sidebar");
    await backgroundMark.click();
    await page.waitForFunction((title) => (
      document.querySelector(`button[aria-label="打开会话：${title}"]`)?.getAttribute("aria-current") === "page"
    ), backgroundTitle, { timeout: timeoutMs });
    await assertUnreadAccent(backgroundMark, false, "selecting the completed background session should clear unread");

    const bottomMark = page.getByRole("button", { name: `打开会话：${bottomTitle}`, exact: true });
    await installFallbackSummaryObserver(page);
    await bottomMark.hover();
    await page.waitForFunction(() => (
      window.__collapsedSessionRailFallbackObservation?.observed === true
    ), undefined, { timeout: timeoutMs });
    await card.locator("p").getByText(/这是一段专门用于验证底部会话预览/, { exact: false }).waitFor({
      state: "visible",
      timeout: timeoutMs,
    });
    await cleanupFallbackSummaryObserver(page);
    await assertCardWithinViewport(card, 560, "initial clamp");

    await bottomMark.focus();
    await page.setViewportSize({ width: 900, height: 420 });
    await page.waitForTimeout(120);
    await assertCardWithinViewport(card, 420, "resize clamp");

    assert.deepEqual(browserErrors, [], `unexpected browser errors:\n${browserErrors.join("\n")}`);
    assert.ok(fs.statSync(artifactPath).size > 0, "screenshot artifact should be non-empty");
    console.log("COLLAPSED_SESSION_RAIL_QA_OK");
  } finally {
    await cleanupFallbackSummaryObserver(page);
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
    await stopProcessTree(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
