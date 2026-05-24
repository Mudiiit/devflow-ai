import { expect, test } from '@playwright/test';

test('review history and detail pages render key visualization elements', async ({ page }) => {
  await page.goto('/reviews');

  await expect(page.getByRole('heading', { name: 'Review history' })).toBeVisible();
  await expect(page.getByRole('link', { name: /acme\/platform-api/i })).toBeVisible();

  await page.goto('/reviews/rvw_1024');

  await expect(page.getByRole('heading', { name: 'Review details' })).toBeVisible();
  const confidenceLabels = page.getByText('AI confidence');
  await expect(confidenceLabels).toHaveCount(3);
  await expect(confidenceLabels.first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open GitHub review' })).toBeVisible();
});
