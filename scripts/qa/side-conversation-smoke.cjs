const { execFileSync, spawn } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.SIDE_CONVERSATION_QA_PORT || 4321);
const url = process.env.SIDE_CONVERSATION_QA_URL
  || `http://127.0.0.1:${port}/?__tech_cc_hub_browser_preview=1&qaSideConversation=1`;
const artifactPath = path.join(repoRoot, ".omx", "artifacts", "side-conversation.png");
const selectionArtifactPath = path.join(repoRoot, ".omx", "artifacts", "side-conversation-selection.png");
const timeoutMs = Number(process.env.SIDE_CONVERSATION_QA_TIMEOUT_MS || 60000);

function startServer() {
  const args = ["run", "dev:react", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  const child = process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
        cwd: repoRoot,
        env: process.env,
        stdio: "pipe",
        windowsHide: true,
      })
    : spawn("npm", args, { cwd: repoRoot, env: process.env, stdio: "pipe" });
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
      // The process may exit between the liveness check and taskkill.
    }
    return;
  }
  child.kill("SIGTERM");
}

async function waitForServer() {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "unknown error"}`);
}

function findBrowserExecutable() {
  return [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : undefined,
    process.platform === "win32" ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" : undefined,
  ].filter(Boolean).find((candidate) => existsSync(candidate));
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer();
    const executablePath = findBrowserExecutable();
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (/Failed to load resource: the server responded with a status of 404/i.test(message.text())) return;
      errors.push(message.text());
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await expect(page.locator("[data-prompt-composer]")).toBeVisible({ timeout: 15000 });
    const primaryTitle = await page.locator("[data-active-session-title]").textContent();
    if (!primaryTitle?.trim()) throw new Error("Primary session title fixture is missing");

    const selectedText = "主对话初始回复";
    const selectionTarget = page.getByText(selectedText, { exact: true });
    const openFromSelection = async () => {
      await expect(selectionTarget).toBeVisible();
      await selectionTarget.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      });
      await expect(page.getByRole("button", { name: "侧边对话", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "侧边对话", exact: true }).click();
    };

    await openFromSelection();
    mkdirSync(path.dirname(selectionArtifactPath), { recursive: true });
    await page.screenshot({ path: selectionArtifactPath, fullPage: true });
    const sideWorkspace = page.locator('section[aria-label="侧边对话"]');
    await expect(sideWorkspace).toBeVisible();
    const sidePanel = page.getByRole("region", { name: "侧边对话消息" });
    await expect(sidePanel).toContainText("这是临时侧聊，不会写入主会话。");
    await expect(sidePanel).not.toContainText(selectedText);
    await expect(page.locator("[data-prompt-composer]")).toHaveCount(2);

    const mainComposer = page.locator("[data-prompt-composer]").nth(0).getByRole("textbox", { name: "输入提示" });
    let sideComposer = sideWorkspace.getByRole("textbox", { name: "输入提示" });
    await mainComposer.fill("MAIN_DRAFT");
    await sideComposer.fill("SIDE_A_1");
    await expect(mainComposer).toHaveText("MAIN_DRAFT");
    await expect(sideComposer).toHaveText("SIDE_A_1");
    await sideComposer.press("Enter");
    await expect(sidePanel).toContainText("SIDE_OK 1: SIDE_A_1");
    await expect(mainComposer).toHaveText("MAIN_DRAFT");

    const workspaceTabs = page.locator(".activity-workspace-tabs-scroll");
    await expect(workspaceTabs.getByRole("button", { name: "侧聊", exact: true })).toBeVisible();
    await workspaceTabs.getByRole("button", { name: "浏览器", exact: true }).click();
    await expect(page.getByText("最近 / 本地", { exact: true })).toBeVisible();
    await expect(workspaceTabs.getByRole("button", { name: "侧聊", exact: true })).toBeVisible();
    await workspaceTabs.getByRole("button", { name: "侧聊", exact: true }).click();
    await expect(sideWorkspace).toBeVisible();
    await expect(sidePanel).toContainText("SIDE_OK 1: SIDE_A_1");

    await page.getByRole("button", { name: "新建侧聊线程" }).click();
    await expect(sideWorkspace.getByRole("tab")).toHaveCount(2);
    await expect(sideWorkspace.getByRole("tab", { name: "侧聊 2" })).toHaveAttribute("aria-selected", "true");
    sideComposer = sideWorkspace.getByRole("textbox", { name: "输入提示" });
    await expect(sideComposer).toHaveText("");
    await sideComposer.fill("SIDE_B_1");
    await sideComposer.press("Enter");
    await expect(sidePanel).toContainText("SIDE_OK 1: SIDE_B_1");
    await sideComposer.fill("SIDE_B_2");
    await sideComposer.press("Enter");
    await expect(sidePanel).toContainText("SIDE_OK 2: SIDE_B_2");

    await sideWorkspace.getByRole("tab", { name: "侧聊 1" }).click();
    await expect(sidePanel).toContainText("SIDE_OK 1: SIDE_A_1");
    sideComposer = sideWorkspace.getByRole("textbox", { name: "输入提示" });
    await sideComposer.fill("SIDE_A_2");
    await sideComposer.press("Enter");
    await expect(sidePanel).toContainText("SIDE_OK 2: SIDE_A_2");

    await sideWorkspace.getByRole("tab", { name: "侧聊 2" }).click();
    await page.getByRole("button", { name: "关闭 侧聊 2" }).click();
    await expect(sideWorkspace.getByRole("tab")).toHaveCount(1);
    await expect(sidePanel).toContainText("SIDE_OK 2: SIDE_A_2");
    await expect(page.getByText(selectedText, { exact: true })).toHaveCount(1);
    await expect(page.locator("[data-active-session-title]")).toHaveText(primaryTitle);

    mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({ path: artifactPath, fullPage: true });

    await page.locator('button[aria-label="关闭侧聊标签"]').evaluate((button) => button.click());
    await expect(sideWorkspace).toHaveCount(0);
    await expect(page.locator("[data-prompt-composer]")).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "输入提示" })).toHaveText("MAIN_DRAFT");

    await openFromSelection();
    const reopenedWorkspace = page.locator('section[aria-label="侧边对话"]');
    await expect(reopenedWorkspace).toBeVisible();
    await expect(reopenedWorkspace.getByRole("tab")).toHaveCount(1);
    await expect(reopenedWorkspace).not.toContainText("SIDE_A_1");
    await expect(reopenedWorkspace).not.toContainText("SIDE_B_1");
    if (errors.length > 0) throw new Error(`Unexpected browser errors:\n${errors.join("\n")}`);
    console.log(`SIDE_CONVERSATION_QA_OK ${artifactPath} ${selectionArtifactPath}`);
  } finally {
    await browser?.close().catch(() => {});
    stopProcess(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
