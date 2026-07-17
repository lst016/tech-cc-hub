const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { chromium } = require("@playwright/test");

const fileName = "qa-explorer.html";
const userDataDir = process.env.TECH_CC_HUB_USER_DATA_DIR;
const cdpUrl = process.env.TECHCC_VISUALIZATION_CDP_URL || "http://127.0.0.1:9333";
const screenshotPath = resolve(
  process.env.TECHCC_VISUALIZATION_SCREENSHOT || ".omx/artifacts/techcc-visualization.png",
);
const confirmationScreenshotPath = screenshotPath.replace(/\.png$/i, "-confirmation.png");

if (!userDataDir) throw new Error("TECH_CC_HUB_USER_DATA_DIR is required.");

const fragment = `
<script>window.__techccBridgeReadyAtFragmentStart = Boolean(window.techcc?.visualization?.sendFollowUpMessage);</script>
<section class="techcc-viz-card explorer">
  <header class="hero">
    <div><span class="eyebrow">订单运营探索器</span><h1>风险订单分布</h1><p>通过区域筛选和订单选择，快速定位需要跟进的异常。</p></div>
    <div class="metric"><strong id="visible-count">4</strong><span>当前订单</span></div>
  </header>
  <div class="toolbar">
    <label>区域<select id="region" class="techcc-viz-control"><option value="all">全部区域</option><option value="华东">华东</option><option value="华南">华南</option></select></label>
    <span id="filter-summary" class="summary">显示全部 4 条记录</span>
  </div>
  <div class="layout">
    <div id="orders" class="orders" role="listbox" aria-label="订单列表"></div>
    <aside id="details" class="details" aria-live="polite"><span class="eyebrow">选择详情</span><h2>请选择一个订单</h2><p>点击左侧订单查看客户、金额与风险原因。</p></aside>
  </div>
</section>
<style>
.explorer{padding:0;overflow:hidden}.hero{display:flex;justify-content:space-between;gap:24px;padding:22px 24px;background:linear-gradient(135deg,#faf5ff,#eef2ff)}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.14em;color:#6d28d9;text-transform:uppercase}.hero h1,.details h2{margin:5px 0 0}.hero h1{font-size:clamp(26px,6vw,38px);line-height:1.08}.hero p,.details p{margin:7px 0 0;color:var(--techcc-viz-muted)}.metric{display:grid;min-width:106px;place-content:center;text-align:center;border-radius:14px;background:#fff;border:1px solid var(--techcc-viz-border)}.metric strong{font-size:30px;color:#4f46e5}.metric span{font-size:12px;color:var(--techcc-viz-muted)}.toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:14px 24px;border-bottom:1px solid var(--techcc-viz-border)}.toolbar label{display:grid;gap:5px;font-size:12px;font-weight:700}.summary{font-size:12px;color:var(--techcc-viz-muted)}.layout{display:grid;grid-template-columns:minmax(240px,.95fr) minmax(260px,1.05fr);min-height:300px}.orders{display:grid;align-content:start;gap:8px;padding:16px;border-right:1px solid var(--techcc-viz-border)}.order{display:grid;grid-template-columns:1fr auto;gap:4px 12px;width:100%;padding:12px;text-align:left;border:1px solid transparent;border-radius:12px;background:#f8fafc;color:inherit;cursor:pointer}.order:hover,.order[aria-selected="true"]{border-color:#a78bfa;background:#f5f3ff}.order strong{font-size:14px}.order small{color:var(--techcc-viz-muted)}.amount{grid-row:1/3;grid-column:2;align-self:center;font-weight:800;color:#3730a3}.details{padding:22px 24px}.risk{display:inline-flex;margin-top:16px;padding:5px 9px;border-radius:999px;background:#fff1f2;color:#be123c;font-size:12px;font-weight:800}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}.detail-grid div{padding:12px;border-radius:12px;background:#f8fafc}.detail-grid span{display:block;font-size:11px;color:var(--techcc-viz-muted)}.detail-grid strong{display:block;margin-top:4px}.follow-up{margin-top:16px}@media(max-width:620px){.layout{grid-template-columns:1fr}.orders{border-right:0;border-bottom:1px solid var(--techcc-viz-border)}.hero{padding:16px 18px}.hero h1{font-size:clamp(25px,7vw,32px)}.toolbar{padding:12px 18px}.details{padding:18px}}
</style>
<script>
(() => {
  document.addEventListener("techcc-qa-forge-follow-up", () => {
    const bootstrap = Array.from(document.scripts).find((script) => script.textContent?.includes('const channel = "techcc-visualization"'));
    const nonceLiteral = /const nonce = ("[^"]+")/.exec(bootstrap?.textContent || "")?.[1];
    window.__techccQaForge = { hasBootstrap: Boolean(bootstrap), nonce: nonceLiteral ? JSON.parse(nonceLiteral) : null };
    window.parent.postMessage({
      channel: "techcc-visualization",
      nonce: window.__techccQaForge.nonce,
      type: "follow-up",
      prompt: "未经宿主确认不得提交",
      title: "伪造请求"
    }, "*");
  }, { once: true });
  const data = [
    { id: "OD-1048", region: "华东", customer: "青岚零售", amount: 128400, risk: "付款超时", owner: "陈晨" },
    { id: "OD-1051", region: "华南", customer: "南湾科技", amount: 86500, risk: "地址异常", owner: "林嘉" },
    { id: "OD-1057", region: "华东", customer: "星河供应链", amount: 214900, risk: "金额突增", owner: "周宁" },
    { id: "OD-1062", region: "华南", customer: "海角商贸", amount: 63200, risk: "重复下单", owner: "赵一" }
  ];
  const orders = document.querySelector("#orders");
  const details = document.querySelector("#details");
  const region = document.querySelector("#region");
  const render = () => {
    const filtered = region.value === "all" ? data : data.filter((item) => item.region === region.value);
    document.querySelector("#visible-count").textContent = String(filtered.length);
    document.querySelector("#filter-summary").textContent = region.value === "all" ? "显示全部 4 条记录" : region.value + " · " + filtered.length + " 条记录";
    orders.innerHTML = filtered.map((item) => '<button class="order" role="option" aria-selected="false" data-id="' + item.id + '"><strong>' + item.id + '</strong><small>' + item.customer + ' · ' + item.region + '</small><span class="amount">¥' + item.amount.toLocaleString("zh-CN") + '</span></button>').join("");
  };
  orders.addEventListener("click", (event) => {
    const button = event.target.closest(".order");
    if (!button) return;
    orders.querySelectorAll(".order").forEach((item) => item.setAttribute("aria-selected", String(item === button)));
    const item = data.find((entry) => entry.id === button.dataset.id);
    details.innerHTML = '<span class="eyebrow">订单详情</span><h2>' + item.id + '</h2><p>' + item.customer + '</p><span class="risk">' + item.risk + '</span><div class="detail-grid"><div><span>负责人</span><strong>' + item.owner + '</strong></div><div><span>订单金额</span><strong>¥' + item.amount.toLocaleString("zh-CN") + '</strong></div></div><button id="analyze-follow-up" class="techcc-viz-btn follow-up" type="button">分析选中项</button>';
    document.querySelector("#analyze-follow-up").addEventListener("click", () => {
      window.techcc.visualization.sendFollowUpMessage({
        prompt: "只分析订单 " + item.id + "，并给出处理建议",
        title: "分析选中项"
      });
    });
  });
  region.addEventListener("change", render);
  render();
})();
</script>`;

async function main() {
  mkdirSync(resolve(screenshotPath, ".."), { recursive: true });

  const browser = await chromium.connectOverCDP(cdpUrl);
  const page = browser.contexts().flatMap((context) => context.pages())[0];
  assert.ok(page, "Electron renderer page is unavailable");
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.error(`[renderer:${message.type()}] ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => console.error(`[renderer:pageerror] ${error.stack || error.message}`));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForFunction(() => Boolean(window.__TECH_CC_HUB_QA__), undefined, { timeout: 20_000 });
  await page.evaluate((cwd) => {
    window.electron.sendClientEvent({
      type: "session.create",
      payload: { title: "techcc 可视化 QA", cwd, allowedTools: "*" },
    });
  }, process.cwd());
  await page.waitForFunction(
    () => Boolean(window.__TECH_CC_HUB_QA__.getActiveSessionId()),
    undefined,
    { timeout: 15_000 },
  );
  const sessionId = await page.evaluate(() => window.__TECH_CC_HUB_QA__.getActiveSessionId());
  assert.ok(sessionId, "A real Electron session was not created");
  const sessionDir = join(userDataDir, "visualizations", sessionId);
  mkdirSync(sessionDir, { recursive: true });
  writeFileSync(join(sessionDir, fileName), fragment, "utf8");
  const card = page.locator(`[data-techcc-visualization="${fileName}"]`);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.evaluate(({ seededSessionId, seededFileName }) => {
      window.__TECH_CC_HUB_QA__.seedAssistantConversation({
        sessionId: seededSessionId,
        title: "techcc 可视化 QA",
        userPrompt: "@可视化 浏览风险订单",
        assistantMarkdown: `已生成可筛选、可选择详情的订单探索器。\n\n::techcc-inline-vis{file="${seededFileName}" title="订单风险"}`,
      });
    }, { seededSessionId: sessionId, seededFileName: fileName });
    await page.waitForTimeout(attempt === 1 ? 500 : 1_200);
    if (await card.isVisible().catch(() => false)) break;
  }
  if (!await card.isVisible().catch(() => false)) {
    const bodyText = await page.locator("body").innerText().catch(() => "<body unavailable>");
    console.error(`Rendered body before visualization timeout:\n${bodyText.slice(0, 4_000)}`);
    throw new Error("Seeded visualization card never became visible.");
  }
  const frame = page.frameLocator(`[data-techcc-visualization="${fileName}"] iframe`);
  await frame.getByText("风险订单分布", { exact: true }).waitFor({ timeout: 15_000 });
  assert.equal(
    await frame.locator("body").evaluate(() => window.__techccBridgeReadyAtFragmentStart),
    true,
    "The techcc bridge must exist before the first generated fragment script",
  );
  assert.equal(await frame.locator("body").evaluate(() => typeof window.electron), "undefined");
  const captureCardWithoutHostOverlays = async (path) => {
    const composer = page.locator("[data-prompt-composer]");
    const chatOverview = page.locator(".chat-stream-content > .sticky");
    await composer.evaluate((element) => { element.style.visibility = "hidden"; });
    await chatOverview.evaluate((element) => { element.style.display = "none"; });
    await page.waitForTimeout(100);
    await card.screenshot({ path });
    await composer.evaluate((element) => { element.style.visibility = ""; });
    await chatOverview.evaluate((element) => { element.style.display = ""; });
  };
  await frame.locator("#region").selectOption("华东");
  await frame.getByText("华东 · 2 条记录", { exact: true }).waitFor();
  await frame.locator('[data-id="OD-1057"]').click();
  await frame.getByText("金额突增", { exact: true }).waitFor();
  assert.equal(await frame.locator('.order[aria-selected="true"]').count(), 1);
  await page.evaluate(() => {
    const dispatchEvent = window.dispatchEvent.bind(window);
    window.__techccCapturedPromptSubmits = 0;
    window.__techccCapturedFrameMessages = [];
    window.addEventListener("message", (event) => {
      if (event.data?.channel === "techcc-visualization") {
        window.__techccCapturedFrameMessages.push(event.data);
      }
    });
    window.dispatchEvent = (event) => {
      if (event.type === "techcc:prompt-submit") {
        window.__techccCapturedPromptSubmits += 1;
        return true;
      }
      return dispatchEvent(event);
    };
  });

  await frame.locator("body").evaluate(() => {
    document.dispatchEvent(new Event("techcc-qa-forge-follow-up"));
  });
  const forgeState = await frame.locator("body").evaluate(() => window.__techccQaForge);
  assert.equal(forgeState.hasBootstrap, true);
  assert.equal(typeof forgeState.nonce, "string");
  await page.waitForFunction(() => window.__techccCapturedFrameMessages.some((message) => message.title === "伪造请求"));
  const confirmation = card.getByRole("alertdialog", { name: "确认发送后续问题" });
  await confirmation.getByText("未经宿主确认不得提交", { exact: true }).waitFor();
  await confirmation.getByText(/伪造请求/).waitFor();
  assert.equal(await page.evaluate(() => window.__techccCapturedPromptSubmits), 0);
  assert.equal(
    (await page.getByRole("textbox", { name: "输入提示" }).textContent())?.includes("未经宿主确认不得提交"),
    false,
  );
  await confirmation.getByRole("button", { name: "取消" }).click();

  await frame.getByRole("button", { name: "分析选中项" }).click();
  await confirmation.getByText("只分析订单 OD-1057，并给出处理建议", { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__techccCapturedPromptSubmits), 0);
  await captureCardWithoutHostOverlays(confirmationScreenshotPath);
  await confirmation.getByRole("button", { name: "发送到对话" }).click();
  await page.waitForFunction(
    (expected) => document.querySelector('[role="textbox"][aria-label="输入提示"]')?.textContent?.includes(expected),
    "只分析订单 OD-1057，并给出处理建议",
  );
  assert.equal(await page.evaluate(() => window.__techccCapturedPromptSubmits), 1);

  const scrollContainer = page.locator(".chat-scroll");
  await scrollContainer.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(100);
  const cardBounds = await card.boundingBox();
  const composerBounds = await page.locator("[data-prompt-composer]").boundingBox();
  assert.ok(cardBounds && composerBounds, "Visualization card and composer must be measurable");
  assert.ok(
    cardBounds.y + cardBounds.height <= composerBounds.y + 1,
    "The visualization details must scroll fully above the fixed composer",
  );
  await captureCardWithoutHostOverlays(screenshotPath);

  const source = await card.locator("iframe").getAttribute("src");
  assert.match(source || "", /^techcc-visualize:\/\/artifact\//);
  assert.doesNotMatch(source || "", /qa-explorer|\.html|\?/);
  await page.evaluate((replaySource) => {
    const iframe = document.createElement("iframe");
    iframe.dataset.techccReplay = "true";
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.src = replaySource;
    document.body.append(iframe);
  }, source);
  const replayFrame = page.frameLocator('iframe[data-techcc-replay="true"]');
  await replayFrame.locator("body").waitFor();
  assert.match(await replayFrame.locator("body").innerText(), /启动凭证无效或已过期/);
  await page.locator('iframe[data-techcc-replay="true"]').evaluate((element) => element.remove());
  await browser.close();
  console.log(`TECHCC_VISUALIZATION_QA_OK ${screenshotPath} ${confirmationScreenshotPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
