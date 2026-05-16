const path = require('node:path');
const { chromium } = require('@playwright/test');

const DEFAULT_URL = process.env.KNOWLEDGE_UI_QA_URL || 'http://localhost:4173/';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCREENSHOT_PATH = process.env.KNOWLEDGE_UI_QA_SCREENSHOT
  || path.join('/tmp', 'tech-cc-hub-knowledge-ui-smoke.png');

async function clickIfVisible(locator) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const logs = [];
  page.on('console', (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => logs.push(`[pageerror] ${error.stack || error.message}`));

  await page.goto(DEFAULT_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1800);

  await clickIfVisible(page.getByRole('button', { name: /知识库|知识/ }).first());
  await page.waitForTimeout(800);

  const repoWikiTab = page.getByRole('button', { name: /Repo Wiki/ }).first();
  await repoWikiTab.waitFor({ state: 'visible', timeout: 10000 });
  await repoWikiTab.click();

  const workspaceButton = page.getByRole('button', { name: /打开工作区 tech-cc-hub/ }).first();
  await workspaceButton.waitFor({ state: 'visible', timeout: 10000 });
  await workspaceButton.click();
  await page.waitForTimeout(1000);

  let bodyText = await page.locator('body').innerText({ timeout: 10000 });
  for (const expected of ['生成完成', '重新生成']) {
    if (!bodyText.includes(expected)) {
      throw new Error(`Knowledge workspace panel missing: ${expected}`);
    }
  }

  const generatedDoc = page.getByRole('button', { name: /打开文档 tech-cc-hub 项目概览/ }).first();
  await generatedDoc.waitFor({ state: 'visible', timeout: 10000 });
  await generatedDoc.click();
  await page.waitForTimeout(800);

  bodyText = await page.locator('body').innerText({ timeout: 10000 });
  for (const expected of ['项目概览', 'Agent 快速定位', '关键工作流', '模块']) {
    if (!bodyText.includes(expected)) {
      throw new Error(`Knowledge UI missing generated content: ${expected}`);
    }
  }
  const moduleButtonCount = await page.locator('button').filter({ hasText: /knowledge-engine|mcp-tools|electron-runtime|ui-shell|task-engine/ }).count();
  if (moduleButtonCount < 1) {
    throw new Error('Knowledge UI did not render any RepoWiki module page buttons');
  }
  for (const expectedButton of [/Agent 作业手册/, /接口与存储面/, /关键运行链路/]) {
    if (await page.locator('button').filter({ hasText: expectedButton }).count() < 1) {
      throw new Error(`Knowledge UI missing Agent-useful page button: ${expectedButton}`);
    }
  }
  for (const forbidden of ['后续接入真实', '未生成正文', '当前没有真实 Repo Wiki 正文', '生成后会出现 Repo Wiki 目录', '模型未返回结构化说明', '```markdown']) {
    if (bodyText.includes(forbidden)) {
      throw new Error(`Knowledge UI still contains placeholder/fence text: ${forbidden}`);
    }
  }
  if (!bodyText.includes('已完成')) {
    throw new Error('Knowledge UI does not show completed generation status');
  }
  if (await page.getByRole('button', { name: /关闭 tech-cc-hub 项目概览/ }).count() < 1) {
    throw new Error('Knowledge UI did not open the document in a closable tab');
  }

  const sectionToggle = page.getByRole('button', { name: /折叠(模块：|项目概览|架构设计|业务模块|前端架构设计|后端架构设计)/ }).first();
  await sectionToggle.waitFor({ state: 'visible', timeout: 10000 });
  const sectionTitle = (await sectionToggle.innerText()).trim();
  const sectionGroup = page.locator('[data-knowledge-section]').filter({ hasText: sectionTitle }).first();
  const childCountBeforeCollapse = await sectionGroup.getByRole('button', { name: /打开文档 / }).count();
  if (childCountBeforeCollapse < 1) {
    throw new Error(`Knowledge section has no document children before collapse: ${sectionTitle}`);
  }
  await sectionToggle.click();
  await page.waitForTimeout(300);
  const collapsedToggle = page.getByRole('button', { name: new RegExp(`展开${escapeRegExp(sectionTitle)}`) }).first();
  await collapsedToggle.waitFor({ state: 'visible', timeout: 10000 });
  if ((await collapsedToggle.getAttribute('aria-expanded')) !== 'false') {
    throw new Error(`Knowledge section did not report collapsed state: ${sectionTitle}`);
  }
  const childCountAfterCollapse = await sectionGroup.getByRole('button', { name: /打开文档 / }).count();
  if (childCountAfterCollapse !== 0) {
    throw new Error(`Knowledge section children are still visible after collapse: ${sectionTitle}`);
  }
  await collapsedToggle.click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: new RegExp(`折叠${escapeRegExp(sectionTitle)}`) }).first().waitFor({ state: 'visible', timeout: 10000 });

  await workspaceButton.click();
  await page.waitForTimeout(500);
  if (await generatedDoc.isVisible().catch(() => false)) {
    throw new Error('Knowledge workspace tree did not collapse after clicking the workspace row again');
  }

  const ignoredLogPatterns = [
    'violates the following Content Security Policy directive',
    'Fetch API cannot load http://localhost:',
    '浏览器预览态不支持 IPC invoke',
    'Failed to invoke session list',
  ];
  const fatalLogs = logs.filter((line) => {
    if (ignoredLogPatterns.some((pattern) => line.includes(pattern))) return false;
    return (
      line.includes('[pageerror]')
      || line.includes('[console:error]')
      || line.includes('Cannot read')
      || line.includes('Unhandled')
    );
  });
  if (fatalLogs.length > 0) {
    throw new Error(`Knowledge UI QA saw fatal browser logs:\n${fatalLogs.join('\n')}`);
  }

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ ok: true, screenshot: SCREENSHOT_PATH }, null, 2));
  console.log('KNOWLEDGE_UI_QA_OK');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
