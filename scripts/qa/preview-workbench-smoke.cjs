const { chromium } = require('@playwright/test');
const { existsSync } = require('node:fs');
const { platform } = require('node:os');

const DEFAULT_URL = process.env.PREVIEW_QA_URL || 'http://localhost:4173/';
const DEFAULT_PREFERRED_FILE = process.env.PREVIEW_QA_FILE || 'package.json';

function candidateChromePaths() {
  if (process.env.PREVIEW_QA_CHROME_PATH) return [process.env.PREVIEW_QA_CHROME_PATH];
  if (platform() === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  if (platform() === 'win32') {
    return [
      `${process.env.PROGRAMFILES || 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
      `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe`,
    ].filter(Boolean);
  }
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
}

function resolveChromePath() {
  return candidateChromePaths().find((candidate) => existsSync(candidate));
}

function isIgnorableConsoleError(line) {
  return (
    line.includes('Content Security Policy')
    || line.includes("violates the following Content Security Policy directive")
  );
}

function isFatalBrowserLog(line) {
  if (line.includes('[pageerror]')) return true;
  if (line.includes('Maximum update depth')) return true;
  if (line.includes('getSnapshot')) return true;
  if (line.includes('worker_file')) return true;
  if (line.includes('[console:error]')) return !isIgnorableConsoleError(line);
  return false;
}

async function main() {
  const executablePath = resolveChromePath();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const logs = [];
  page.on('console', (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => logs.push(`[pageerror] ${error.stack || error.message}`));

  await page.goto(DEFAULT_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  const previewTab = page.locator('.activity-workspace-tabs-scroll [title="文件预览"] button').first();
  await previewTab.click({ timeout: 8000 });
  await page.waitForTimeout(1200);

  const explorer = page.locator('.native-explorer').first();
  await explorer.waitFor({ state: 'visible', timeout: 8000 });
  let chosenFileName = DEFAULT_PREFERRED_FILE;
  const preferredFile = explorer.getByText(DEFAULT_PREFERRED_FILE, { exact: true }).first();
  if (await preferredFile.count() > 0) {
    await preferredFile.click({ timeout: 8000 });
  } else {
    const firstFileRow = explorer.locator('.native-explorer__row--file').first();
    await firstFileRow.waitFor({ state: 'visible', timeout: 8000 });
    chosenFileName = (
      await firstFileRow.locator('.native-explorer__file-name').first().innerText().catch(() => DEFAULT_PREFERRED_FILE)
    ).trim() || DEFAULT_PREFERRED_FILE;
    await firstFileRow.click({ timeout: 8000 });
  }

  const editor = page.locator('.monaco-editor').first();
  await editor.waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000);

  const loadingVisible = await page.getByText('Loading...', { exact: true }).isVisible().catch(() => false);
  if (loadingVisible) throw new Error('Preview editor is stuck on Loading...');

  const box = await editor.boundingBox();
  if (!box) throw new Error('Monaco editor has no bounding box');

  await page.mouse.move(box.x + 82, box.y + 48);
  await page.mouse.down();
  await page.mouse.move(box.x + 210, box.y + 116, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(600);

  await page.getByText('粘贴到输入框', { exact: true }).click({ timeout: 8000, force: true });
  await page.waitForTimeout(800);

  const bodyText = await page.locator('body').innerText({ timeout: 8000 });
  const textareaValues = await page.locator('textarea').evaluateAll((nodes) => nodes.map((node) => node.value));
  if (!bodyText.includes(chosenFileName) || !bodyText.includes('代码')) {
    throw new Error('Code reference chip was not rendered in composer');
  }
  if (textareaValues.some((value) => value.includes('<code_references>'))) {
    throw new Error('Code reference block leaked into textarea instead of staying as UI chip');
  }

  const fatalLogs = logs.filter((line) => isFatalBrowserLog(line));
  if (fatalLogs.length > 0) {
    throw new Error(`Preview QA saw fatal browser logs:\n${fatalLogs.join('\n')}`);
  }

  await browser.close();
  console.log('PREVIEW_QA_OK');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
