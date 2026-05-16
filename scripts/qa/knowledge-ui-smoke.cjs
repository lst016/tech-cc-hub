const path = require('node:path');
const { existsSync, readFileSync } = require('node:fs');
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

function readExpectedTitle() {
  const metadataPath = path.join(process.cwd(), '.tech/repowiki/zh/meta/repowiki-metadata.json');
  if (!existsSync(metadataPath)) return '项目概述';
  try {
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
    const catalogs = Array.isArray(metadata.wiki_catalogs) ? metadata.wiki_catalogs : [];
    const first = catalogs.find((catalog) => typeof catalog?.title === 'string' || typeof catalog?.name === 'string');
    return first?.title || first?.name || '项目概述';
  } catch {
    return '项目概述';
  }
}

async function main() {
  const expectedTitle = readExpectedTitle();
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
  if (!bodyText.includes('生成完成')) {
    throw new Error('Knowledge workspace panel missing: 生成完成');
  }
  const hasRegenerateButton = await page.getByRole('button', { name: /^重新生成$/ }).isVisible().catch(() => false);
  const hasUpdateButton = await page.getByRole('button', { name: /^更新$/ }).isVisible().catch(() => false);
  if (!hasRegenerateButton && !hasUpdateButton) {
    throw new Error('Knowledge workspace panel missing regenerate/update action');
  }
  if (bodyText.includes('需更新')) {
    throw new Error('Knowledge workspace should render update as a button instead of static 需更新 text');
  }

  const generatedDoc = page.getByRole('button', { name: new RegExp(`打开文档 .*${escapeRegExp(expectedTitle)}`) }).first();
  await generatedDoc.waitFor({ state: 'visible', timeout: 10000 });
  await generatedDoc.click();
  await page.waitForTimeout(800);

  bodyText = await page.locator('body').innerText({ timeout: 10000 });
  for (const expected of [expectedTitle, '本文引用的文件', '目录']) {
    if (!bodyText.includes(expected)) {
      throw new Error(`Knowledge UI missing generated content: ${expected}`);
    }
  }
  await page.locator('.mermaid-diagram svg').first().waitFor({ state: 'visible', timeout: 15000 });
  const rawMermaidCodeBlocks = await page.locator('pre').filter({ hasText: /flowchart|sequenceDiagram|graph TD|graph LR/ }).count();
  if (rawMermaidCodeBlocks > 0) {
    throw new Error(`Knowledge UI still renders Mermaid diagrams as raw code blocks: ${rawMermaidCodeBlocks}`);
  }
  const topicButtonCount = await page.locator('button').filter({ hasText: /知识库|Repo Wiki|文档管理|后端引擎|系统架构|Electron|前端|质量|故障/ }).count();
  if (topicButtonCount < 3) {
    throw new Error('Knowledge UI did not render enough Repo Wiki topic page buttons');
  }
  const nestedSectionCount = await page.locator('[data-knowledge-section*="/"]').count();
  if (nestedSectionCount < 1) {
    throw new Error('Knowledge UI did not render nested Repo Wiki sections');
  }
  for (const expectedButton of [/知识库|Repo Wiki|文档管理|后端引擎/, /系统架构|架构设计/]) {
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
  if (await page.getByRole('button', { name: new RegExp(`关闭 .*${escapeRegExp(expectedTitle)}`) }).count() < 1) {
    throw new Error('Knowledge UI did not open the document in a closable tab');
  }
  if (await page.getByRole('button', { name: /^更多$/ }).count() > 0) {
    throw new Error('Knowledge UI still renders an inert top-right More tab action');
  }
  const nestedInteractiveCount = await page.evaluate(() => document.querySelectorAll('button button, button [role="button"]').length);
  if (nestedInteractiveCount > 0) {
    throw new Error(`Knowledge UI still nests interactive tab controls inside buttons: ${nestedInteractiveCount}`);
  }
  if (await page.getByRole('button', { name: /^重新生成$/ }).isVisible().catch(() => false)) {
    throw new Error('Knowledge document preview should not render the workspace regenerate button');
  }

  const taskExecutorDoc = page.getByRole('button', { name: /打开文档 任务执行引擎/ }).first();
  await taskExecutorDoc.waitFor({ state: 'visible', timeout: 10000 });
  await taskExecutorDoc.click();
  await page.waitForTimeout(800);
  const inlineSourceRef = page.getByRole('button', {
    name: /打开源码文件 src\/electron\/libs\/task\/executor\.ts#L83-L84/,
  }).first();
  await inlineSourceRef.waitFor({ state: 'visible', timeout: 10000 });
  await inlineSourceRef.click();
  await page.waitForTimeout(1200);
  bodyText = await page.locator('body').innerText({ timeout: 10000 });
  if (!bodyText.includes('src/electron/libs/task/executor.ts#L83-L84')) {
    throw new Error('Knowledge inline source ref did not open executor.ts in the knowledge tab');
  }
  for (const lineNumber of [83, 84]) {
    const highlightedLine = page.locator(`[data-source-line="${lineNumber}"][data-source-active="true"]`);
    await highlightedLine.waitFor({ state: 'visible', timeout: 10000 });
  }

  const sectionToggle = page.getByRole('button', { name: /折叠(Repo Wiki|项目概述|系统架构|架构设计|业务模块|前端架构设计|后端架构设计)/ }).first();
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
