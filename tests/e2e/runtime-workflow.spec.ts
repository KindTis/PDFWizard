import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const samplePdfPath = fileURLToPath(new URL('../fixtures/sample.pdf', import.meta.url));

test('upload and run flow is available', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '작업 실행' })).toBeVisible();
  await expect(page.getByLabel('원본 유지')).toHaveCount(0);
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toHaveCount(0);

  await page.setInputFiles('#pdf-upload-input', samplePdfPath);

  await expect(page.getByText('업로드된 파일: 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '작업 실행' })).toBeEnabled();
});
