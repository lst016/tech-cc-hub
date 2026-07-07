const { execFileSync, spawn } = require("node:child_process");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const previewPort = Number(process.env.CHAT_SELECTION_COMMENT_QA_PORT || 4175);
const previewUrl = process.env.CHAT_SELECTION_COMMENT_QA_URL || `http://127.0.0.1:${previewPort}/`;
const previewTimeoutMs = Number(process.env.CHAT_SELECTION_COMMENT_QA_TIMEOUT_MS || 45000);
const expectedErrorPatterns = [
  /Content Security Policy/i,
  /Refused to connect/i,
  /Fetch API cannot load http:\/\/localhost/i,
  /Failed to load resource: the server responded with a status of 500/i,
];
const seedReadyText = [
  "artificialEnterCount",
  "userInfoDescription/index.vue:22",
];

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
      // The child can exit between the liveness check and taskkill.
    }
    return;
  }
  child.kill("SIGTERM");
}

async function waitForPreview() {
  const deadline = Date.now() + previewTimeoutMs;
  let lastError = null;
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
  throw new Error(`Timed out waiting for preview server at ${previewUrl}: ${lastError?.message || "unknown error"}`);
}

async function seedAssistantConversationUntilVisible(page) {
  let lastSnapshot = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.evaluate(() => {
      window.__TECH_CC_HUB_QA__.seedAssistantConversation();
    });
    await page.waitForTimeout(attempt === 1 ? 400 : 1200);

    const snapshot = await page.evaluate((expectedTexts) => {
      const bodyText = document.body.innerText;
      return {
        ready: expectedTexts.every((text) => bodyText.includes(text)),
        bodyText: bodyText.slice(0, 2000),
      };
    }, seedReadyText);
    if (snapshot.ready) {
      return;
    }
    lastSnapshot = snapshot;
  }

  throw new Error(`Seeded assistant conversation never became visible.\nSnapshot: ${JSON.stringify(lastSnapshot)}`);
}

async function main() {
  const preview = startPreviewServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const logs = [];
  page.on("console", (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => logs.push(`[pageerror] ${error.stack || error.message}`));

  try {
    await waitForPreview();
    await page.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: previewTimeoutMs });

    try {
      await page.waitForFunction(() => Boolean(window.__TECH_CC_HUB_QA__), { timeout: previewTimeoutMs });
    } catch (error) {
      const snapshot = await page.evaluate(() => ({
        readyState: document.readyState,
        hasQaApi: Boolean(window.__TECH_CC_HUB_QA__),
        rootText: document.getElementById("root")?.innerText?.slice(0, 400) || "",
        bodyText: document.body.innerText.slice(0, 400),
      }));
      const diagnostic = [
        error instanceof Error ? error.message : String(error),
        `Snapshot: ${JSON.stringify(snapshot)}`,
        logs.length > 0 ? `Logs:\n${logs.join("\n")}` : "Logs: <empty>",
      ].join("\n");
      throw new Error(diagnostic);
    }

    await seedAssistantConversationUntilVisible(page);

    const selectionResult = await page.evaluate(() => {
      const paragraph = Array.from(document.querySelectorAll("p")).find((element) => (
        element.textContent?.includes("userInfoDescription/index.vue:22")
        && element.textContent?.includes("artificialEnterCount")
      ));
      if (!paragraph) return { ok: false, reason: "assistant paragraph not found" };

      paragraph.scrollIntoView({ block: "center" });
      const walker = document.createTreeWalker(
        paragraph,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            return node.textContent?.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP;
          },
        },
      );

      const entries = [];
      let current = walker.nextNode();
      while (current) {
        const text = current.textContent || "";
        entries.push({ node: current, text });
        current = walker.nextNode();
      }

      const firstEntry = entries[0];
      const lastEntry = entries.at(-1);
      if (!firstEntry || !lastEntry) {
        return { ok: false, reason: "assistant paragraph has no selectable text nodes" };
      }

      const range = document.createRange();
      range.setStart(firstEntry.node, 0);
      range.setEnd(lastEntry.node, lastEntry.text.length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
      paragraph.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      return {
        ok: true,
        selectedText: selection?.toString() || "",
      };
    });

    if (!selectionResult.ok) {
      throw new Error(`Failed to create assistant selection: ${selectionResult.reason}`);
    }

    const commentButton = page.locator('button:has-text("评论")').last();
    await commentButton.waitFor({ state: "visible", timeout: previewTimeoutMs });
    await commentButton.click();

    const textarea = page.locator('textarea[placeholder*="写一句评论"]').last();
    await textarea.waitFor({ state: "visible", timeout: previewTimeoutMs });
    const commentText = "这段说明需要按条回复";
    await textarea.fill(commentText);
    await page.locator('button:has-text("加入评论")').last().click();

    await page.waitForFunction((expectedComment) => {
      const refs = window.__TECH_CC_HUB_QA__.getMessageReferences();
      return refs.some((reference) => reference.kind === "comment" && reference.comment === expectedComment);
    }, commentText, { timeout: previewTimeoutMs });

    const unexpectedErrors = logs.filter((line) => {
      if (!line.includes("[pageerror]") && !line.includes("[console:error]")) return false;
      return !expectedErrorPatterns.some((pattern) => pattern.test(line));
    });
    if (unexpectedErrors.length > 0) {
      throw new Error(`Unexpected browser errors:\n${unexpectedErrors.join("\n")}`);
    }

    console.log("CHAT_SELECTION_COMMENT_SMOKE_OK");
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
    stopProcess(preview);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});