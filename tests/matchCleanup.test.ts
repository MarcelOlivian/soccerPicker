import { describe, expect, it } from 'vitest';
import { pruneMatchToPlayers } from '../src/lib/matchCleanup';
import { emptyMatch } from '../src/types';
import type { MatchState, Player } from '../src/types';

function makePlayer(id: string): Player {
  return {
    id,
    name: id,
    position: 'MID',
    stats: { pace: 3, stamina: 3, finishing: 3, defending: 3, passing: 3, goalkeeping: 1 },
    createdAt: 0,
  };
}

function matchWith(overrides: Partial<MatchState>): MatchState {
  return { ...emptyMatch(), ...overrides };
}

describe('pruneMatchToPlayers', () => {
  it('drops attendingIds with no matching player', () => {
    const match = matchWith({ attendingIds: ['a1', 'ghost', 'a2'] });
    const pruned = pruneMatchToPlayers(match, [makePlayer('a1'), makePlayer('a2')]);
    expect(pruned.attendingIds).toEqual(['a1', 'a2']);
  });

  it('drops draft picks for a removed player', () => {
    const match = matchWith({
      draft: { order: 'snake', picks: [{ playerId: 'a1', team: 'A' }, { playerId: 'ghost', team: 'B' }] },
    });
    const pruned = pruneMatchToPlayers(match, [makePlayer('a1')]);
    expect(pruned.draft.picks).toEqual([{ playerId: 'a1', team: 'A' }]);
  });

  it('drops pitch placements referencing a removed player', () => {
    const match = matchWith({ placements: { 'A-DEF-0': 'a1', 'A-MID-0': 'ghost' } });
    const pruned = pruneMatchToPlayers(match, [makePlayer('a1')]);
    expect(pruned.placements).toEqual({ 'A-DEF-0': 'a1' });
  });

  it('clears a captain id that no longer has a matching player', () => {
    const match = matchWith({
      draft: { order: 'snake', picks: [], captainA: 'ghost', captainB: 'a2' },
    });
    const pruned = pruneMatchToPlayers(match, [makePlayer('a2')]);
    expect(pruned.draft.captainA).toBeUndefined();
    expect(pruned.draft.captainB).toBe('a2');
  });

  it('leaves an already-consistent match untouched', () => {
    const match = matchWith({ attendingIds: ['a1', 'a2'] });
    const players = [makePlayer('a1'), makePlayer('a2')];
    const pruned = pruneMatchToPlayers(match, players);
    expect(pruned.attendingIds).toEqual(['a1', 'a2']);
  });
});
