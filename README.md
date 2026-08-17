# SquadRef

**Draft fair. Ref easy. Track everything.**

A player-card database and team picker for pickup soccer. Build a roster of
your regulars with a handful of stats and a photo, run a guided draft with a
live balance meter, then arrange the two teams on a sketched pitch — solo on
one screen, or live from two devices with the second captain picking on
their own phone.

Everything lives in the browser: the roster is stored in `localStorage`,
uploaded photos in IndexedDB, nothing is sent to a server. A JSON export and
a compressed "roster link" both move a roster between devices without any
backend.

## Running locally

```sh
npm install
npm run dev
```

Open the printed local URL. `Setup` builds the player database; `Match`
runs attendance → draft → pitch board.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright) — see below |
| `npm run lint` | oxlint |

## Live two-seat drafting

`GO LIVE` on the Match tab starts a peer-to-peer session over WebRTC,
brokered by the free public [PeerJS](https://peerjs.com) cloud service —
only the initial handshake touches it, all draft/board data flows directly
between the two browsers afterward. The second captain opens the printed
link or scans the QR code to join and picks for their own team from their
own device; the host stays authoritative and validates every remote action
against the same rules a local click would follow.

Because the broker is a third-party service with no uptime guarantee, going
live is optional and fails gracefully — if it can't connect, the app says so
and falls back to running the draft on one screen, with the roster link
(`Copy roster link`, no live connection needed) as the way to hand a roster
to someone else's device.

The transport lives entirely behind one interface
(`src/sync/transport.ts`), so if the public broker ever needs replacing —
a self-hosted PeerServer, a small relay — only `src/sync/peerjsTransport.ts`
changes.

## End-to-end tests

```sh
npx playwright install --with-deps chromium   # once
npm run e2e                    # e2e/smoke.spec.ts — core app flows
npx playwright test e2e/live.spec.ts   # live sync, against a local PeerServer
```

`e2e/live.spec.ts` spins up its own local PeerServer (`e2e/peer-server.mjs`)
and a separate build of the app pointed at it via `VITE_PEERJS_HOST`, so it
never touches the public broker. It's excluded from the GitHub Pages deploy
gate (real WebRTC connections are inherently a bit flakier than the rest of
the suite) but runs on every pull request via `.github/workflows/ci.yml`.

## Deploying

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages
on every push to `main`. **One manual step is required once**: in the
repo's Settings → Pages, set the source to "GitHub Actions".

## Project layout

```
src/
  types.ts            Core data model (Player, Match, Draft, Placements)
  lib/                 Pure logic: rating, balance, draft order, formations,
                        storage, image handling, export/import, share links
  sync/                Live-mode protocol, transports (PeerJS/BroadcastChannel/
                        fake), host & client session logic
  state/               React state: the app reducer, AppContext, LiveContext
  components/          Shared UI: PlayerCard, Pitch, Slot, TeamColumn, ...
  features/
    roster/             Setup tab — player database
    match/               Match tab — attendance, draft, board, live panels
tests/                 Vitest unit tests
e2e/                   Playwright end-to-end tests
```
