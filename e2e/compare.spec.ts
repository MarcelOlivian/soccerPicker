import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Setup card flip icon toggles the photo slot between the normal photo and a radar view', async ({ page }) => {
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();

  const firstCard = page.locator('.sp-player-grid .sp-card').first();
  await expect(firstCard.locator('.sp-card__flip')).toBeVisible();
  await expect(firstCard.locator('.sp-card__photo .sp-radar-chart')).toHaveCount(0);

  await firstCard.locator('.sp-card__flip').click();
  await expect(firstCard.locator('.sp-card__photo .sp-radar-chart')).toBeVisible();
  await expect(firstCard.locator('.sp-card__photo img, .sp-card__photo .sp-monogram')).toHaveCount(0);
  // The head (with the flip icon and position badge) and name stay put across the flip.
  await expect(firstCard.locator('.sp-card__head')).toBeVisible();
  await expect(firstCard.locator('.sp-card__name')).toBeVisible();

  await firstCard.locator('.sp-card__flip').click();
  await expect(firstCard.locator('.sp-card__photo .sp-radar-chart')).toHaveCount(0);
  await expect(firstCard.locator('.sp-card__photo img, .sp-card__photo .sp-monogram')).toHaveCount(1);
});

test("flipping one card doesn't move its Edit/Dup/Del row relative to a row-mate", async ({ page }) => {
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();

  const cards = page.locator('.sp-player-grid .sp-card');
  const first = cards.nth(0);
  const second = cards.nth(1);

  const beforeFirst = await first.locator('.sp-card__actions').boundingBox();
  const beforeSecond = await second.locator('.sp-card__actions').boundingBox();
  expect(beforeFirst).not.toBeNull();
  expect(beforeSecond).not.toBeNull();
  // Sanity check: both start at the same row.
  expect(Math.abs(beforeFirst!.y - beforeSecond!.y)).toBeLessThan(1);

  await first.locator('.sp-card__flip').click();
  await expect(first.locator('.sp-card__photo .sp-radar-chart')).toBeVisible();

  const afterFirst = await first.locator('.sp-card__actions').boundingBox();
  const afterSecond = await second.locator('.sp-card__actions').boundingBox();
  expect(afterFirst).not.toBeNull();
  expect(afterSecond).not.toBeNull();
  expect(Math.abs(afterFirst!.y - afterSecond!.y)).toBeLessThan(1);
  expect(Math.abs(afterFirst!.y - beforeFirst!.y)).toBeLessThan(1);
});

test('Draft-stage deck cards also get the radar flip icon, Field/History cards do not', async ({ page }) => {
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();
  await page.getByRole('tab', { name: 'Match' }).click();
  // Switch to 7-a-side so all 14 loaded demo players exactly match the formation's
  // required headcount — Continue to draft is disabled otherwise.
  await page.getByRole('button', { name: '7-a-side', exact: true }).click();
  const checkboxes = page.locator('.sp-attendance-row input[type=checkbox]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
  await page.getByRole('button', { name: /Continue to draft/i }).click();
  await page.selectOption('#captain-a', { index: 1 });
  await page.selectOption('#captain-b', { index: 2 });
  await page.getByRole('button', { name: /Start draft/i }).click();

  await expect(page.locator('.sp-draft-deck .sp-card').first().locator('.sp-card__flip')).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Auto-draft teams/i }).click();
  await page.getByRole('button', { name: /Continue to Field/i }).click();
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
