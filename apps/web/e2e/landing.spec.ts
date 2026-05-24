import { expect, test } from '@playwright/test';

test('landing page renders primary CTAs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /Enterprise AI code review/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with GitHub' })).toBeVisible();
});
