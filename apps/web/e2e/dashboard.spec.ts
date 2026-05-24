import { test, expect } from '@playwright/test';

test('dashboard shell renders', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Risk pulse' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Queue status' })).toBeVisible();
});
