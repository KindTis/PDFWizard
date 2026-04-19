import { expect, test } from '@playwright/test';

test('upload and run flow is available', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: '작업 실행' })).toBeVisible();
  await expect(page.getByLabel('원본 유지')).toBeVisible();
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toBeVisible();

  await page.setInputFiles('#pdf-upload-input', {
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'),
  });

  await expect(page.getByText('업로드된 파일: 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '작업 실행' })).toBeEnabled();
});
