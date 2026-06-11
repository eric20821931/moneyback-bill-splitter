import { expect, test } from '@playwright/test';
import path from 'node:path';

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');

test.use({ storageState: authFile });

const addGroupText = /建立群組|Add Group/i;
const addExpenseText = /新增支出|Add Expense/i;
const saveText = /^儲存$|^Save$/i;
const deleteGroupText = /刪除群組|Delete Group/i;

test('authenticated dashboard, settings, friends, and reports load', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/總餘額|Total Balance/i).first()).toBeVisible();
  await expect(page.getByText(addGroupText).first()).toBeVisible();
  await expect(page.getByPlaceholder(/搜尋群組|Search groups/i)).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByText(/匯率換算|Exchange Rates/i)).toBeVisible();
  await expect(page.getByText(/USD 1|Rates based on USD 1/i)).toBeVisible();

  await page.goto('/friends');
  await expect(page.getByText(/朋友|Friends/i).first()).toBeVisible();
  await expect(page.getByText(/新增朋友|Add Friend/i).first()).toBeVisible();

  await page.goto('/reports');
  await expect(page.getByText(/報表|Reports/i).first()).toBeVisible();
});

test('create group, add expense, verify expense, and delete group', async ({ page }) => {
  const groupName = `E2E ${Date.now()}`;
  const expenseName = `Coffee ${Date.now()}`;

  await page.goto('/');
  await page.getByText(addGroupText).first().click();
  await page.getByPlaceholder(/例如：日本旅行|Vacation to Japan/i).fill(groupName);
  await page.getByRole('button', { name: saveText }).click();
  await expect(page.getByText(groupName)).toBeVisible();

  await page.getByText(groupName).click();
  await expect(page.getByText(addExpenseText).first()).toBeVisible();
  await page.getByText(addExpenseText).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('input').nth(0).fill(expenseName);
  await dialog.locator('input[type="number"]').first().fill('12.34');
  await dialog.getByRole('button', { name: saveText }).click();

  await expect(page.getByText(expenseName)).toBeVisible();
  await expect(page.getByText(/12\.34/).first()).toBeVisible();

  page.on('dialog', (confirmDialog) => confirmDialog.accept());
  await page.getByRole('button', { name: /群組設定|Group Settings/i }).click();
  await page.getByRole('button', { name: deleteGroupText }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(groupName)).toHaveCount(0);
});
