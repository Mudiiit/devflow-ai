import { expect, test } from '@playwright/test';

test('login page onboarding content renders', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue with GitHub' })).toBeVisible();
  await expect(page.getByText('Onboarding is usually under 2 minutes.')).toBeVisible();
});
