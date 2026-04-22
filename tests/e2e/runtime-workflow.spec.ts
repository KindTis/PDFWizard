import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const samplePdfPath = fileURLToPath(new URL('../fixtures/sample.pdf', import.meta.url));

test('upload and run flow is available after choosing a job', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '실행' })).toHaveCount(0);
  await expect(page.getByLabel('원본 유지')).toHaveCount(0);
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toHaveCount(0);

  await page.setInputFiles('#pdf-upload-input', samplePdfPath);
  await expect(page.getByRole('tab', { name: '합치기' })).toBeVisible();
  await page.getByRole('tab', { name: '합치기' }).click();
  await expect(page.getByLabel('작업 인스펙터 패널')).toBeVisible();
  await expect(page.getByLabel('하단 작업 바').getByRole('button', { name: '실행', exact: true })).toBeEnabled();
});
