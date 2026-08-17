import { beforeEach, describe, expect, it } from 'vitest';
import { defaultState, store, StorageQuotaError } from '../src/lib/storage';
import type { AppState, Player } from '../src/types';

function makePlayer(id: string): Player {
  return {
    id,
    name: `Player ${id}`,
    position: 'MID',
    stats: { pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3 },
    createdAt: Date.now(),
  };
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('load() returns a fresh default state when nothing is persisted', () => {
    const state = store.load();
    expect(state).toEqual(defaultState());
  });

  it('save() then load() round-trips players, match state, and history exactly', () => {
    const state: AppState = {
      schemaVersion: 3,
      players: [makePlayer('p1'), makePlayer('p2')],
      match: {
        formation: '6',
        attendingIds: ['p1', 'p2'],
        draft: { order: 'snake', picks: [{ playerId: 'p1', team: 'A' }] },
        placements: { 'A-ATT-1': 'p1' },
        boardMode: 'setup',
        clock: { startedAt: null, pausedAt: null, pausedMs: 0 },
        events: [],
        trackingStarted: false,
      },
      history: [
        {
          id: 'h1',
          date: 1700000000000,
          formation: '6',
          teamAName: 'Marcus',
          teamBName: 'Sofia',
          teamAPlayers: [],
          teamBPlayers: [],
          strengthA: 100,
          strengthB: 95,
        },
      ],
    };
    store.save(state);
    const loaded = store.load();
    expect(loaded).toEqual(state);
  });

  it('load() discards a pre-v3 payload rather than migrating it (no cross-stat-shape migration)', () => {
    // schemaVersion 2 predates the FIFA-style stat rename — there's no
    // sensible field-by-field mapping once goalkeeping disappears as a
    // stat, so it's simply treated as incompatible rather than half-
    // migrated into a roster with undefined stat bars.
    localStorage.setItem(
      'soccerpicker.v1',
      JSON.stringify({
        schemaVersion: 2,
        players: [
          {
            id: 'p1',
            name: 'Old Shape Player',
            position: 'MID',
            stats: { pace: 3, stamina: 3, finishing: 3, defending: 3, passing: 3, goalkeeping: 1 },
            createdAt: 0,
          },
        ],
        match: {
          formation: '6',
          attendingIds: ['p1'],
          draft: { order: 'snake', picks: [] },
          placements: {},
        },
        history: [],
      }),
    );
    const loaded = store.load();
    expect(loaded).toEqual(defaultState());
  });

  it('load() heals stale attendingIds referencing a player that no longer exists', () => {
    localStorage.setItem(
      'soccerpicker.v1',
      JSON.stringify({
        schemaVersion: 3,
        players: [makePlayer('p1'), makePlayer('p2')],
        match: {
          formation: '6',
          // p1/p2 are real; the rest are leftovers from a since-replaced
          // roster (e.g. an older build's import path, before match state
          // was pruned on a roster replace).
          attendingIds: ['p1', 'p2', 'ghost1', 'ghost2', 'ghost3'],
          draft: { order: 'snake', picks: [] },
          placements: {},
        },
        history: [],
      }),
    );
    const loaded = store.load();
    expect(loaded.match.attendingIds).toEqual(['p1', 'p2']);
  });

  it('load() falls back to default state on corrupt JSON', () => {
    localStorage.setItem('soccerpicker.v1', '{not valid json');
    expect(store.load()).toEqual(defaultState());
  });

  it('load() falls back to default state on a mismatched schema version', () => {
    localStorage.setItem('soccerpicker.v1', JSON.stringify({ schemaVersion: 99, players: [] }));
    expect(store.load()).toEqual(defaultState());
  });

  it('load() falls back to default state when players is missing/malformed', () => {
    localStorage.setItem(
      'soccerpicker.v1',
      JSON.stringify({ schemaVersion: 3, players: 'nope', match: {} }),
    );
    expect(store.load()).toEqual(defaultState());
  });

  it('save() throws StorageQuotaError when the underlying store is full', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      const err = new DOMException('quota', 'QuotaExceededError');
      throw err;
    };
    try {
      expect(() => store.save(defaultState())).toThrow(StorageQuotaError);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
