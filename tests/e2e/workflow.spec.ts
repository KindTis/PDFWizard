import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const samplePdfPath = fileURLToPath(new URL('../fixtures/sample.pdf', import.meta.url));

test('workflow tabs become visible after upload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '합치기' })).toHaveCount(0);

  await page.setInputFiles('#pdf-upload-input', samplePdfPath);

  await expect(page.getByRole('tab', { name: '합치기' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '분할' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '이미지 추출' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '페이지→이미지' })).toBeVisible();
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toHaveCount(0);

  await page.getByRole('tab', { name: '분할' }).click();
  await expect(page.getByLabel('분할 그룹 편집기')).toBeVisible();
  await expect(page.getByLabel('시작 페이지')).toBeVisible();
  await expect(page.getByLabel('끝 페이지')).toBeVisible();
  await expect(page.locator('.thumbnail-card').first()).toBeVisible();
  await expect(page.getByAltText(/1페이지 썸네일/)).toBeVisible();
});
