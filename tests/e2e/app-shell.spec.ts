import { expect, test } from '@playwright/test';

test('app shell shows 3-step header and upload button', async ({ page }) => {
  await page.goto('/');
  const stepHeader = page.locator('[aria-label=\"작업 단계\"]');
  await expect(stepHeader.getByText(/업로드/)).toBeVisible();
  await expect(stepHeader.getByText(/작업/)).toBeVisible();
  await expect(stepHeader.getByText(/내보내기/)).toBeVisible();
  await expect(page.getByRole('button', { name: '파일 선택' })).toBeVisible();
  await expect(page.getByLabel('원본 유지')).toBeVisible();
});
