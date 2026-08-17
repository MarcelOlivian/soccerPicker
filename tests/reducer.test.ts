import { afterEach, describe, expect, it, vi } from 'vitest';
import { reduce, teamOf } from '../src/state/reducer';
import { defaultState } from '../src/lib/storage';
import type { AppState, MatchEvent, MatchHistoryEntry, Player } from '../src/types';

function makePlayer(id: string): Player {
  return {
    id,
    name: id,
    position: 'MID',
    stats: { pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3 },
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

describe('reducer: SWAP_PLACEMENTS position-change event logging', () => {
  // Default formation '6' real slot ids: A-GK-0, A-DEF-1, A-DEF-2, A-MID-3, A-MID-4, A-ATT-5.
  it('produces no events for a cross-position swap before trackingStarted', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-GK-0', playerId: 'a1' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-1', playerId: 'a2' });
    const next = reduce(state, { type: 'SWAP_PLACEMENTS', slotA: 'A-GK-0', slotB: 'A-DEF-1' });
    expect(next.match.trackingStarted).toBe(false);
    expect(next.match.events).toEqual([]);
  });

  it('produces no events for a same-position swap even after trackingStarted', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-1', playerId: 'a1' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-2', playerId: 'a2' });
    const next = reduce(state, { type: 'SWAP_PLACEMENTS', slotA: 'A-DEF-1', slotB: 'A-DEF-2' });
    expect(next.match.events).toEqual([]);
  });

  it('appends two mirrored POSITION_CHANGE events for a cross-position swap after trackingStarted', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-GK-0', playerId: 'a1' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-DEF-1', playerId: 'a2' });
    const next = reduce(state, { type: 'SWAP_PLACEMENTS', slotA: 'A-GK-0', slotB: 'A-DEF-1' });
    expect(next.match.events).toHaveLength(2);
    expect(next.match.events).toEqual([
      expect.objectContaining({ type: 'POSITION_CHANGE', playerId: 'a1', fromPosition: 'GK', toPosition: 'DEF' }),
      expect.objectContaining({ type: 'POSITION_CHANGE', playerId: 'a2', fromPosition: 'DEF', toPosition: 'GK' }),
    ]);
  });

  it('produces no events when one of the swapped slots is empty, even after trackingStarted', () => {
    let state = stateWithDraftedTeams();
    state = reduce(state, { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'SET_PLACEMENT', slotId: 'A-GK-0', playerId: 'a1' });
    const next = reduce(state, { type: 'SWAP_PLACEMENTS', slotA: 'A-GK-0', slotB: 'A-DEF-1' });
    expect(next.match.events).toEqual([]);
  });
});

function makeHistoryEntry(id: string, date = 1700000000000): MatchHistoryEntry {
  return {
    id,
    date,
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

describe('reducer: MERGE_HISTORY', () => {
  it('merge dedupes by id — importing the same entry twice does not duplicate', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h1', 1000) });
    state = reduce(state, { type: 'MERGE_HISTORY', entries: [makeHistoryEntry('h1', 1000)], mode: 'merge' });
    expect(state.history.map((h) => h.id)).toEqual(['h1']);
  });

  it('merge preserves existing entries not present in the imported set', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h1', 1000) });
    state = reduce(state, { type: 'MERGE_HISTORY', entries: [makeHistoryEntry('h2', 2000)], mode: 'merge' });
    expect(state.history.map((h) => h.id).sort()).toEqual(['h1', 'h2']);
  });

  it('replace wholesale-replaces existing history', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('h1', 1000) });
    state = reduce(state, { type: 'MERGE_HISTORY', entries: [makeHistoryEntry('h2', 2000)], mode: 'replace' });
    expect(state.history.map((h) => h.id)).toEqual(['h2']);
  });

  it('merge keeps the result sorted newest-first by date', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SAVE_MATCH_TO_HISTORY', entry: makeHistoryEntry('old', 1000) });
    state = reduce(state, {
      type: 'MERGE_HISTORY',
      entries: [makeHistoryEntry('newest', 3000), makeHistoryEntry('middle', 2000)],
      mode: 'merge',
    });
    expect(state.history.map((h) => h.id)).toEqual(['newest', 'middle', 'old']);
  });

  it('replace with entries passed in non-newest-first order still comes back sorted', () => {
    let state = defaultState();
    state = reduce(state, {
      type: 'MERGE_HISTORY',
      entries: [makeHistoryEntry('old', 1000), makeHistoryEntry('newest', 3000), makeHistoryEntry('middle', 2000)],
      mode: 'replace',
    });
    expect(state.history.map((h) => h.id)).toEqual(['newest', 'middle', 'old']);
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

describe('reducer: MERGE_PLAYERS prunes match state to the surviving roster', () => {
  it('replace mode drops stale attendance/picks for players not in the new roster', () => {
    const state = stateWithDraftedTeams();
    expect(state.match.attendingIds).toEqual(['a1', 'a2', 'b1', 'b2']);
    const next = reduce(state, {
      type: 'MERGE_PLAYERS',
      mode: 'replace',
      players: [makePlayer('a1'), makePlayer('a2')],
    });
    expect(next.match.attendingIds).toEqual(['a1', 'a2']);
    expect(next.match.draft.picks.every((p) => p.playerId === 'a1' || p.playerId === 'a2')).toBe(true);
    expect(next.match.draft.captainB).toBeUndefined(); // b1 was captainB
  });

  it('merge mode prunes when an incoming player reuses a name but not the old id', () => {
    const state = stateWithDraftedTeams();
    // "a1" the name stays, but the imported record carries a fresh id —
    // the old id becomes orphaned in match state exactly like a replace.
    const reimportedA1 = { ...makePlayer('a1-new-id'), name: 'a1' };
    const next = reduce(state, { type: 'MERGE_PLAYERS', mode: 'merge', players: [reimportedA1] });
    expect(next.match.attendingIds).not.toContain('a1');
    expect(next.match.draft.captainA).toBeUndefined();
  });
});

function goalEvent(playerId: string): MatchEvent {
  return { id: `${playerId}-goal`, atMs: 0, type: 'GOAL', playerId, team: 'A', isOwnGoal: false };
}

function positionChangeEvent(playerId: string): MatchEvent {
  return { id: `${playerId}-poschange-${Math.random()}`, atMs: 0, type: 'POSITION_CHANGE', playerId, fromPosition: 'DEF', toPosition: 'GK' };
}

describe('reducer: match-tracking clock actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SET_BOARD_MODE sets the mode', () => {
    let state = defaultState();
    state = reduce(state, { type: 'SET_BOARD_MODE', mode: 'tracking' });
    expect(state.match.boardMode).toBe('tracking');
  });

  it('SET_BOARD_MODE sets trackingStarted sticky-true once tracking is entered, and it stays true after toggling back', () => {
    let state = defaultState();
    expect(state.match.trackingStarted).toBe(false);
    state = reduce(state, { type: 'SET_BOARD_MODE', mode: 'tracking' });
    expect(state.match.trackingStarted).toBe(true);
    state = reduce(state, { type: 'SET_BOARD_MODE', mode: 'setup' });
    expect(state.match.boardMode).toBe('setup');
    expect(state.match.trackingStarted).toBe(true);
  });

  it('START_CLOCK from never-started sets startedAt and clears pausedMs', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const state = reduce(defaultState(), { type: 'START_CLOCK' });
    expect(state.match.clock).toEqual({ startedAt: 1000, pausedAt: null, pausedMs: 0 });
  });

  it('START_CLOCK from paused accumulates pausedMs and resumes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    let state = reduce(defaultState(), { type: 'START_CLOCK' });
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    state = reduce(state, { type: 'PAUSE_CLOCK' });
    expect(state.match.clock).toEqual({ startedAt: 1000, pausedAt: 2000, pausedMs: 0 });
    vi.spyOn(Date, 'now').mockReturnValue(5000);
    state = reduce(state, { type: 'START_CLOCK' });
    expect(state.match.clock).toEqual({ startedAt: 1000, pausedAt: null, pausedMs: 3000 });
  });

  it('START_CLOCK while already running is a no-op', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const running = reduce(defaultState(), { type: 'START_CLOCK' });
    vi.spyOn(Date, 'now').mockReturnValue(9999);
    const again = reduce(running, { type: 'START_CLOCK' });
    expect(again).toBe(running);
  });

  it('PAUSE_CLOCK while never-started is a no-op', () => {
    const state = defaultState();
    expect(reduce(state, { type: 'PAUSE_CLOCK' })).toBe(state);
  });

  it('PAUSE_CLOCK while already paused is a no-op', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    let state = reduce(defaultState(), { type: 'START_CLOCK' });
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    state = reduce(state, { type: 'PAUSE_CLOCK' });
    const again = reduce(state, { type: 'PAUSE_CLOCK' });
    expect(again).toBe(state);
  });

  it('RESET_CLOCK resets to a fresh clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    let state = reduce(defaultState(), { type: 'START_CLOCK' });
    state = reduce(state, { type: 'RESET_CLOCK' });
    expect(state.match.clock).toEqual({ startedAt: null, pausedAt: null, pausedMs: 0 });
  });
});

describe('reducer: match-tracking event actions', () => {
  it('RECORD_EVENT appends while tracking', () => {
    let state = reduce(defaultState(), { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p1') });
    expect(state.match.events).toHaveLength(1);
    expect(state.match.events[0]).toMatchObject({ type: 'GOAL', playerId: 'p1' });
  });

  it('RECORD_EVENT is a no-op outside tracking mode', () => {
    const state = defaultState(); // boardMode: 'setup'
    const next = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p1') });
    expect(next).toBe(state);
  });

  it('UNDO_LAST_EVENT removes only the most recent event', () => {
    let state = reduce(defaultState(), { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p1') });
    state = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p2') });
    state = reduce(state, { type: 'UNDO_LAST_EVENT' });
    expect(state.match.events.map((e) => ('playerId' in e ? e.playerId : undefined))).toEqual(['p1']);
  });

  it('UNDO_LAST_EVENT on an empty event log is a no-op', () => {
    const state = reduce(defaultState(), { type: 'SET_BOARD_MODE', mode: 'tracking' });
    expect(reduce(state, { type: 'UNDO_LAST_EVENT' })).toBe(state);
  });

  it('UNDO_LAST_EVENT skips trailing POSITION_CHANGE entries and removes the real event underneath', () => {
    let state = reduce(defaultState(), { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p1') });
    state = reduce(state, { type: 'RECORD_EVENT', event: positionChangeEvent('p2') });
    state = reduce(state, { type: 'RECORD_EVENT', event: positionChangeEvent('p3') });
    const next = reduce(state, { type: 'UNDO_LAST_EVENT' });
    expect(next.match.events.map((e) => e.type)).toEqual(['POSITION_CHANGE', 'POSITION_CHANGE']);
  });

  it('UNDO_LAST_EVENT is a no-op when the log is only POSITION_CHANGE entries', () => {
    let state = reduce(defaultState(), { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'RECORD_EVENT', event: positionChangeEvent('p1') });
    expect(reduce(state, { type: 'UNDO_LAST_EVENT' })).toBe(state);
  });

  it('two sequential undos walk back past a swap pair to the next real event underneath', () => {
    let state = reduce(defaultState(), { type: 'SET_BOARD_MODE', mode: 'tracking' });
    state = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p1') });
    state = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p2') });
    state = reduce(state, { type: 'RECORD_EVENT', event: positionChangeEvent('p3') });
    state = reduce(state, { type: 'UNDO_LAST_EVENT' });
    expect(state.match.events.map((e) => e.type)).toEqual(['GOAL', 'POSITION_CHANGE']);
    state = reduce(state, { type: 'UNDO_LAST_EVENT' });
    expect(state.match.events.map((e) => e.type)).toEqual(['POSITION_CHANGE']);
  });

  it('FINISH_MATCH freezes a running clock and locks the board', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    let state = reduce(defaultState(), { type: 'START_CLOCK' });
    state = reduce(state, { type: 'SET_BOARD_MODE', mode: 'tracking' });
    vi.spyOn(Date, 'now').mockReturnValue(4000);
    state = reduce(state, { type: 'FINISH_MATCH' });
    expect(state.match.boardMode).toBe('finished');
    expect(state.match.clock).toEqual({ startedAt: 1000, pausedAt: 4000, pausedMs: 0 });
    // Further events are rejected once finished.
    const next = reduce(state, { type: 'RECORD_EVENT', event: goalEvent('p1') });
    expect(next).toBe(state);
    vi.restoreAllMocks();
  });

  it('FINISH_MATCH leaves an already-paused clock untouched', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    let state = reduce(defaultState(), { type: 'START_CLOCK' });
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    state = reduce(state, { type: 'PAUSE_CLOCK' });
    const pausedClock = state.match.clock;
    vi.spyOn(Date, 'now').mockReturnValue(9999);
    state = reduce(state, { type: 'FINISH_MATCH' });
    expect(state.match.clock).toEqual(pausedClock);
    expect(state.match.boardMode).toBe('finished');
    vi.restoreAllMocks();
  });
});
