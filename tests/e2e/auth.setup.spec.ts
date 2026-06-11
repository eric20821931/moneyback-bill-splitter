import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');
const testEmail = process.env.E2E_TEST_EMAIL || 'your private test email';

test('manual login and save session', async ({ page }) => {
  await page.goto('/');

  console.log(`\nManual step: sign in with ${testEmail} in the opened browser.`);
  console.log('This test will wait up to 10 minutes, then save the authenticated session.\n');

  const dashboardReady = page
    .getByText(/總餘額|Total Balance|建立群組|Add Group|搜尋群組|Search groups/i)
    .first();

  await expect(dashboardReady).toBeVisible({ timeout: 600_000 });
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
  expect(fs.existsSync(authFile)).toBe(true);
});
