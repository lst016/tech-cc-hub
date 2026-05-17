const { chromium } = require('@playwright/test');

const DEFAULT_URL = process.env.CHAT_UI_QA_URL || 'http://localhost:4173/';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const EXPECTED_ERRORS = [
  /Content Security Policy/i,
  /Refused to connect/i,
  /violates the following Content Security Policy/i,
  /Failed to invoke/i,
  /浏览器预览态不支持 IPC/i,
  /Failed to load resource/i,
  /Electron 客户端/i,
];

function isExpectedError(line) {
  return EXPECTED_ERRORS.some((pattern) => pattern.test(line));
}

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

  const promptBox = page.locator('[aria-label="输入提示"]');
  await promptBox.waitFor({ state: 'visible', timeout: 10000 });
  await promptBox.click();
  await page.waitForTimeout(300);

  // Test 1: Shift+Enter inserts a newline without submitting
  await page.keyboard.type('line1');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('line2');
  await page.waitForTimeout(200);

  const textAfterShiftEnter = await promptBox.innerText();
  if (textAfterShiftEnter !== 'line1\nline2') {
    throw new Error(`Shift+Enter: expected 'line1\\nline2', got ${JSON.stringify(textAfterShiftEnter)}`);
  }

  // Test 2: Plain Enter submits and clears the prompt box
  await promptBox.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type('hello enter smoke');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  const textAfterEnter = (await promptBox.innerText()).trim();
  if (textAfterEnter !== '') {
    throw new Error(`Plain Enter: expected empty prompt, got ${JSON.stringify(textAfterEnter)}`);
  }

  // Test 3: Meta+Enter / Ctrl+Enter also submits
  await promptBox.click();
  await page.keyboard.type('cmd enter test');
  await page.waitForTimeout(200);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
  await page.waitForTimeout(800);

  const textAfterCmdEnter = (await promptBox.innerText()).trim();
  if (textAfterCmdEnter !== '') {
    throw new Error(`Meta/Ctrl+Enter: expected empty prompt, got ${JSON.stringify(textAfterCmdEnter)}`);
  }

  // Check for unexpected fatal errors
  const unexpectedErrors = logs.filter((line) => {
    if (!line.includes('[pageerror]') && !line.includes('[console:error]')) return false;
    return !isExpectedError(line);
  });
  if (unexpectedErrors.length > 0) {
    throw new Error(`Unexpected browser errors:\n${unexpectedErrors.join('\n')}`);
  }

  await browser.close();
  console.log('PLAYWRIGHT_ENTER_SMOKE_OK');
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
