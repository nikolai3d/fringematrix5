import { test, expect } from '@playwright/test';
import { waitForLoaderToFinish } from './helpers/wireframe';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await waitForLoaderToFinish(page);
});

test('Share popover shows "Share on Bluesky" button', async ({ page }) => {
  await page.getByRole('button', { name: 'Share' }).click();
  const shareDialog = page.getByRole('dialog').filter({ hasText: 'Share' });
  await expect(shareDialog).toBeVisible();
  await expect(shareDialog.getByRole('link', { name: 'Share on Bluesky' })).toBeVisible();
});

test('Share on Bluesky button navigates to bsky.app with correct URL', async ({ page, context }) => {
  await page.getByRole('button', { name: 'Share' }).click();
  const shareDialog = page.getByRole('dialog').filter({ hasText: 'Share' });
  await expect(shareDialog).toBeVisible();

  const blueskyLink = shareDialog.getByRole('link', { name: 'Share on Bluesky' });
  await expect(blueskyLink).toBeVisible();

  const href = await blueskyLink.getAttribute('href');
  expect(href).toBeTruthy();
  expect(href!).toMatch(/^https:\/\/bsky\.app\/intent\/compose\?text=/);

  const url = new URL(href!);
  const text = url.searchParams.get('text') ?? '';
  expect(text).toContain('https://fringematrix.art');
});

test('Share on Bluesky button has target="_blank" and safe rel', async ({ page }) => {
  await page.getByRole('button', { name: 'Share' }).click();
  const shareDialog = page.getByRole('dialog').filter({ hasText: 'Share' });
  const blueskyLink = shareDialog.getByRole('link', { name: 'Share on Bluesky' });

  await expect(blueskyLink).toHaveAttribute('target', '_blank');
  await expect(blueskyLink).toHaveAttribute('rel', 'noreferrer noopener');
});
