import { beforeEach, describe, expect, it } from 'vitest';
import { defaultState, store, StorageQuotaError } from '../src/lib/storage';
import type { AppState, Player } from '../src/types';

function makePlayer(id: string): Player {
  return {
    id,
    name: `Player ${id}`,
    position: 'MID',
    stats: { pace: 3, stamina: 3, finishing: 3, defending: 3, passing: 3, goalkeeping: 1 },
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

  it('save() then load() round-trips players and match state exactly', () => {
    const state: AppState = {
      schemaVersion: 1,
      players: [makePlayer('p1'), makePlayer('p2')],
      match: {
        formation: '6',
        attendingIds: ['p1', 'p2'],
        draft: { order: 'snake', picks: [{ playerId: 'p1', team: 'A' }] },
        placements: { 'A-ATT-1': 'p1' },
      },
    };
    store.save(state);
    const loaded = store.load();
    expect(loaded).toEqual(state);
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
      JSON.stringify({ schemaVersion: 1, players: 'nope', match: {} }),
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
