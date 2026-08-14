import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createFakeTransportPair } from '../src/sync/fakeTransport';
import { createClientSession } from '../src/sync/clientSession';
import { reduce } from '../src/state/reducer';
import type { Action } from '../src/state/reducer';
import { defaultState } from '../src/lib/storage';
import type { AppState, MatchState, Player } from '../src/types';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function harness(initial: AppState) {
  let state = initial;
  return {
    getState: () => state,
    dispatch: (action: Action) => {
      state = reduce(state, action);
    },
    get current() {
      return state;
    },
  };
}

function makePlayer(id: string): Player {
  return {
    id,
    name: id,
    position: 'MID',
    stats: { pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3 },
    createdAt: 0,
  };
}

describe('clientSession', () => {
  it('HELLO replaces the local player list and match state', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(defaultState());
    createClientSession({ transport: clientT, dispatch: h.dispatch, getState: h.getState });

    const match: MatchState = {
      formation: '6',
      attendingIds: ['p1'],
      draft: { order: 'snake', picks: [] },
      placements: {},
    };
    hostT.send({ type: 'HELLO', players: [makePlayer('p1')], match, youAre: 'B' });
    await flush();

    expect(h.current.players).toHaveLength(1);
    expect(h.current.players[0].id).toBe('p1');
    expect(h.current.match).toEqual(match);
  });

  it('PHOTOS stores the image and patches the matching player with a photoKey', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness({ ...defaultState(), players: [makePlayer('p1')] });
    createClientSession({ transport: clientT, dispatch: h.dispatch, getState: h.getState });

    const tinyPngDataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    hostT.send({ type: 'PHOTOS', playerId: 'p1', dataUrl: tinyPngDataUrl });
    // fetch(dataUrl) -> blob() -> putImage() (IndexedDB open+transaction) is
    // several microtask/macrotask hops deep; give it a few ticks.
    for (let i = 0; i < 10; i++) await flush();

    expect(h.current.players[0].photoKey).toBeTruthy();
  });

  it('STATE replaces only match state, leaving players untouched', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness({ ...defaultState(), players: [makePlayer('p1'), makePlayer('p2')] });
    createClientSession({ transport: clientT, dispatch: h.dispatch, getState: h.getState });

    const newMatch: MatchState = {
      formation: '5',
      attendingIds: ['p1', 'p2'],
      draft: { order: 'alternating', picks: [{ playerId: 'p1', team: 'A' }] },
      placements: { 'A-GK-0': 'p1' },
    };
    hostT.send({ type: 'STATE', match: newMatch });
    await flush();

    expect(h.current.match).toEqual(newMatch);
    expect(h.current.players).toHaveLength(2); // untouched
  });

  it('sendPick/sendPlace/sendSwap/join emit the correct wire messages', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(defaultState());
    const session = createClientSession({ transport: clientT, dispatch: h.dispatch, getState: h.getState });

    const received: unknown[] = [];
    hostT.onMessage((m) => received.push(m));

    session.join('Captain B');
    session.sendPick('p1');
    session.sendPlace('B-DEF-0', 'p1');
    session.sendSwap('B-DEF-0', 'B-MID-0');
    await flush();

    expect(received).toEqual([
      { type: 'JOIN', displayName: 'Captain B' },
      { type: 'PICK', playerId: 'p1' },
      { type: 'PLACE', slotId: 'B-DEF-0', playerId: 'p1' },
      { type: 'SWAP', slotA: 'B-DEF-0', slotB: 'B-MID-0' },
    ]);
  });

  it('BYE invokes the onBye callback with the reason', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(defaultState());
    let byeReason: string | null = null;
    createClientSession({
      transport: clientT,
      dispatch: h.dispatch,
      getState: h.getState,
      onBye: (reason) => {
        byeReason = reason;
      },
    });

    hostT.send({ type: 'BYE', reason: 'host closed the session' });
    await flush();

    expect(byeReason).toBe('host closed the session');
  });
});
