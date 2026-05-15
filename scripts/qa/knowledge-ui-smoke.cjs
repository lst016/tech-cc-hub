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

  const workspaceButton = page.getByRole('button', { name: /tech-cc-hub/ }).first();
  await workspaceButton.waitFor({ state: 'visible', timeout: 10000 });
  await workspaceButton.click();
  await page.waitForTimeout(1000);

  const generatedDoc = page.getByRole('button', { name: /tech-cc-hub 项目概览/ }).first();
  await generatedDoc.waitFor({ state: 'visible', timeout: 10000 });
  await generatedDoc.click();
  await page.waitForTimeout(800);

  const bodyText = await page.locator('body').innerText({ timeout: 10000 });
  for (const expected of ['项目概览', '技术栈', '模块']) {
    if (!bodyText.includes(expected)) {
      throw new Error(`Knowledge UI missing generated content: ${expected}`);
    }
  }
  const moduleButtonCount = await page.locator('button').filter({ hasText: /src|ui|electron|components|root|scripts/ }).count();
  if (moduleButtonCount < 1) {
    throw new Error('Knowledge UI did not render any RepoWiki module page buttons');
  }
  for (const forbidden of ['后续接入真实', '未生成正文', '当前没有真实 Repo Wiki 正文', '生成后会出现 Repo Wiki 目录', '```markdown']) {
    if (bodyText.includes(forbidden)) {
      throw new Error(`Knowledge UI still contains placeholder/fence text: ${forbidden}`);
    }
  }
  if (!bodyText.includes('已完成')) {
    throw new Error('Knowledge UI does not show completed generation status');
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
