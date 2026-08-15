import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';

/**
 * Stats-voting session, exercised against a locally-run PeerServer for the
 * same reason e2e/live.spec.ts is: this sandbox's egress policy blocks the
 * public PeerJS broker outright. Uses its own port pair so it can run
 * alongside live.spec.ts without a bind conflict.
 */

const PEER_PORT = 9001;
const PEER_PATH = '/peerjs';
const APP_PORT = 4302;
const APP_URL = `http://localhost:${APP_PORT}`;

// playwright.local.config.ts sets fullyParallel:true, which would otherwise
// hand each test in this file its own worker — and since beforeAll/afterAll
// spawn one shared peer+preview server pair for the whole file, that would
// spawn multiple competing servers on the same port/outDir. Force this
// file's tests to share a single worker so beforeAll runs exactly once.
test.describe.configure({ mode: 'serial' });

let peerServer: ChildProcess | null = null;
let previewServer: ChildProcess | null = null;

function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() > deadline) reject(new Error(`Timed out waiting for ${url}`));
          else setTimeout(attempt, 300);
        });
    };
    attempt();
  });
}

function waitForProcessOutput(child: ChildProcess, pattern: RegExp, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for process output')), timeoutMs);
    const onData = (chunk: Buffer) => {
      if (pattern.test(chunk.toString())) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        resolve();
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
  });
}

test.beforeAll(async () => {
  test.setTimeout(120_000);

  peerServer = spawn('node', ['e2e/peer-server.mjs', String(PEER_PORT), PEER_PATH], { stdio: 'pipe' });
  await waitForProcessOutput(peerServer, /PEER_SERVER_READY/, 30_000);

  // Own outDir (not the default `dist`) so this build can't race the
  // default-config webServer's own `npm run build` writing to the same
  // folder when both run as part of the same `playwright test` invocation
  // — playwright.local.config.ts's webServer always starts, regardless of
  // which spec files were selected to run. Also call `vite build` directly
  // rather than `npm run build` (which is `tsc -b && vite build`): tsc -b's
  // incremental cache lives at a *fixed* path
  // (node_modules/.tmp/*.tsbuildinfo, see tsconfig.*.json) regardless of
  // --outDir, so two concurrent `tsc -b` runs (this one and the global
  // webServer's) race on that shared file and can corrupt the build.
  // Type-checking is already covered by the separate `npx tsc -b` step in
  // the verification pass, so skipping it here is safe. Mirrors the fix
  // already applied to e2e/live.spec.ts.
  const buildCmd = 'npx vite build --outDir dist-e2e-voting';
  const previewCmd = `npm run preview -- --port ${APP_PORT} --strictPort --outDir dist-e2e-voting`;
  // detached:true puts this process in its own process group (pgid ===
  // its own pid) so afterAll can kill the *whole* group below. Without
  // this, previewServer.kill() only signals the `sh -c` wrapper — its
  // `vite preview` grandchild (started via `&&`) survives as an orphan
  // still holding the port, which then serves garbage/nothing to the next
  // run and fails with net::ERR_HTTP_RESPONSE_CODE_FAILURE.
  previewServer = spawn(`${buildCmd} && ${previewCmd}`, {
    stdio: 'pipe',
    shell: true,
    detached: true,
    env: {
      ...process.env,
      VITE_PEERJS_HOST: 'localhost',
      VITE_PEERJS_PORT: String(PEER_PORT),
      VITE_PEERJS_PATH: PEER_PATH,
      VITE_PEERJS_SECURE: 'false',
    },
  });
  await waitForHttp(APP_URL, 90_000);
});

test.afterAll(async () => {
  if (previewServer?.pid) {
    try {
      process.kill(-previewServer.pid, 'SIGKILL'); // negative pid = whole process group
    } catch {
      previewServer.kill();
    }
  }
  peerServer?.kill();
});

test('full stats-vote flow: start, join, secret ballots, reveal, adjust, save', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext();
  const host = await context.newPage();
  const voterA = await context.newPage();
  const voterB = await context.newPage();

  // Host opens the new-player form and starts a vote as soon as a name exists.
  await host.goto(APP_URL);
  await host.getByRole('button', { name: '+ New player' }).click();
  await host.fill('#p-name', 'Marco Rossi');
  await host.selectOption('#p-pos', 'DEF');
  await host.getByRole('button', { name: 'Start stats vote' }).click();

  const sessionCode = await host.locator('.sp-session-share__code').innerText();
  expect(sessionCode).toMatch(/^VOTE-/);

  // Two voters join: one with a name, one blank (gets an auto handle).
  await voterA.goto(APP_URL);
  await voterA.getByRole('button', { name: 'Stats vote' }).click();
  await voterA.fill('#vote-name', 'Alex');
  await voterA.fill('#vote-code', sessionCode);
  await voterA.getByRole('button', { name: 'Join', exact: true }).click();

  await voterB.goto(APP_URL);
  await voterB.getByRole('button', { name: 'Stats vote' }).click();
  await voterB.fill('#vote-code', sessionCode);
  await voterB.getByRole('button', { name: 'Join', exact: true }).click();

  // Both voters see the subject's name, but never its rating or stat bars —
  // hideRatings must actually suppress them, not just visually hide them.
  for (const voter of [voterA, voterB]) {
    await expect(voter.locator('.sp-vote-panel__subject')).toContainText('Marco Rossi');
    await expect(voter.locator('.sp-vote-panel__subject .sp-card__overall')).toHaveCount(0);
    await expect(voter.locator('.sp-vote-panel__subject .sp-card__stats')).toHaveCount(0);
  }

  // Host sees both voters (plus itself) in the status list, still pending.
  await expect(host.locator('.sp-vote-panel__voter')).toHaveCount(3);
  await expect(host.getByText('Voted')).toHaveCount(0);

  // Each voter casts a distinct secret ballot.
  async function castBallot(page: import('@playwright/test').Page, labelToLevel: [string, number][]) {
    for (const [label, level] of labelToLevel) {
      await page.getByRole('radio', { name: `${label} ${level} of 5` }).click();
    }
    await page.getByRole('button', { name: /Submit my secret vote/i }).click();
  }

  await castBallot(voterA, [
    ['PAC', 5], ['SHO', 1], ['PAS', 5], ['DRI', 1], ['DEF', 5], ['PHY', 1],
  ]);
  await castBallot(voterB, [
    ['PAC', 1], ['SHO', 5], ['PAS', 1], ['DRI', 5], ['PAS', 1], ['PHY', 5],
  ]);

  // Neither voter's page ever contains the other's cast numbers before reveal.
  await expect(host.getByText('Voted')).toHaveCount(2, { timeout: 10_000 });
  const voterAHtml = await voterA.content();
  expect(voterAHtml).not.toContain('sp-vote-panel__table'); // no results table pre-reveal

  // Host reveals (its own ballot is still pending — exercises the "reveal
  // with a warning" path).
  host.once('dialog', (dialog) => dialog.accept());
  await host.getByRole('button', { name: /Reveal votes/i }).click();

  // Both voters and the host see the per-voter results grid.
  for (const page of [host, voterA, voterB]) {
    await expect(page.locator('.sp-vote-panel__results')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.sp-vote-panel__table tbody tr')).toHaveCount(3); // Alex, Voter N, Average
  }

  // Host brings the average into the form and adjusts shooting before saving.
  await host.getByRole('button', { name: 'Use these stats' }).click();
  await expect(host.getByRole('heading', { name: 'New player' })).toBeVisible();
  await host.getByRole('radio', { name: 'SHO 4 of 5' }).click();
  await host.getByRole('button', { name: 'Save player' }).click();

  const savedCard = host.locator('.sp-player-grid .sp-card').filter({ hasText: 'Marco Rossi' });
  await expect(savedCard).toBeVisible();
  // The host adjusted SHO after reveal, so the saved stats no longer exactly
  // match the vote -- the "verified" stamp must not appear.
  await expect(savedCard.locator('.sp-badge--verified')).toHaveCount(0);

  await context.close();
});

async function castBallotAs(page: import('@playwright/test').Page, level: number) {
  for (const label of ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']) {
    await page.getByRole('radio', { name: `${label} ${level} of 5` }).click();
  }
  await page.getByRole('button', { name: /Submit my secret vote/i }).click();
}

test('reveal is blocked below 2 cast ballots, and an untouched reveal marks the saved player as verified', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const host = await context.newPage();
  const voter = await context.newPage();

  await host.goto(APP_URL);
  await host.getByRole('button', { name: '+ New player' }).click();
  await host.fill('#p-name', 'Verified Test');
  await host.selectOption('#p-pos', 'ATT');
  await host.fill('#p-host-name', 'Marcel');
  await host.getByRole('button', { name: 'Start stats vote' }).click();
  const sessionCode = await host.locator('.sp-session-share__code').innerText();

  // Host casts its own ballot alone -> only 1 person has voted so far, so
  // "Reveal votes" must be disabled and unclickable.
  await castBallotAs(host, 3);
  const revealButton = host.getByRole('button', { name: /Reveal votes/i });
  await expect(revealButton).toBeDisabled();
  await expect(revealButton).toHaveText(/need 1 more vote/i);

  await voter.goto(APP_URL);
  await voter.getByRole('button', { name: 'Stats vote' }).click();
  await voter.fill('#vote-name', 'Sam');
  await voter.fill('#vote-code', sessionCode);
  await voter.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(voter.locator('.sp-vote-panel__steppers')).toBeVisible({ timeout: 10_000 });
  await castBallotAs(voter, 4);

  // Now 2 people have voted -> reveal is enabled and succeeds without a
  // pending-voters warning dialog (nobody is left pending).
  await expect(revealButton).toBeEnabled();
  await revealButton.click();
  await expect(host.locator('.sp-vote-panel__results')).toBeVisible({ timeout: 10_000 });

  // Save WITHOUT touching any stat -> the saved player should carry the
  // verified record.
  await host.getByRole('button', { name: 'Use these stats' }).click();
  await expect(host.locator('.sp-player-form__stats p.sp-hint')).toContainText(/Stats voted by Marcel.*Sam/);
  await host.getByRole('button', { name: 'Save player' }).click();

  const savedCard = host.locator('.sp-player-grid .sp-card').filter({ hasText: 'Verified Test' });
  await expect(savedCard).toBeVisible();
  await expect(savedCard.locator('.sp-badge--verified')).toHaveCount(1);

  // A subsequent manual edit clears the record.
  await savedCard.locator('.sp-card__actions button', { hasText: 'Edit' }).click();
  await host.getByRole('radio', { name: 'PAC 5 of 5' }).click();
  await expect(host.locator('.sp-player-form__stats p.sp-hint')).toHaveCount(0);
  await host.getByRole('button', { name: 'Save player' }).click();

  const savedCardAfterEdit = host.locator('.sp-player-grid .sp-card').filter({ hasText: 'Verified Test' });
  await expect(savedCardAfterEdit.locator('.sp-badge--verified')).toHaveCount(0);

  await context.close();
});

test('mutual exclusivity: starting a vote while a draft is live is blocked', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(APP_URL);
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();
  await page.getByRole('tab', { name: 'Match' }).click();
  await page.getByRole('button', { name: 'Go live' }).click();
  await expect(page.locator('.sp-connection-chip')).toHaveText('WAITING', { timeout: 15_000 });

  await page.getByRole('tab', { name: 'Setup' }).click();
  await page.getByRole('button', { name: '+ New player' }).click();
  await page.fill('#p-name', 'Blocked Player');
  await page.getByRole('button', { name: 'Start stats vote' }).click();

  await expect(page.getByText(/live draft is already active/i)).toBeVisible();
  // Still on the normal form — no vote session actually started.
  await expect(page.getByRole('heading', { name: 'New player' })).toBeVisible();
});
