const { execFileSync, spawn } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.SIDE_CONVERSATION_QA_PORT || 4321);
const url = process.env.SIDE_CONVERSATION_QA_URL
  || `http://127.0.0.1:${port}/?__tech_cc_hub_browser_preview=1&qaSideConversation=1`;
const artifactPath = path.join(repoRoot, ".omx", "artifacts", "side-conversation.png");
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

    await page.getByRole("button", { name: "添加工作区标签" }).click();
    await page.getByRole("menuitem", { name: /侧聊/ }).click();
    await expect(page.getByRole("button", { name: "侧聊", exact: true })).toBeVisible();
    await page.getByLabel("选择侧聊会话").selectOption("qa-side-secondary");
    await expect(page.getByRole("region", { name: "侧聊消息" })).toContainText("侧聊初始回复");

    await page.getByLabel("输入侧聊消息").fill("只回复 SIDE_OK");
    await page.getByLabel("输入侧聊消息").press("Enter");
    const sideMessages = page.getByRole("region", { name: "侧聊消息" });
    await expect(sideMessages).toContainText("SIDE_OK");
    await expect(sideMessages.getByText("只回复 SIDE_OK", { exact: true })).toHaveCount(1);
    await expect(sideMessages.getByText("SIDE_OK", { exact: true })).toHaveCount(1);
    await expect(page.locator("[data-active-session-title]")).toHaveText(primaryTitle);

    mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({ path: artifactPath, fullPage: true });
    if (errors.length > 0) throw new Error(`Unexpected browser errors:\n${errors.join("\n")}`);
    console.log(`SIDE_CONVERSATION_QA_OK ${artifactPath}`);
  } finally {
    await browser?.close().catch(() => {});
    stopProcess(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
