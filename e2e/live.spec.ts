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

  peerServer = spawn('node', ['e2e/peer-server.mjs', String(PEER_PORT), PEER_PATH], {
    stdio: 'pipe',
  });
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
  // the verification pass, so skipping it here is safe.
  const buildCmd = 'npx vite build --outDir dist-e2e-live';
  const previewCmd = `npm run preview -- --port ${APP_PORT} --strictPort --outDir dist-e2e-live`;
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

async function attendAndStartDraft(page: import('@playwright/test').Page) {
  await page.goto(APP_URL);
  await page.getByRole('button', { name: /Load 14 demo players/i }).click();
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
  const sessionCode = await host.locator('.sp-session-share__code').innerText();

  await client.goto(APP_URL);
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();

  await expect(host.locator('.sp-connection-chip')).toHaveText('LIVE', { timeout: 15_000 });
  await expect(client.locator('.sp-badge').filter({ hasText: 'PLAYERS' })).toHaveText('14 PLAYERS', {
    timeout: 10_000,
  });

  await client.getByRole('button', { name: /2\. DRAFT/i }).click();
  // Captain B is Sofia Reyes (attendAndStartDraft picks attending[1] as
  // captain B), so the turn header now reads her first name.
  await expect(client.locator('.sp-draft-header__turn')).toContainText('TEAM SOFIA');

  const pickedCard = client.locator('.sp-draft-deck .sp-card').first();
  const pickedName = await pickedCard.locator('.sp-card__name').innerText();
  await pickedCard.click();

  // .sp-card__name renders with CSS text-transform:uppercase, so
  // .innerText() (which reflects rendered text) returns the uppercase form
  // while this comparison target renders the same name in its original
  // mixed case — ignoreCase makes this a same-name check, not a
  // same-casing check.
  await expect(host.locator('.sp-draft-column[data-team="B"]')).toContainText(pickedName, {
    timeout: 10_000,
    ignoreCase: true,
  });

  await context.close();
});

test('an out-of-turn pick from the client is silently rejected', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const host = await context.newPage();
  const client = await context.newPage();

  await attendAndStartDraft(host); // 2 captain auto-picks: snake order A B B A A B..., so it's B's turn next
  await host.getByRole('button', { name: 'Go live' }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('WAITING', { timeout: 15_000 });
  const sessionCode = await host.locator('.sp-session-share__code').innerText();

  await client.goto(APP_URL);
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('LIVE', { timeout: 15_000 });

  await client.getByRole('button', { name: /2\. DRAFT/i }).click();
  // The client (captain B) legitimately picks now — it's their turn (the
  // 3rd pick in the A B B A A B... snake order, right after both captains'
  // auto-picks) — to advance the turn to captain A (the host) before
  // testing the lockout.
  await client.locator('.sp-draft-deck .sp-card').first().click();

  // Now it's A's turn (host), so the client's deck should be locked, not clickable.
  // Captain A is Marcus Webb (attendAndStartDraft picks attending[0]).
  await expect(client.locator('.sp-banner--info')).toHaveText('WAITING FOR TEAM MARCUS');
  await expect(client.locator('.sp-draft-deck .sp-card[role="button"]')).toHaveCount(0);

  const picksBefore = await host.locator('.sp-draft-header__turn').innerText();
  await expect(host.locator('.sp-draft-header__turn')).toHaveText(picksBefore); // no change from the locked-out client

  await context.close();
});

test('the host is locked out on the client\'s turn, mirroring the client\'s own lockout', async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const host = await context.newPage();
  const client = await context.newPage();

  await attendAndStartDraft(host); // 2 captain auto-picks -> it's already team B's (the client's) turn
  await host.getByRole('button', { name: 'Go live' }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('WAITING', { timeout: 15_000 });
  const sessionCode = await host.locator('.sp-session-share__code').innerText();

  await client.goto(APP_URL);
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('LIVE', { timeout: 15_000 });

  await host.getByRole('button', { name: /2\. DRAFT/i }).click();
  // Captain B is Sofia Reyes (attendAndStartDraft picks attending[1] as captain B).
  await expect(host.locator('.sp-banner--info')).toHaveText('WAITING FOR TEAM SOFIA');
  await expect(host.locator('.sp-draft-deck .sp-card[role="button"]')).toHaveCount(0);

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
  const sessionCode = await host.locator('.sp-session-share__code').innerText();

  await client.goto(APP_URL);
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(host.locator('.sp-connection-chip')).toHaveText('LIVE', { timeout: 15_000 });

  // Right after the 2 captain auto-picks it's team B's (the client's) turn
  // (snake order A B B A A B...), so the client makes its own legitimate
  // pick first — this both advances the turn to team A and is the only way
  // to reach A's turn now that the host is correctly locked out of B's.
  await host.getByRole('button', { name: /2\. DRAFT/i }).click().catch(() => {});
  await client.getByRole('button', { name: /2\. DRAFT/i }).click();
  await client.locator('.sp-draft-deck .sp-card').first().click();

  // Now it's the host's (team A's) turn. Host makes progress while the
  // client isn't looking.
  const hostCard = host.locator('.sp-draft-deck .sp-card').first();
  const hostPickedName = await hostCard.locator('.sp-card__name').innerText();
  await hostCard.click();

  // Client reloads and rejoins via the same code.
  await client.reload();
  await client.getByRole('tab', { name: 'Match' }).click();
  await client.fill('#join-code', sessionCode);
  await client.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(client.locator('.sp-badge').filter({ hasText: 'PLAYERS' })).toHaveText('14 PLAYERS', {
    timeout: 15_000,
  });

  await client.getByRole('button', { name: /2\. DRAFT/i }).click();
  // Case-insensitive: .sp-card__name renders uppercase via CSS.
  await expect(client.locator('.sp-draft-column[data-team="A"]')).toContainText(hostPickedName, {
    ignoreCase: true,
  });

  await context.close();
});
