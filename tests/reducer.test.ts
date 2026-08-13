import { describe, expect, it } from 'vitest';
import { reduce, teamOf } from '../src/state/reducer';
import { defaultState } from '../src/lib/storage';
import type { AppState, MatchHistoryEntry, Player } from '../src/types';

function makePlayer(id: string): Player {
  return {
    id,
    name: id,
    position: 'MID',
    stats: { pace: 3, stamina: 3, finishing: 3, defending: 3, passing: 3, goalkeeping: 1 },
    createdAt: 0,
  };
}

function stateWithDraftedTeams(): AppState {
  let state = defaultState();
  state = {
    ...state,
    players: [makePlayer('a1'), makePlayer('a2'), makePlayer('b1'), makePlayer('b2')],
  };
  state = reduce(state, { type: 'SET_ATTENDING', ids: ['a1', 'a2', 'b1', 'b2'] });
  state = reduce(state, { type: 'SET_DRAFT_ORDER', order: 'alternating' });
  // SET_CAPTAINS auto-assigns captainA -> team A's first pick, captainB -> team B's first pick.
  // With alternating order the remaining picks go A, B, A, B... so a2 lands on A and b2 on B.
  state = reduce(state, { type: 'SET_CAPTAINS', captainA: 'a1', captainB: 'b1' });
  state = reduce(state, { type: 'APPLY_PICK', playerId: 'a2' });
  state = reduce(state, { type: 'APPLY_PICK', playerId: 'b2' });
  return state;
}

describe('reducer: captain auto-assignment', () => {
  it('SET_CAPTAINS immediately records both captains as the first two picks', () => {
    let state = defaultState();
    state = { ...state, players: [makePlayer('a1'), makePlayer('b1')] };
    state = reduce(state, { type: 'SET_CAPTAINS', captainA: 'a1', captainB: 'b1' });
    expect(teamOf(state, 'a1')).toBe('A');
    expect(teamOf(state, 'b1')).toBe('B');
    expect(state.match.draft.picks).toHaveLength(2);
  });
});

describe('reducer: placement team guard', () => {
  it('SET_PLACEMENT rejects putting a Team B player into a Team A slot', () => {
    const state = stateWithDraftedTeams();
    expect(teamOf(state, 'b1')).toBe('B');
    const next = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-0', playerId: 'b1' });
    expect(next).toBe(state); // unchanged
    expect(next.match.placements['A-DEF-0']).toBeUndefined();
  });

  it('SET_PLACEMENT accepts a player into a slot on their own team', () => {
    const state = stateWithDraftedTeams();
    const team = teamOf(state, 'a1');
    expect(team).toBe('A');
    const next = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-0', playerId: 'a1' });
    expect(next.match.placements['A-DEF-0']).toBe('a1');
  });

  it('SET_PLACEMENT with playerId null (unassign) is always allowed', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-0', playerId: 'a1' });
    const next = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-0', playerId: null });
    expect(next.match.placements['A-DEF-0']).toBeUndefined();
  });

  it('SWAP_PLACEMENTS rejects a cross-team swap', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-0', playerId: 'a1' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'B-DEF-0', playerId: 'b1' });
    const next = reduce(state, { type: 'SWAP_PLACEMENTS', slotA: 'A-DEF-0', slotB: 'B-DEF-0' });
    expect(next).toBe(state);
    expect(next.match.placements['A-DEF-0']).toBe('a1');
    expect(next.match.placements['B-DEF-0']).toBe('b1');
  });

  it('SWAP_PLACEMENTS accepts swapping two same-team slots', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-0', playerId: 'a1' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-MID-0', playerId: 'a2' });
    const next = reduce(state, { type: 'SWAP_PLACEMENTS', slotA: 'A-DEF-0', slotB: 'A-MID-0' });
    expect(next.match.placements['A-DEF-0']).toBe('a2');
    expect(next.match.placements['A-MID-0']).toBe('a1');
  });
});

function makeHistoryEntry(id: string): MatchHistoryEntry {
  return {
    id,
    date: 1700000000000,
    formation: '6',
    teamAName: 'Marcus',
    teamBName: 'Sofia',
    teamAPlayers: [],
    teamBPlayers: [],
    strengthA: 100,
    strengthB: 95,
  };
}

describe('reducer: match history actions', () => {
  it('SAVE_MATCH_TO_HISTORY prepends the new entry (newest first)', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h1') });
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h2') });
    expect(state.history.map((h) => h.id)).toEqual(['h2', 'h1']);
  });

  it('DELETE_HISTORY_ENTRY removes only the matching entry', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h1') });
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h2') });
    state = reduce(state, { type: 'DELETE_HISTORY_ENTRY', id: 'h1' });
    expect(state.history.map((h) => h.id)).toEqual(['h2']);
  });

  it('SET_HISTORY_SCORE updates only the matching entry', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h1') });
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h2') });
    state = reduce(state, { type: 'SET_HISTORY_SCORE', id: 'h1', scoreA: 3, scoreB: 2 });
    const h1 = state.history.find((h) => h.id === 'h1');
    const h2 = state.history.find((h) => h.id === 'h2');
    expect(h1?.scoreA).toBe(3);
    expect(h1?.scoreB).toBe(2);
    expect(h2?.scoreA).toBeUndefined();
    expect(h2?.scoreB).toBeUndefined();
  });
});

describe('reducer: DELETE_PLAYER cleans up match state', () => {
  it('removes the player from attendance, draft picks, captains, and placements', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-0', playerId: 'a1' });
    state = reduce(state, { type: 'DELETE_PLAYER', id: 'a1' });
    expect(state.match.attendingIds).not.toContain('a1');
    expect(state.match.draft.picks.some((p) => p.playerId === 'a1')).toBe(false);
    expect(state.match.draft.captainA).toBeUndefined();
    expect(state.match.placements['A-DEF-0']).toBeUndefined();
  });
});
