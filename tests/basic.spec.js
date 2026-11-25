const { test, expect } = require('@playwright/test');

test('smoke', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(`PAGE_ERROR:${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`CONSOLE_ERROR:${msg.text()}`);
  });

  await page.goto('http://localhost:5190', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('#btn-start');
  await page.waitForTimeout(1500);
  const body = await page.locator('body').innerText();
  console.log('BODY_SNIPPET:', body.slice(0, 500));
  console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await expect(page.locator('#view-zones')).toBeVisible();
});
