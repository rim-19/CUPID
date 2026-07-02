import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2600); // allow the load veil to lift
});

test('hero renders', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /find your next love story/i })).toBeVisible();
});

test('theme toggles', async ({ page }) => {
  const app = page.locator('#app');
  const before = (await app.getAttribute('data-theme')) || 'dark';
  await page.locator('[data-action="theme"]').first().click();
  await expect(app).not.toHaveAttribute('data-theme', before);
});

test('add to cart opens the drawer with the item', async ({ page }) => {
  await page.locator('#arrivals').scrollIntoViewIfNeeded();
  await page.locator('[data-action="add-cart"]').first().click();
  await expect(page.locator('[data-drawer]')).toBeVisible();
  await expect(page.locator('[data-drawer-cartcount]')).toHaveText('1');
});

test('search filters the catalog', async ({ page }) => {
  await page.locator('[data-action="search"]').first().click();
  const input = page.locator('[data-search-input]');
  await expect(input).toBeVisible();
  await input.fill('lantern');
  await expect(page.locator('.search-row')).toHaveCount(1);
});

test('quiz produces matches across three answers', async ({ page }) => {
  await page.locator('button[data-action="quiz"]').first().click();
  await page.locator('[data-quiz-q="0"] .quiz-opt').first().click();
  await page.locator('[data-quiz-q="1"] .quiz-opt').first().click();
  await page.locator('[data-quiz-q="2"] .quiz-opt').first().click();
  await expect(page.locator('[data-qtitle]').first()).not.toBeEmpty();
});
