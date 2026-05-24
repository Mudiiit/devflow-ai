import { test, expect } from '@playwright/test';

test('dashboard shell renders', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('Risk pulse')).toBeVisible();
  await expect(page.getByText('Queue status')).toBeVisible();
});
