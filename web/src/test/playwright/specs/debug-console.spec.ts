import { test } from '@playwright/test';

test('debug console errors', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      errors.push(text);
      console.log('CONSOLE ERROR:', text);
    } else if (msg.type() === 'warning') {
      warnings.push(text);
    }
  });
  
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    errors.push(error.message);
  });
  
  await page.goto('http://localhost:3001', { timeout: 10000, waitUntil: 'networkidle' });
  
  await page.waitForTimeout(3000);
  
  console.log(`\n===== SUMMARY =====`);
  console.log(`Total errors: ${errors.length}`);
  console.log(`Total warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log(`\n===== ERRORS =====`);
    errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
  }
});
