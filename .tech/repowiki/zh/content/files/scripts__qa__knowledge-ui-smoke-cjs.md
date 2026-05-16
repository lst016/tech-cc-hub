# scripts/qa/knowledge-ui-smoke.cjs

> 模块：`scripts` · 语言：`javascript` · 行数：100

## 文件职责

Playwright测试knowledge UI的Repo Wiki标签页、workspace切换和模块按钮渲染

## 关键符号

- `clickIfVisible@0 - 安全点击元素，仅当可见时执行点击`
- `main@0 - 主测试流程：启动Chrome、导航到知识库、验证生成的概览内容`

## 依赖输入

- `node:path`
- `@playwright/test`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
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
  for (const forbidden of ['后&#8203;续接入真实', '未&#8203;生成正文', '当&#8203;前没有真实 Repo Wiki 正文', '生&#8203;成后会出现 Repo Wiki 目录', '模&#8203;型未返回结构化说明', '```markdown']) {
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

```
