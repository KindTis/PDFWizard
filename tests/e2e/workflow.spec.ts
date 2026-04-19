import { expect, test } from '@playwright/test';

test('workflow tabs visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('tab', { name: '합치기' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '분할' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '이미지 추출' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '페이지→이미지' })).toBeVisible();
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toBeVisible();

  await page.getByRole('tab', { name: '분할' }).click();
  await expect(page.getByRole('heading', { name: '분할 그룹 편집' })).toBeVisible();
  await expect(page.getByText('분할 그룹 편집을 위해 PDF를 업로드하세요.')).toBeVisible();

  await page.setInputFiles('#pdf-upload-input', {
    name: 'sample.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'),
  });

  await expect(page.getByRole('button', { name: '범위 추가' })).toBeVisible();
});
