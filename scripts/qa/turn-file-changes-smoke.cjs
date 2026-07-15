const { execFileSync, spawn } = require("node:child_process");
const { existsSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium, expect } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.TURN_FILE_CHANGES_QA_PORT || 4323);
const url = `http://127.0.0.1:${port}/?__tech_cc_hub_browser_preview=1`;
const artifactDir = path.join(repoRoot, ".omx", "artifacts");
const generatedScreenshot = path.join(artifactDir, "turn-file-changes-generated.png");
const referenceScreenshot = path.join(artifactDir, "turn-file-changes-reference.png");
const timeoutMs = Number(process.env.TURN_FILE_CHANGES_QA_TIMEOUT_MS || 60_000);

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

function buildMessages() {
  const assistantText = (text) => ({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
  });
  const edit = (id, filePath) => ({
    type: "assistant",
    message: {
      role: "assistant",
      content: [{
        type: "tool_use",
        id,
        name: "Edit",
        input: { file_path: filePath, old_string: "old", new_string: "new" },
      }],
    },
  });
  const result = (id) => ({
    type: "user",
    message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] },
  });

  return [
    { type: "user_prompt", prompt: "第一轮：修改两个文件，并把修改汇总放在本轮底部。", capturedAt: 1_783_900_000_000 },
    edit("qa-edit-1", "src/ui/first.ts"),
    result("qa-edit-1"),
    assistantText("第一处修改完成，继续处理第二个文件。"),
    edit("qa-edit-2", "src/ui/second.ts"),
    result("qa-edit-2"),
    assistantText("第一轮全部完成；文件修改卡片必须显示在这句话之后。"),
    { type: "user_prompt", prompt: "第二轮：只回复文字，不修改文件。", capturedAt: 1_783_900_002_000 },
    assistantText("第二轮没有文件修改，因此本轮底部不应出现修改卡片。"),
    { type: "user_prompt", prompt: "第三轮：再修改一个文件。", capturedAt: 1_783_900_004_000 },
    edit("qa-edit-3", "src/ui/third.ts"),
    result("qa-edit-3"),
    assistantText("第三轮完成；本轮修改卡片应位于这里之后。"),
  ];
}

async function main() {
  const server = startServer();
  let browser;
  try {
    await waitForServer();
    const executablePath = findBrowserExecutable();
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (/Failed to load resource: the server responded with a status of 404/i.test(message.text())) return;
      errors.push(message.text());
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await expect(page.locator("[data-prompt-composer]")).toBeVisible({ timeout: 15_000 });
    await page.evaluate(async (messages) => {
      const { useAppStore } = await import("/src/ui/store/useAppStore.ts");
      const sessionId = "qa-turn-file-changes";
      const handleServerEvent = useAppStore.getState().handleServerEvent;
      handleServerEvent({
        type: "session.list",
        payload: {
          sessions: [{
            id: sessionId,
            title: "每轮底部文件修改验收",
            status: "completed",
            cwd: "D:/tool/tech-cc-hub",
            model: "qa-model",
            runSurface: "development",
            slashCommands: [],
            createdAt: 1_783_900_000_000,
            updatedAt: 1_783_900_006_000,
          }],
        },
      });
      handleServerEvent({
        type: "session.history",
        payload: {
          sessionId,
          status: "completed",
          mode: "replace",
          hasMore: false,
          slashCommands: [],
          messages,
        },
      });
      useAppStore.getState().setActiveSessionId(sessionId);
    }, buildMessages());

    const cards = page.locator("[data-turn-file-changes]");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("已修改 2 个文件");
    await expect(cards.nth(1)).toContainText("已修改 1 个文件");

    const firstFinal = page.getByText("第一轮全部完成；文件修改卡片必须显示在这句话之后。", { exact: true });
    const secondSeparator = page.getByText("第 2 轮执行", { exact: true });
    const thirdFinal = page.getByText("第三轮完成；本轮修改卡片应位于这里之后。", { exact: true });
    await expect(firstFinal).toHaveCount(1);
    await expect(secondSeparator).toHaveCount(1);
    await expect(thirdFinal).toHaveCount(1);

    const firstCardHandle = await cards.nth(0).elementHandle();
    const secondSeparatorHandle = await secondSeparator.elementHandle();
    const secondCardHandle = await cards.nth(1).elementHandle();
    const order = {
      firstFinalBeforeCard: await firstFinal.evaluate(
        (left, right) => Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING),
        firstCardHandle,
      ),
      firstCardBeforeSecondRound: await cards.nth(0).evaluate(
        (left, right) => Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING),
        secondSeparatorHandle,
      ),
      thirdFinalBeforeCard: await thirdFinal.evaluate(
        (left, right) => Boolean(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING),
        secondCardHandle,
      ),
    };
    if (!Object.values(order).every(Boolean)) {
      throw new Error(`Turn footer DOM order is incorrect: ${JSON.stringify(order)}`);
    }

    mkdirSync(artifactDir, { recursive: true });
    await page.getByText("第二轮没有文件修改，因此本轮底部不应出现修改卡片。", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: referenceScreenshot });
    await cards.nth(0).scrollIntoViewIfNeeded();
    await page.screenshot({ path: generatedScreenshot });

    if (errors.length > 0) throw new Error(`Unexpected browser errors:\n${errors.join("\n")}`);
    console.log(JSON.stringify({
      status: "TURN_FILE_CHANGES_QA_OK",
      cards: 2,
      order,
      generatedScreenshot,
      referenceScreenshot,
    }));
  } finally {
    await browser?.close().catch(() => {});
    stopProcess(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
