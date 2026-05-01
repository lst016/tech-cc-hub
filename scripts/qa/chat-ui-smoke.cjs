const { chromium } = require('@playwright/test');

const DEFAULT_URL = process.env.CHAT_UI_QA_URL || 'http://localhost:4173/';
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

  const textarea = page.locator('textarea').last();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  await textarea.click();

  await page.keyboard.type('@src');
  await page.waitForTimeout(1800);
  const mentionVisible = await page.getByText('@ 文件提及', { exact: true }).isVisible().catch(() => false);
  if (!mentionVisible) throw new Error('@ file mention palette did not open');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  const bodyText = await page.locator('body').innerText({ timeout: 8000 });
  if (!bodyText.includes('路径引用')) throw new Error('File reference card was not rendered');

  const textareaValues = await page.locator('textarea').evaluateAll((nodes) => nodes.map((node) => node.value));
  if (textareaValues.some((value) => value.includes('<file_references>') || value.includes('<message_references>'))) {
    throw new Error('Structured reference block leaked into textarea');
  }

  await textarea.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('/');
  await page.waitForTimeout(800);
  const slashVisible = await page.getByText('可用 Slash 命令', { exact: true }).isVisible().catch(() => false);
  if (slashVisible) {
    await page.keyboard.press('Escape');
  }

  const fatalLogs = logs.filter((line) => (
    line.includes('[pageerror]')
    || line.includes('[console:error]')
    || line.includes('prompt.startsWith is not a function')
  ));
  if (fatalLogs.length > 0) {
    throw new Error(`Chat UI QA saw fatal browser logs:\n${fatalLogs.join('\n')}`);
  }

  await browser.close();
  console.log('CHAT_UI_QA_OK');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
