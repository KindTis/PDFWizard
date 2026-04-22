import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const samplePdfPath = fileURLToPath(new URL('../fixtures/sample.pdf', import.meta.url));

test('shows extract mode summary without extract policy controls', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('원본 유지')).toHaveCount(0);
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toHaveCount(0);

  await page.setInputFiles('#pdf-upload-input', samplePdfPath);
  await page.getByRole('tab', { name: '이미지 추출' }).click();

  const actionPanel = page.getByLabel('작업 인스펙터 패널');
  await expect(actionPanel.getByText('현재 작업: 이미지 추출')).toBeVisible();
  await expect(actionPanel.getByText('이미지 추출은 기본 옵션(원본 인코딩 우선, 변환 해제)으로 자동 처리됩니다.')).toBeVisible();
  await expect(page.getByLabel('원본 유지')).toHaveCount(0);
  await expect(page.getByLabel('강제 PNG/JPG 변환')).toHaveCount(0);

  const progressPanel = page.getByLabel('진행 상태 패널');
  await expect(progressPanel).toBeVisible();
  await expect(progressPanel.getByText('원본 파일')).toBeVisible();
  await expect(progressPanel.getByText('sample.pdf', { exact: true })).toBeVisible();
});
