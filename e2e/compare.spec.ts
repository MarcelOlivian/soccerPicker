import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Setup card flip icon toggles between the normal face and a radar view', async ({ page }) => {
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();

  const firstCard = page.locator('.sp-player-grid .sp-card').first();
  await expect(firstCard.locator('.sp-card__flip')).toBeVisible();
  await expect(firstCard.locator('.sp-card__radar-view')).toHaveCount(0);

  await firstCard.locator('.sp-card__flip').click();
  await expect(firstCard.locator('.sp-card__radar-view')).toBeVisible();
  await expect(firstCard.locator('.sp-radar-chart')).toBeVisible();
  await expect(firstCard.locator('.sp-card__photo')).toHaveCount(0);

  await firstCard.locator('.sp-card__flip').click();
  await expect(firstCard.locator('.sp-card__radar-view')).toHaveCount(0);
  await expect(firstCard.locator('.sp-card__photo')).toBeVisible();
});

test('Draft-stage deck cards also get the radar flip icon, Field/History cards do not', async ({ page }) => {
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();
  await page.getByRole('tab', { name: 'Match' }).click();
  const checkboxes = page.locator('.sp-attendance-row input[type=checkbox]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
  await page.getByRole('button', { name: /Continue to draft/i }).click();
  await page.selectOption('#captain-a', { index: 1 });
  await page.selectOption('#captain-b', { index: 2 });
  await page.getByRole('button', { name: /Start draft/i }).click();

  await expect(page.locator('.sp-draft-deck .sp-card').first().locator('.sp-card__flip')).toBeVisible();

  await page.getByRole('button', { name: /Skip to Field/i }).click();
  await expect(page.locator('.sp-team-column .sp-card__flip')).toHaveCount(0);
});

test('Compare tab: selecting players shows an overlaid radar with a legend, capped at 4', async ({ page }) => {
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();
  await page.getByRole('tab', { name: 'Compare' }).click();

  await expect(page.locator('.sp-compare-layout')).toBeVisible();
  await expect(page.locator('.sp-compare-panel')).toContainText('Select at least one player');

  const cards = page.locator('.sp-compare-layout .sp-player-grid .sp-card');
  await cards.nth(0).click();
  await expect(page.locator('.sp-compare-panel .sp-radar-chart')).toBeVisible();
  await expect(page.locator('.sp-compare-legend li')).toHaveCount(1);

  await cards.nth(1).click();
  await cards.nth(2).click();
  await cards.nth(3).click();
  await expect(page.locator('.sp-compare-legend li')).toHaveCount(4);

  // A 5th card is faded out and not clickable — the cap holds.
  const fifth = cards.nth(4);
  await expect(fifth).not.toHaveAttribute('role', 'button');
  await expect(page.locator('.sp-compare-legend li')).toHaveCount(4);

  // Deselecting one frees a slot.
  await cards.nth(0).click();
  await expect(page.locator('.sp-compare-legend li')).toHaveCount(3);

  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.locator('.sp-compare-panel')).toContainText('Select at least one player');
});

test('Compare tab on phone: pick list then a dedicated radar screen via the bottom bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();
  await page.getByRole('tab', { name: 'Compare' }).click();

  await expect(page.locator('.sp-compare-pick')).toBeVisible();
  const showButton = page.getByRole('button', { name: 'Show radar compare' });
  await expect(showButton).toBeDisabled();

  const cards = page.locator('.sp-compare-pick .sp-player-grid .sp-card');
  await cards.nth(0).click();
  await cards.nth(1).click();
  await expect(page.locator('.sp-compare-bar__count')).toHaveText('2 / 4 selected');
  await expect(showButton).toBeEnabled();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  await showButton.click();
  await expect(page.locator('.sp-radar-chart')).toBeVisible();
  await expect(page.locator('.sp-compare-legend li')).toHaveCount(2);

  // "Modify selection" goes back to the list, keeping the selection.
  await page.getByRole('button', { name: 'Modify selection' }).click();
  await expect(page.locator('.sp-compare-bar__count')).toHaveText('2 / 4 selected');

  // "Close comparison" goes back to the list AND clears the selection.
  await showButton.click();
  await page.getByRole('button', { name: 'Close comparison' }).click();
  await expect(page.locator('.sp-compare-bar__count')).toHaveText('0 / 4 selected');
});
