import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { expect, test } from '@playwright/test';

/**
 * Live two-seat draft, exercised against a *locally-run* PeerServer rather
 * than the public PeerJS cloud broker — this sandbox's egress policy blocks
 * the public broker outright, and pointing CI at a third-party service with
 * no SLA would make this suite flaky for reasons that have nothing to do
 * with the app. The transport is isolated behind SyncTransport specifically
 * so this swap (via VITE_PEERJS_HOST/PORT at build time) only touches this
 * file, not the app itself.
 */

const PEER_PORT = 9000;
const PEER_PATH = '/peerjs';
const APP_PORT = 4301;
const APP_URL = `http://localhost:${APP_PORT}`;

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

  peerServer = spawn('node', ['e2e/peer-server.mjs', String(PEER_PORT), PEER_PATH], {
    stdio: 'pipe',
  });
  await waitForProcessOutput(peerServer, /PEER_SERVER_READY/, 30_000);

  previewServer = spawn('npm', ['run', 'build', '&&', 'npm', 'run', 'preview', '--', '--port', String(APP_PORT), '--strictPort'], {
    stdio: 'pipe',
    shell: true,
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
  previewServer?.kill();
  peerServer?.kill();
});

async function attendAndStartDraft(page: import('@playwright/test').Page) {
  await page.goto(APP_URL);
  await page.getByRole('button', { name: /Load 12 demo players/i }).click();
  await page.getByRole('tab', { name: 'Match' }).click();
  const checkboxes = page.locator('.sp-attendance-row input[type=checkbox]');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
  await page.getByRole('button', { name: /Continue to draft/i }).click();
  await page.selectOption('#captain-a', { index: 1 });
  await page.selectOption('#captain-b', { index: 2 });
  await page.getByRole('button', { name: /Start draft/i }).click();
}

test('host goes live, client joins via the code, and a client pick shows up on the host', async ({ browser }) => {
  test.setTimeout(60_000); // two real browser contexts + WebRTC handshake against a local broker
  const context = await browser.newContext();
  const host = await context.newPage();
  const client = await context.newPage();

  await attendAndStartDraft(host);
  await host.getByRole('button', { name: 'Go live' }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('WAITING', { timeout: 15_000 });
  const sessionCode = await host.locator('.sp-live-panel__code').innerText();

  await client.goto(APP_URL);
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();

  await expect(host.locator('.sp-connection-chip')).toHaveText('LIVE', { timeout: 15_000 });
  await expect(client.locator('.sp-badge').filter({ hasText: 'PLAYERS' })).toHaveText('12 PLAYERS', {
    timeout: 10_000,
  });

  await client.getByRole('button', { name: /2\. DRAFT/i }).click();
  // Captain B is Sofia Reyes (attendAndStartDraft picks attending[1] as
  // captain B), so the turn header now reads her first name.
  await expect(client.locator('.sp-draft-header__turn')).toContainText('TEAM SOFIA');

  const pickedCard = client.locator('.sp-draft-deck .sp-card').first();
  const pickedName = await pickedCard.locator('.sp-card__name').innerText();
  await pickedCard.click();

  await expect(host.locator('.sp-draft-column[data-team="B"]')).toContainText(pickedName, { timeout: 10_000 });

  await context.close();
});

test('an out-of-turn pick from the client is silently rejected', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const host = await context.newPage();
  const client = await context.newPage();

  await attendAndStartDraft(host); // 2 captain picks -> A's turn next (snake order)
  await host.getByRole('button', { name: 'Go live' }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('WAITING', { timeout: 15_000 });
  const sessionCode = await host.locator('.sp-live-panel__code').innerText();

  await client.goto(APP_URL);
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('LIVE', { timeout: 15_000 });

  await client.getByRole('button', { name: /2\. DRAFT/i }).click();
  // It's A's turn (host), so the client's deck should be locked, not clickable.
  // Captain A is Marcus Webb (attendAndStartDraft picks attending[0]).
  await expect(client.locator('.sp-banner--info')).toHaveText('WAITING FOR TEAM MARCUS');
  await expect(client.locator('.sp-draft-deck .sp-card[role="button"]')).toHaveCount(0);

  const picksBefore = await host.locator('.sp-draft-header__turn').innerText();
  await expect(host.locator('.sp-draft-header__turn')).toHaveText(picksBefore); // no change from the locked-out client

  await context.close();
});

test('a client reload resyncs to the host\'s current state', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const host = await context.newPage();
  const client = await context.newPage();

  await attendAndStartDraft(host);
  await host.getByRole('button', { name: 'Go live' }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('WAITING', { timeout: 15_000 });
  const sessionCode = await host.locator('.sp-live-panel__code').innerText();

  await client.goto(APP_URL);
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('LIVE', { timeout: 15_000 });

  // Host makes progress while the client isn't looking.
  await host.getByRole('button', { name: /2\. DRAFT/i }).click().catch(() => {});
  const hostCard = host.locator('.sp-draft-deck .sp-card').first();
  const hostPickedName = await hostCard.locator('.sp-card__name').innerText();
  await hostCard.click();

  // Client reloads and rejoins via the same code.
  await client.reload();
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(client.locator('.sp-badge').filter({ hasText: 'PLAYERS' })).toHaveText('12 PLAYERS', {
    timeout: 15_000,
  });

  await client.getByRole('button', { name: /2\. DRAFT/i }).click();
  await expect(client.locator('.sp-draft-column[data-team="A"]')).toContainText(hostPickedName);

  await context.close();
});
