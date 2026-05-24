import { test, expect } from '@playwright/test';

test('dashboard shell renders', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Risk pulse' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Queue status' })).toBeVisible();
});

test('command surface is visible in shell', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible();
  await expect(page.getByText('Ctrl/Cmd+K')).toBeVisible();
});
