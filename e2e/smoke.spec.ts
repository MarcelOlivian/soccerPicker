import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('creates a player manually', async ({ page }) => {
  await page.getByRole('button', { name: '+ New player' }).click();
  await page.fill('#p-name', 'Test Striker');
  await page.getByRole('button', { name: 'Save player' }).click();
  await expect(page.locator('.sp-card').filter({ hasText: 'Test Striker' })).toBeVisible();
});

test('loads the 12-player demo roster', async ({ page }) => {
  await page.getByRole('button', { name: /Load 12 demo players/i }).click();
  await expect(page.locator('.sp-player-grid .sp-card')).toHaveCount(12);
});

test('runs a full 6-a-side draft, places a player on the board, and updates the balance meter', async ({
  page,
}) => {
  await page.getByRole('button', { name: /Load 12 demo players/i }).click();
  await page.getByRole('tab', { name: 'Match' }).click();

  const checkboxes = page.locator('.sp-attendance-row input[type=checkbox]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
  await expect(page.getByText('12 attending tonight.')).toBeVisible();
  await page.getByRole('button', { name: /Continue to draft/i }).click();

  await page.selectOption('#captain-a', { index: 1 });
  await page.selectOption('#captain-b', { index: 2 });
  await page.getByRole('button', { name: /Start draft/i }).click();

  // Draft everyone by repeatedly taking the first available card.
  for (let i = 0; i < 12; i++) {
    const card = page.locator('.sp-draft-deck .sp-card').first();
    if ((await card.count()) === 0) break;
    await card.click();
  }
  await expect(page.locator('.sp-draft-header__turn')).toHaveText('DRAFT COMPLETE');

  await page.getByRole('button', { name: /Skip to Field/i }).click();
  await expect(page.locator('.sp-balance-meter')).toBeVisible();

  const strengthBefore = await page.locator('.sp-balance-meter__label[data-team="A"]').innerText();

  // Drag Team A's captain (the goalkeeper, first in the column) onto a DEF
  // slot rather than "any" empty slot — dropping a GK onto the GK slot
  // would legitimately produce a zero rating delta (same position), which
  // wouldn't demonstrate the position-aware re-rating this is meant to show.
  //
  // The field now sits full-width above the team panels, so the source card
  // and target slot are usually far enough apart vertically that a one-shot
  // dragTo() doesn't land — real usage relies on the autoscroll-while-
  // dragging behavior near the viewport edge, so this steps the mouse and
  // pauses the same way a real drag would, giving that loop time to run.
  const teamACard = page.locator('.sp-team-column[data-team="A"] .sp-card').first();
  const targetSlot = page.getByRole('button', { name: /^DEF slot, empty$/ }).first();
  await teamACard.scrollIntoViewIfNeeded();
  const cardBox = await teamACard.boundingBox();
  if (!cardBox) throw new Error('Team A card has no bounding box');
  const sx = cardBox.x + cardBox.width / 2;
  const sy = cardBox.y + cardBox.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx, sy - 40, { steps: 5 });
  for (let i = 0; i < 60; i++) {
    await page.mouse.move(sx, 40, { steps: 1 });
    await page.waitForTimeout(20);
  }
  const targetBox = await targetSlot.boundingBox();
  if (!targetBox) throw new Error('Target DEF slot has no bounding box');
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('.sp-slot--filled')).toHaveCount(1);
  // Placing a player at their slot's position re-rates them there, so the
  // team-strength figure in the balance meter should have moved.
  await expect(page.locator('.sp-balance-meter__label[data-team="A"]')).not.toHaveText(strengthBefore);
});

test('exports a roster and re-imports it after clearing', async ({ page }) => {
  await page.getByRole('button', { name: /Load 12 demo players/i }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export' }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();

  page.on('dialog', (dialog) => dialog.accept());
  for (let i = 0; i < 12; i++) {
    const card = page.locator('.sp-player-grid .sp-card').first();
    if ((await card.count()) === 0) break;
    await card.getByRole('button', { name: 'Del' }).click();
  }
  await expect(page.getByText('No players yet.')).toBeVisible();

  const importInput = page.locator('input[type=file][accept="application/json"]');
  await importInput.setInputFiles(path as string);
  await expect(page.locator('.sp-player-grid .sp-card')).toHaveCount(12);
});

test('copies a roster share link and a fresh session can open it', async ({ page, context }) => {
  await page.getByRole('button', { name: /Load 12 demo players/i }).click();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.getByRole('button', { name: 'Copy roster link' }).click();
  // The click handler awaits buildShareLink() before writing to the
  // clipboard, so click() resolving doesn't mean the write has landed yet.
  // Wait for the confirmation banner (shown only after the write resolves)
  // instead of racing it.
  await expect(page.getByText('Roster link copied to clipboard.')).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain('#roster=');

  const fresh = await context.newPage();
  fresh.once('dialog', (dialog) => dialog.accept()); // accept = replace the (empty) roster
  await fresh.goto(url);
  await expect(fresh.locator('.sp-badge').filter({ hasText: 'PLAYERS' })).toHaveText('12 PLAYERS');
});
