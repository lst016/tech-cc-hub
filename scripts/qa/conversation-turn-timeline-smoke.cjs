const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..", "..");
const port = Number(process.env.CONVERSATION_TURN_TIMELINE_QA_PORT || 4322);
const baseUrl = `http://127.0.0.1:${port}`;
const qaUrl = `${baseUrl}/?__tech_cc_hub_browser_preview=1&qaConversationTurnTimeline=1`;
const artifactPath = path.join(repoRoot, ".omx", "artifacts", "conversation-turn-timeline.png");
const defaultArtifactPath = path.join(repoRoot, ".omx", "artifacts", "conversation-turn-timeline-default.png");

function startDevServer() {
  const args = ["run", "dev:react", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"];
  return process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
        cwd: repoRoot,
        env: process.env,
        stdio: "pipe",
        windowsHide: true,
      })
    : spawn("npm", args, { cwd: repoRoot, env: process.env, stdio: "pipe", detached: true });
}

async function waitForHttp(server) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited with ${server.exitCode}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Keep polling while Vite starts.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function launchBrowser() {
  for (const options of [{}, { channel: "chrome" }, { channel: "msedge" }]) {
    try {
      return await chromium.launch({ headless: true, ...options });
    } catch {
      // Try the next locally available Chromium browser.
    }
  }
  throw new Error("No Chromium browser is available for timeline QA.");
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } catch {
      // The process may already have exited.
    }
    return;
  }
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // The process may already have exited.
  }
}

async function main() {
  let server;
  let browser;
  const browserErrors = [];
  try {
    server = startDevServer();
    await waitForHttp(server);
    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });

    await page.goto(qaUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const timeline = page.locator("[data-conversation-turn-timeline]");
    await timeline.waitFor({ state: "visible", timeout: 20_000 });

    const marks = timeline.locator("button[data-conversation-turn-index]");
    assert.equal(await marks.count(), 5, "timeline should include user turns outside the virtual render window");
    assert.equal(
      await timeline.locator('button[data-conversation-turn-index][aria-current="step"]').count(),
      1,
      "timeline should expose one current turn",
    );

    const geometry = await page.evaluate(() => {
      const sidebar = document.querySelector("aside");
      const timelineElement = document.querySelector("[data-conversation-turn-timeline]");
      const content = document.querySelector(".chat-stream-content");
      if (!timelineElement || !content) return null;
      const timelineRect = timelineElement.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const sidebarRect = sidebar?.getBoundingClientRect();
      return {
        sidebarRight: sidebarRect?.right ?? 0,
        timelineLeft: timelineRect.left,
        timelineRight: timelineRect.right,
        contentLeft: contentRect.left,
      };
    });
    assert.ok(geometry, "timeline and chat content should be measurable");
    assert.ok(Math.abs(geometry.timelineLeft - geometry.sidebarRight - 16) <= 1, "timeline must stay anchored 16px after the workspace sidebar");
    assert.ok(geometry.timelineRight <= geometry.contentLeft + 1, "timeline must sit to the left of chat content");

    await page.setViewportSize({ width: 1180, height: 1000 });
    await timeline.waitFor({ state: "hidden", timeout: 10_000 });
    await page.setViewportSize({ width: 1800, height: 1000 });
    await timeline.waitFor({ state: "visible", timeout: 10_000 });

    const compactWidths = await marks.locator("span").evaluateAll((lines) => (
      lines.map((line) => line.getBoundingClientRect().width)
    ));
    assert.ok(compactWidths.every((width) => width <= 11), `default marks must stay compact: ${compactWidths.join(", ")}`);

    const performanceSession = await page.context().newCDPSession(page);
    await performanceSession.send("Performance.enable");
    const readPerformanceMetrics = async () => Object.fromEntries(
      (await performanceSession.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]),
    );
    const performanceBefore = await readPerformanceMetrics();
    await page.evaluate(() => {
      window.__timelineRafSamples = [];
      window.__timelineRafRunning = true;
      let previousFrame = 0;
      const sampleFrame = (timestamp) => {
        if (previousFrame) window.__timelineRafSamples.push(timestamp - previousFrame);
        previousFrame = timestamp;
        if (window.__timelineRafRunning) requestAnimationFrame(sampleFrame);
      };
      requestAnimationFrame(sampleFrame);
    });
    await page.evaluate(async () => {
      const timelineMarks = Array.from(document.querySelectorAll("button[data-conversation-turn-index]"));
      const sampledMarks = timelineMarks.slice(0, Math.min(4, timelineMarks.length));
      let previousMark = null;
      for (let index = 0; index < 24; index += 1) {
        const nextMark = sampledMarks[index % sampledMarks.length];
        previousMark?.dispatchEvent(new PointerEvent("pointerout", {
          bubbles: true,
          relatedTarget: nextMark,
        }));
        nextMark.dispatchEvent(new PointerEvent("pointerover", {
          bubbles: true,
          relatedTarget: previousMark,
        }));
        previousMark = nextMark;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      await new Promise((resolve) => setTimeout(resolve, 240));
    });
    const performanceAfter = await readPerformanceMetrics();
    const rafSamples = await page.evaluate(() => {
      window.__timelineRafRunning = false;
      return window.__timelineRafSamples;
    });
    const sortedRafSamples = [...rafSamples].sort((left, right) => left - right);
    const animationDiagnostics = {
      layoutCount: performanceAfter.LayoutCount - performanceBefore.LayoutCount,
      layoutMs: (performanceAfter.LayoutDuration - performanceBefore.LayoutDuration) * 1_000,
      recalcStyleMs: (performanceAfter.RecalcStyleDuration - performanceBefore.RecalcStyleDuration) * 1_000,
      taskMs: (performanceAfter.TaskDuration - performanceBefore.TaskDuration) * 1_000,
      p95FrameMs: sortedRafSamples[Math.floor(sortedRafSamples.length * 0.95)] || 0,
      maxFrameMs: sortedRafSamples.at(-1) || 0,
    };
    console.log(`TIMELINE_ANIMATION_DIAGNOSTICS ${JSON.stringify(animationDiagnostics)}`);
    assert.ok(
      animationDiagnostics.layoutCount <= 26,
      `timeline hover must avoid layout-bound animation: ${JSON.stringify(animationDiagnostics)}`,
    );
    const persistentPreview = page.locator("[data-conversation-turn-preview]");
    await persistentPreview.waitFor({ state: "visible", timeout: 10_000 });
    await persistentPreview.evaluate((element) => element.setAttribute("data-qa-preview-instance", "persistent"));

    const hoverMark = timeline.locator('button[data-conversation-turn-index="3"]');
    await hoverMark.hover();
    const preview = persistentPreview;
    await preview.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await preview.getAttribute("data-qa-preview-instance"), "persistent", "preview shell must stay mounted between turns");
    const currentPreviewContent = preview.locator("[data-conversation-turn-preview-content]");
    await currentPreviewContent.getByText("side-conversation.png", { exact: true }).waitFor({ state: "visible" });
    await currentPreviewContent.getByText("App.tsx", { exact: true }).waitFor({ state: "visible" });
    await currentPreviewContent.getByText("第三轮：点击灰色刻度跳转到历史提问。", { exact: true }).waitFor({ state: "visible" });
    await currentPreviewContent.getByText(/这一轮用于验证聊天内容列表左侧的会话时间轴/, { exact: false }).waitFor({ state: "visible" });
    await page.waitForTimeout(260);

    const expandedWidths = await marks.locator("span").evaluateAll((lines) => (
      lines.map((line) => line.getBoundingClientRect().width)
    ));
    assert.ok(Math.max(...expandedWidths) >= 39, `hovered timeline should expand its current mark: ${expandedWidths.join(", ")}`);
    const hoverBackground = await hoverMark.locator("span").evaluate((line) => getComputedStyle(line).backgroundColor);
    assert.equal(hoverBackground, "rgb(22, 24, 29)", "hovered turn should own the black highlight");
    const scrollCurrentMark = timeline.locator('button[aria-current="step"]');
    if (await scrollCurrentMark.getAttribute("data-conversation-turn-index") !== "3") {
      const scrollCurrentBackground = await scrollCurrentMark.locator("span").evaluate((line) => getComputedStyle(line).backgroundColor);
      assert.notEqual(scrollCurrentBackground, hoverBackground, "scroll-current turn should return to gray while another turn is hovered");
    }

    const hoverMarkBox = await hoverMark.boundingBox();
    const alignedPreviewBox = await preview.boundingBox();
    assert.ok(hoverMarkBox && alignedPreviewBox, "hovered mark and preview should be measurable");
    const markCenterY = hoverMarkBox.y + hoverMarkBox.height / 2;
    const previewCenterY = alignedPreviewBox.y + alignedPreviewBox.height / 2;
    assert.ok(Math.abs(markCenterY - previewCenterY) <= 2, "preview card should stay vertically anchored to the hovered turn");
    assert.equal(await hoverMark.getAttribute("aria-describedby"), "conversation-turn-preview");

    const timelineBox = await timeline.boundingBox();
    const previewBox = await preview.boundingBox();
    assert.ok(timelineBox && previewBox, "hovered timeline and preview should have bounding boxes");
    const clipX = Math.max(0, timelineBox.x - 16);
    const clipY = Math.max(0, previewBox.y - 24);
    const clipRight = Math.min(1800, previewBox.x + previewBox.width + 24);
    const clipBottom = Math.min(1000, previewBox.y + previewBox.height + 24);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    await page.screenshot({
      path: artifactPath,
      animations: "disabled",
      caret: "hide",
      clip: {
        x: clipX,
        y: clipY,
        width: clipRight - clipX,
        height: clipBottom - clipY,
      },
    });
    assert.ok(fs.statSync(artifactPath).size > 0, "timeline hover screenshot should be non-empty");

    await page.mouse.move(1790, 20);
    await preview.waitFor({ state: "detached", timeout: 10_000 });

    await hoverMark.focus();
    await preview.waitFor({ state: "visible", timeout: 10_000 });
    await hoverMark.press("Escape");
    await preview.waitFor({ state: "detached", timeout: 10_000 });

    const firstMark = timeline.locator('button[data-conversation-turn-index="0"]');
    await firstMark.click();
    await page.waitForFunction(() => (
      document.querySelector('[data-conversation-turn-index="0"]')?.getAttribute("aria-current") === "step"
    ));
    await page.locator("#chat-message-0").waitFor({ state: "visible", timeout: 10_000 });
    await firstMark.blur();
    await page.mouse.move(1790, 20);
    await preview.waitFor({ state: "detached", timeout: 10_000 });

    await page.screenshot({
      path: defaultArtifactPath,
      fullPage: false,
      animations: "disabled",
      caret: "hide",
    });
    assert.ok(fs.statSync(defaultArtifactPath).size > 0, "timeline default screenshot should be non-empty");
    assert.deepEqual(browserErrors, [], `unexpected browser errors:\n${browserErrors.join("\n")}`);
    console.log("CONVERSATION_TURN_TIMELINE_QA_OK");
  } finally {
    await browser?.close().catch(() => {});
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
