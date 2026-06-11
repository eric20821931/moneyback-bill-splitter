import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { cleanupE2E, seedSyntheticUsers } from './db';

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json');
const prefix = `e2e-${Date.now()}`;
const groupName = `E2E_ADV_${prefix}_multi`;

test.use({ storageState: authFile });

test.beforeAll(async () => {
  await cleanupE2E(prefix);
});

test.afterAll(async () => {
  await cleanupE2E(prefix);
});

test('multi-friend, multi-currency split, avatar upload, and invalid inputs', async ({ page }) => {
  const [friendA, friendB] = await seedSyntheticUsers(prefix);

  await page.goto('/');
  await expect(page.getByText(/總餘額|Total Balance/i).first()).toBeVisible();

  const profile = await api<{ profile: { uid: string; displayName: string; photoURL?: string } }>(page, 'profile.update');
  expect(profile.ok).toBe(true);
  const currentUserId = profile.data.profile.uid;
  const originalPhotoURL = profile.data.profile.photoURL || '';
  const baselineSummary = await api<{ totalOwedToYou: number; totalYouOwe: number; totalBalance: number }>(page, 'balances.summary');
  expect(baselineSummary.ok).toBe(true);

  await expectApiOk(await api(page, 'friends.add', { email: friendA.email }));
  await expectApiOk(await api(page, 'friends.add', { email: friendB.email }));

  const createdGroup = await api<{ group: { id: string; memberIds: string[]; currency: string } }>(page, 'groups.create', {
    name: groupName,
    currency: 'TWD',
  });
  expect(createdGroup.ok).toBe(true);
  const groupId = createdGroup.data.group.id;

  await expectApiOk(await api(page, 'groups.addMemberByEmail', { groupId, email: friendA.email }));
  const memberGroup = await api<{ group: { memberIds: string[] } }>(page, 'groups.addMemberByEmail', { groupId, email: friendB.email });
  expect(memberGroup.ok).toBe(true);
  expect(memberGroup.data.group.memberIds.sort()).toEqual([currentUserId, friendA.uid, friendB.uid].sort());

  const expense = await api(page, 'expenses.create', {
    groupId,
    description: 'E2E complex AUD dinner',
    amount: 600,
    currency: 'TWD',
    originalCurrency: 'AUD',
    originalAmount: 30,
    exchangeRate: 20,
    payerId: currentUserId,
    splitType: 'percentage',
    splits: {
      [currentUserId]: 300,
      [friendA.uid]: 180,
      [friendB.uid]: 120,
    },
    splitPercentages: {
      [currentUserId]: 50,
      [friendA.uid]: 30,
      [friendB.uid]: 20,
    },
  });
  expect(expense.ok).toBe(true);
  expect(expense.data.expense.splitPercentages).toMatchObject({
    [currentUserId]: 50,
    [friendA.uid]: 30,
    [friendB.uid]: 20,
  });

  await page.goto(`/group/${groupId}`);
  await expect(page.getByText('E2E complex AUD dinner')).toBeVisible();
  await expect(page.getByText(/30\.00 AUD/i)).toBeVisible();
  await expect(page.getByText(/600\.00 TWD/i)).toBeVisible();
  await expect(page.getByText(/50\.00%.*300\.00 TWD/i)).toBeVisible();
  await expect(page.getByText(/30\.00%.*180\.00 TWD/i)).toBeVisible();
  await expect(page.getByText(/20\.00%.*120\.00 TWD/i)).toBeVisible();

  const summary = await api<{ totalOwedToYou: number; totalYouOwe: number; totalBalance: number }>(page, 'balances.summary');
  expect(summary.ok).toBe(true);
  expect(summary.data.totalOwedToYou - baselineSummary.data.totalOwedToYou).toBeGreaterThanOrEqual(300);
  expect(summary.data.totalYouOwe).toBeCloseTo(baselineSummary.data.totalYouOwe, 2);
  expect(summary.data.totalBalance - baselineSummary.data.totalBalance).toBeGreaterThanOrEqual(300);

  await expectInvalid(page, 'expenses.create', {
    groupId,
    description: 'bad negative',
    amount: -1,
    currency: 'TWD',
    payerId: currentUserId,
    splits: { [currentUserId]: -1 },
    splitPercentages: { [currentUserId]: 100 },
  }, 500, 'error_valid_amount');

  await expectInvalid(page, 'expenses.create', {
    groupId,
    description: 'bad currency',
    amount: 10,
    currency: 'DOGE',
    payerId: currentUserId,
    splits: { [currentUserId]: 10 },
    splitPercentages: { [currentUserId]: 100 },
  }, 500, 'invalid_currency');

  await expectInvalid(page, 'expenses.create', {
    groupId,
    description: 'bad payer',
    amount: 10,
    currency: 'TWD',
    payerId: `${prefix}-not-member`,
    splits: { [currentUserId]: 10 },
    splitPercentages: { [currentUserId]: 100 },
  }, 403, 'forbidden');

  await expectInvalid(page, 'expenses.create', {
    groupId,
    description: 'bad split total',
    amount: 10,
    currency: 'TWD',
    payerId: currentUserId,
    splits: { [currentUserId]: 9 },
    splitPercentages: { [currentUserId]: 100 },
  }, 500, 'invalid_split_total');

  await expectInvalid(page, 'expenses.create', {
    groupId,
    description: 'bad percentage total',
    amount: 10,
    currency: 'TWD',
    payerId: currentUserId,
    splits: { [currentUserId]: 10 },
    splitPercentages: { [currentUserId]: 90 },
  }, 500, 'error_percentage_total');

  const avatarPath = writeTinyAvatar();
  await page.goto('/settings');
  await page.locator('input[type="file"]').setInputFiles(avatarPath);
  await expect(page.locator(`img[src^="data:image/"]`).first()).toBeVisible();

  const uploadedProfile = await api<{ profile: { photoURL?: string } }>(page, 'profile.update', {});
  expect(uploadedProfile.data.profile.photoURL || '').toContain('data:image/');

  await expectApiOk(await api(page, 'profile.update', { photoURL: originalPhotoURL }));
  await expectApiOk(await api(page, 'groups.delete', { groupId }));
});

async function api<T = any>(page: Page, action: string, payload: Record<string, unknown> = {}) {
  return page.evaluate(async ({ action, payload }) => {
    const clerk = (window as unknown as {
      Clerk?: { session?: { getToken: () => Promise<string | null> } };
    }).Clerk;
    const token = await clerk?.session?.getToken();
    if (!token) throw new Error('missing_clerk_token');

    const response = await fetch('/api/app', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data } as { ok: boolean; status: number; data: T & { error?: string } };
  }, { action, payload });
}

async function expectApiOk(response: { ok: boolean; status: number; data: any }) {
  expect(response.ok, JSON.stringify(response.data)).toBe(true);
  expect(response.status).toBe(200);
}

async function expectInvalid(
  page: Page,
  action: string,
  payload: Record<string, unknown>,
  status: number,
  error: string
) {
  const response = await api(page, action, payload);
  expect(response.ok).toBe(false);
  expect(response.status).toBe(status);
  expect(response.data.error).toBe(error);
}

function writeTinyAvatar() {
  const avatarPath = path.join(process.cwd(), 'test-results', 'e2e-avatar.png');
  fs.mkdirSync(path.dirname(avatarPath), { recursive: true });
  fs.writeFileSync(
    avatarPath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    )
  );
  return avatarPath;
}
