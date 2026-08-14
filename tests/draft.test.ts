import { describe, expect, it } from 'vitest';
import {
  applyPick,
  autoDraftRemaining,
  formatTeamsList,
  isComplete,
  nextTeam,
  remaining,
  suggestBalanceSwap,
  teamShortName,
  undoPick,
} from '../src/lib/draft';
import { preferredOverall } from '../src/lib/rating';
import type { DraftPick, DraftState, Player, StatValue } from '../src/types';

function picks(teams: ('A' | 'B')[]): DraftPick[] {
  return teams.map((team, i) => ({ playerId: `p${i}`, team }));
}

function makePlayer(id: string, name: string, nickname?: string): Player {
  return {
    id,
    name,
    nickname,
    position: 'MID',
    stats: { pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3 },
    createdAt: 0,
  };
}

/** A player whose overall is the same regardless of position — every stat set to `level`, so the weighted mean (weights always sum to 1) equals `level` everywhere. */
function makeLeveledPlayer(id: string, level: StatValue): Player {
  return {
    id,
    name: id,
    position: 'MID',
    stats: { pace: level, shooting: level, passing: level, dribbling: level, defending: level, physicality: level },
    createdAt: 0,
  };
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

describe('formatTeamsList', () => {
  it('groups players by team, marks the captain, and includes nicknames', () => {
    const alice = makePlayer('a', 'Alice Wong', 'Ace');
    const bob = makePlayer('b', 'Bob Marsh');
    const carla = makePlayer('c', 'Carla Diaz', 'Spike');

    const text = formatTeamsList('Alice', [alice, bob], 'a', 'Carla', [carla], 'c');

    expect(text).toBe(
      [
        'Team Alice',
        '- Alice Wong (Ace) (captain)',
        '- Bob Marsh',
        '',
        'Team Carla',
        '- Carla Diaz (Spike) (captain)',
      ].join('\n'),
    );
  });

  it('handles an empty team', () => {
    const text = formatTeamsList('Alice', [], undefined, 'Carla', [], undefined);
    expect(text).toBe('Team Alice\n\n\nTeam Carla\n');
  });
});

describe('autoDraftRemaining', () => {
  it('always takes the strongest remaining player for whichever team is due next', () => {
    const strong = makeLeveledPlayer('strong', 5); // overall 95
    const mid = makeLeveledPlayer('mid', 3); // overall 70
    const weak = makeLeveledPlayer('weak', 1); // overall 45

    // Order in the input shouldn't matter — the function always picks by strength, not array position.
    const newPicks = autoDraftRemaining([weak, strong, mid], [], 'snake');

    // n=0 (cycle 0) -> A, n=1 (cycle 1) -> B, n=2 (cycle 2) -> B (snake: A B B A...).
    expect(newPicks).toEqual([
      { playerId: 'strong', team: 'A' },
      { playerId: 'mid', team: 'B' },
      { playerId: 'weak', team: 'B' },
    ]);
  });

  it('continues the turn order from the existing picks, not from scratch', () => {
    // Two picks already made (e.g. the captains) — snake order's 3rd pick (n=2) is B.
    const existing: DraftPick[] = [
      { playerId: 'captainA', team: 'A' },
      { playerId: 'captainB', team: 'B' },
    ];
    const a1 = makeLeveledPlayer('a1', 4);
    const newPicks = autoDraftRemaining([a1], existing, 'snake');
    expect(newPicks).toEqual([{ playerId: 'a1', team: 'B' }]);
  });

  it('returns an empty list when there is nobody left to draft', () => {
    expect(autoDraftRemaining([], [], 'snake')).toEqual([]);
  });
});

describe('suggestBalanceSwap', () => {
  it('finds the single non-captain swap that most reduces the balance gap', () => {
    const captainA = makeLeveledPlayer('ca', 3); // 70
    const a1 = makeLeveledPlayer('a1', 1); // 45
    const captainB = makeLeveledPlayer('cb', 3); // 70
    const b1 = makeLeveledPlayer('b1', 4); // 83
    const b2 = makeLeveledPlayer('b2', 2); // 58

    // A: 70+45=115, B: 70+83+58=211, diff=96.
    const suggestion = suggestBalanceSwap([captainA, a1], 'ca', [captainB, b1, b2], 'cb');

    expect(suggestion).not.toBeNull();
    expect(suggestion!.playerIdA).toBe('a1');
    expect(suggestion!.playerIdB).toBe('b1');
    expect(suggestion!.currentDiff).toBe(96);
    // A: 115-45+83=153, B: 211-83+45=173, diff=20 — better than the other
    // candidate pair (a1/b2), which only gets to 70.
    expect(suggestion!.newDiff).toBe(20);
  });

  it('never offers a captain as a swap candidate, even when only captains exist', () => {
    const captainA = makeLeveledPlayer('ca', 5); // 95
    const captainB = makeLeveledPlayer('cb', 1); // 45
    // If captains weren't excluded, swapping them would perfectly balance
    // (diff 50 -> 0) — with no other players to consider, the function must
    // return null rather than suggest that.
    expect(suggestBalanceSwap([captainA], 'ca', [captainB], 'cb')).toBeNull();
  });

  it('returns null when no swap improves on the current balance', () => {
    const captainA = makeLeveledPlayer('ca', 3);
    const a1 = makeLeveledPlayer('a1', 3);
    const captainB = makeLeveledPlayer('cb', 3);
    const b1 = makeLeveledPlayer('b1', 3);
    expect(suggestBalanceSwap([captainA, a1], 'ca', [captainB, b1], 'cb')).toBeNull();
  });
});

describe('makeLeveledPlayer sanity check', () => {
  it('produces the expected overall regardless of position weighting', () => {
    expect(preferredOverall(makeLeveledPlayer('x', 5))).toBe(95);
    expect(preferredOverall(makeLeveledPlayer('x', 3))).toBe(70);
    expect(preferredOverall(makeLeveledPlayer('x', 1))).toBe(45);
  });
});
