import { describe, expect, it } from 'vitest';
import { createFakeTransportPair } from '../src/sync/fakeTransport';
import { createHostSession } from '../src/sync/hostSession';
import { reduce } from '../src/state/reducer';
import type { Action } from '../src/state/reducer';
import { defaultState } from '../src/lib/storage';
import type { HostMessage } from '../src/sync/protocol';
import type { AppState, Player } from '../src/types';

function makePlayer(id: string): Player {
  return {
    id,
    name: id,
    position: 'MID',
    stats: { pace: 3, stamina: 3, finishing: 3, defending: 3, passing: 3, goalkeeping: 1 },
    createdAt: 0,
  };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * A drafted 4-player match (2 per team), alternating order: captains a1/b1
 * are already picks 0 and 1 (n=2), so with alternating order (turn = n%2
 * === 0 ? A : B) it's actually A's turn next, not B's.
 */
function draftedState(): AppState {
  let state = defaultState();
  state = { ...state, players: ['a1', 'a2', 'b1', 'b2'].map(makePlayer) };
  state = reduce(state, { type: 'SET_ATTENDING', ids: ['a1', 'a2', 'b1', 'b2'] });
  state = reduce(state, { type: 'SET_DRAFT_ORDER', order: 'alternating' });
  state = reduce(state, { type: 'SET_CAPTAINS', captainA: 'a1', captainB: 'b1' });
  return state;
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

describe('hostSession', () => {
  it('sends HELLO with current match state when the client JOINs', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(draftedState());
    const session = createHostSession({ transport: hostT, getState: h.getState, dispatch: h.dispatch });

    const received: HostMessage[] = [];
    clientT.onMessage((m) => received.push(m as HostMessage));
    clientT.send({ type: 'JOIN' });
    await flush();

    const hello = received.find((m) => m.type === 'HELLO');
    expect(hello).toBeDefined();
    if (hello?.type === 'HELLO') {
      expect(hello.youAre).toBe('B');
      expect(hello.match.draft.picks).toHaveLength(2); // both captains auto-picked
    }
    session.dispose();
  });

  it('applies a valid in-turn PICK and broadcasts STATE', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(draftedState());
    h.dispatch({ type: 'APPLY_PICK', playerId: 'a2' }); // A's real pick (n=2, A's turn); now n=3, B's turn
    const session = createHostSession({ transport: hostT, getState: h.getState, dispatch: h.dispatch });

    const received: HostMessage[] = [];
    clientT.onMessage((m) => received.push(m as HostMessage));
    clientT.send({ type: 'PICK', playerId: 'b2' }); // client is team B, and it is B's turn
    await flush();
    session.broadcastState();
    await flush();

    expect(h.current.match.draft.picks).toHaveLength(4);
    expect(h.current.match.draft.picks[3]).toEqual({ playerId: 'b2', team: 'B' });
    expect(received.some((m) => m.type === 'STATE')).toBe(true);
    session.dispose();
  });

  it('rejects an out-of-turn PICK', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(draftedState()); // n=2, it's A's turn — not the client's (team B)
    const session = createHostSession({ transport: hostT, getState: h.getState, dispatch: h.dispatch });

    clientT.send({ type: 'PICK', playerId: 'a2' }); // client is team B, but it's A's turn
    await flush();

    expect(h.current.match.draft.picks).toHaveLength(2); // unchanged by the rejected pick
    session.dispose();
  });

  it('rejects a stale PICK for a player who has already been taken', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(draftedState());
    const session = createHostSession({ transport: hostT, getState: h.getState, dispatch: h.dispatch });

    clientT.send({ type: 'PICK', playerId: 'a1' }); // a1 is already team A's captain
    await flush();

    expect(h.current.match.draft.picks).toHaveLength(2); // unchanged
    session.dispose();
  });

  it('rejects a PLACE for a slot on the wrong team', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(draftedState());
    // n=2 -> A's turn; n=3 -> B's turn. So a2 goes to A, b2 goes to B,
    // leaving team B as [b1, b2].
    h.dispatch({ type: 'APPLY_PICK', playerId: 'a2' });
    h.dispatch({ type: 'APPLY_PICK', playerId: 'b2' });
    const session = createHostSession({ transport: hostT, getState: h.getState, dispatch: h.dispatch });

    clientT.send({ type: 'PLACE', slotId: 'A-DEF-0', playerId: 'b1' });
    await flush();

    expect(h.current.match.placements['A-DEF-0']).toBeUndefined();
    session.dispose();
  });

  it('applies a valid same-team PLACE', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(draftedState());
    h.dispatch({ type: 'APPLY_PICK', playerId: 'a2' });
    h.dispatch({ type: 'APPLY_PICK', playerId: 'b2' });
    const session = createHostSession({ transport: hostT, getState: h.getState, dispatch: h.dispatch });

    clientT.send({ type: 'PLACE', slotId: 'B-DEF-0', playerId: 'b1' });
    await flush();

    expect(h.current.match.placements['B-DEF-0']).toBe('b1');
    session.dispose();
  });

  it('a rejoin (second JOIN) resyncs the client to the identical current state', async () => {
    const [hostT, clientT] = createFakeTransportPair();
    const h = harness(draftedState());
    const session = createHostSession({ transport: hostT, getState: h.getState, dispatch: h.dispatch });

    const received: HostMessage[] = [];
    clientT.onMessage((m) => received.push(m as HostMessage));

    clientT.send({ type: 'JOIN' });
    await flush();
    // Host makes progress after the first join (e.g. a local pick by the host captain).
    h.dispatch({ type: 'APPLY_PICK', playerId: 'a2' });

    clientT.send({ type: 'JOIN' }); // simulates a reconnect
    await flush();

    const hellos = received.filter((m) => m.type === 'HELLO');
    expect(hellos).toHaveLength(2);
    const secondHello = hellos[1];
    if (secondHello.type === 'HELLO') {
      expect(secondHello.match).toEqual(h.current.match);
    }
    session.dispose();
  });
});
