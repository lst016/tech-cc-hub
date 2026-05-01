const { chromium } = require('@playwright/test');

const DEFAULT_URL = process.env.PREVIEW_QA_URL || 'http://localhost:4173/';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_PATH,
  });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const logs = [];
  page.on('console', (message) => logs.push(`[console:${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => logs.push(`[pageerror] ${error.stack || error.message}`));

  await page.goto(DEFAULT_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.getByText('预览', { exact: true }).first().click({ timeout: 8000 });
  await page.waitForTimeout(1200);

  const explorer = page.locator('.native-explorer').first();
  await explorer.waitFor({ state: 'visible', timeout: 8000 });
  await explorer.getByText('package.json', { exact: true }).click({ timeout: 8000 });

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
  if (!bodyText.includes('package.json:')) throw new Error('Code reference chip was not rendered in composer');
  if (textareaValues.some((value) => value.includes('<code_references>'))) {
    throw new Error('Code reference block leaked into textarea instead of staying as UI chip');
  }

  const fatalLogs = logs.filter((line) => (
    line.includes('[pageerror]')
    || line.includes('[console:error]')
    || line.includes('worker_file')
  ));
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
