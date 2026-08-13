import { describe, expect, it } from 'vitest';
import { applyPick, isComplete, nextTeam, remaining, teamShortName, undoPick } from '../src/lib/draft';
import type { DraftPick, DraftState } from '../src/types';

function picks(teams: ('A' | 'B')[]): DraftPick[] {
  return teams.map((team, i) => ({ playerId: `p${i}`, team }));
}

describe('draft order', () => {
  it('alternating order is a flat A B A B...', () => {
    const order: ('A' | 'B')[] = [];
    let p: DraftPick[] = [];
    for (let i = 0; i < 6; i++) {
      const team = nextTeam(p, 'alternating');
      order.push(team);
      p = [...p, { playerId: `p${i}`, team }];
    }
    expect(order).toEqual(['A', 'B', 'A', 'B', 'A', 'B']);
  });

  it('snake order mirrors each pair: A B B A A B B A...', () => {
    const order: ('A' | 'B')[] = [];
    let p: DraftPick[] = [];
    for (let i = 0; i < 8; i++) {
      const team = nextTeam(p, 'snake');
      order.push(team);
      p = [...p, { playerId: `p${i}`, team }];
    }
    expect(order).toEqual(['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A']);
  });

  it('snake and alternating agree on the first two picks (captain auto-assignment)', () => {
    expect(nextTeam([], 'snake')).toBe('A');
    expect(nextTeam([], 'alternating')).toBe('A');
    expect(nextTeam(picks(['A']), 'snake')).toBe('B');
    expect(nextTeam(picks(['A']), 'alternating')).toBe('B');
  });
});

describe('draft mutations', () => {
  it('applyPick assigns the current turn team and appends the pick', () => {
    const state: DraftState = { order: 'snake', picks: [] };
    const s1 = applyPick(state, 'alice');
    expect(s1.picks).toEqual([{ playerId: 'alice', team: 'A' }]);
    const s2 = applyPick(s1, 'bob');
    expect(s2.picks[1]).toEqual({ playerId: 'bob', team: 'B' });
  });

  it('applyPick is a no-op if the player was already picked', () => {
    const state: DraftState = { order: 'snake', picks: [{ playerId: 'alice', team: 'A' }] };
    const result = applyPick(state, 'alice');
    expect(result.picks).toHaveLength(1);
    expect(result).toBe(state);
  });

  it('undoPick removes the last pick and is idempotent on an empty draft', () => {
    const state: DraftState = {
      order: 'snake',
      picks: [
        { playerId: 'alice', team: 'A' },
        { playerId: 'bob', team: 'B' },
      ],
    };
    const s1 = undoPick(state);
    expect(s1.picks).toEqual([{ playerId: 'alice', team: 'A' }]);
    const s2 = undoPick(s1);
    expect(s2.picks).toEqual([]);
    const s3 = undoPick(s2);
    expect(s3).toBe(s2);
  });

  it('does not mutate the original state object', () => {
    const state: DraftState = { order: 'snake', picks: [] };
    const originalPicks = state.picks;
    applyPick(state, 'alice');
    expect(state.picks).toBe(originalPicks);
    expect(state.picks).toEqual([]);
  });
});

describe('remaining / isComplete', () => {
  it('remaining excludes already-picked players', () => {
    const attending = ['a', 'b', 'c'];
    const p = picks(['A', 'B']);
    // reuse ids a/b for picks
    const pickList: DraftPick[] = [
      { playerId: 'a', team: 'A' },
      { playerId: 'b', team: 'B' },
    ];
    expect(remaining(attending, pickList)).toEqual(['c']);
    expect(remaining(attending, p)).toEqual(attending); // p uses unrelated ids p0/p1
  });

  it('isComplete is true once every attending player has been picked', () => {
    const attending = ['a', 'b'];
    expect(isComplete(attending, [])).toBe(false);
    expect(isComplete(attending, [{ playerId: 'a', team: 'A' }])).toBe(false);
    expect(
      isComplete(attending, [
        { playerId: 'a', team: 'A' },
        { playerId: 'b', team: 'B' },
      ]),
    ).toBe(true);
  });

  it('isComplete is false for an empty attending list', () => {
    expect(isComplete([], [])).toBe(false);
  });
});

describe('teamShortName', () => {
  it("takes the captain's first name", () => {
    expect(teamShortName('Marcus Webb', 'A')).toBe('Marcus');
    expect(teamShortName('Sofia Reyes', 'B')).toBe('Sofia');
  });

  it('falls back to the raw team id when there is no captain name', () => {
    expect(teamShortName(undefined, 'A')).toBe('A');
    expect(teamShortName(undefined, 'B')).toBe('B');
  });

  it('handles a single-word name', () => {
    expect(teamShortName('Pelé', 'A')).toBe('Pelé');
  });
});
