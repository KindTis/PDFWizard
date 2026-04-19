import { expect, test } from '@playwright/test';

test('shows extract policy controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('원본 유지')).toBeVisible();
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toBeVisible();
  await expect(page.getByText('원본 유지: 0', { exact: true })).toBeVisible();
  await expect(page.getByText('변환: 0', { exact: true })).toBeVisible();
  await expect(page.getByText('실패: 0', { exact: true })).toBeVisible();
});
