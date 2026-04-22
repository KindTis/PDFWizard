import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const samplePdfPath = fileURLToPath(new URL('../fixtures/sample.pdf', import.meta.url));

test('workflow tabs visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '합치기' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '분할' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '이미지 추출' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '페이지→이미지' })).toBeVisible();
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toHaveCount(0);

  await page.getByRole('tab', { name: '분할' }).click();
  await expect(page.getByRole('heading', { name: '분할 그룹 편집' })).toBeVisible();
  await expect(page.getByText('분할 그룹 편집을 위해 PDF를 업로드하세요.')).toBeVisible();

  await page.setInputFiles('#pdf-upload-input', samplePdfPath);

  await expect(page.getByRole('button', { name: '범위 추가' })).toBeVisible();
  await expect(page.locator('.thumbnail-card').first()).toBeVisible();
  await expect(page.getByAltText('페이지 1 썸네일')).toBeVisible();
});
