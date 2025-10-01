import { test } from '@playwright/test';

test('debug page content', async ({ page }) => {
  await page.goto('http://localhost:3001', { timeout: 10000 });
  
  // Get all visible text
  const bodyText = await page.locator('body').textContent();
  console.log('===== PAGE TEXT CONTENT =====');
  console.log(bodyText);
  console.log('===========================');
  
  // Check for specific elements
  const appElement = await page.locator('tunnelforge-app').count();
  console.log('tunnelforge-app count:', appElement);
  
  const buttons = await page.locator('button').all();
  console.log('Total buttons:', buttons.length);
  
  for (let i = 0; i < Math.min(buttons.length, 10); i++) {
    const text = await buttons[i].textContent();
    const title = await buttons[i].getAttribute('title');
    const testId = await buttons[i].getAttribute('data-testid');
    console.log(`Button ${i}: text="${text?.trim()}" title="${title}" testid="${testId}"`);
  }
  
  // Check if auth is shown
  const auth = await page.locator('auth-login').count();
  console.log('auth-login count:', auth);
  
  const html = await page.content();
  console.log('HTML snippet:', html.substring(0, 1000));
});
