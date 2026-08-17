import { describe, expect, it } from 'vitest';
import { suggestStatChange } from '../src/lib/statSuggestion';
import type { HistoryPlayerSnapshot, MatchHistoryEntry, Player, PlayerStats, Position, StatHistoryEntry } from '../src/types';

function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return { pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3, ...overrides };
}

function makePlayer(id: string, stats: PlayerStats): Player {
  return { id, name: id, position: 'MID', stats, createdAt: 0 };
}

function makeSnapshot(id: string, position: Position, overrides: Partial<HistoryPlayerSnapshot> = {}): HistoryPlayerSnapshot {
  return { id, name: id, position, overall: 70, isCaptain: false, ...overrides };
}

/** n matches, each with the player at `position` on team A, tallies as given, optionally a fixed A/B score. */
function makeMatches(
  playerId: string,
  n: number,
  position: Position,
  snapshotOverrides: Partial<HistoryPlayerSnapshot>,
  score?: { scoreA: number; scoreB: number },
): MatchHistoryEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    date: i,
    formation: '6' as const,
    teamAName: 'Marcus',
    teamBName: 'Sofia',
    teamAPlayers: [makeSnapshot(playerId, position, snapshotOverrides)],
    teamBPlayers: [],
    strengthA: 100,
    strengthB: 95,
    ...score,
  }));
}

describe('suggestStatChange — ATT/shooting', () => {
  it('suggests an upgrade when avg goals/match is at or above the 1.5 threshold, with >=3 games', () => {
    const player = makePlayer('p1', makeStats({ shooting: 3 }));
    // 3 games, goals [2,1,3] -> avg 2.0, comfortably >= 1.5.
    const history = [
      { ...makeMatches('p1', 1, 'ATT', { goals: 2 })[0], id: 'e0' },
      { ...makeMatches('p1', 1, 'ATT', { goals: 1 })[0], id: 'e1' },
      { ...makeMatches('p1', 1, 'ATT', { goals: 3 })[0], id: 'e2' },
    ];
    const suggestion = suggestStatChange(player, history);
    expect(suggestion).toMatchObject({ statKey: 'shooting', direction: 'up', newValue: 4, positionEvidence: 'ATT' });
  });

  it('does not suggest below the 1.5 avg-goals threshold', () => {
    const player = makePlayer('p1', makeStats({ shooting: 3 }));
    const history = [
      { ...makeMatches('p1', 1, 'ATT', { goals: 1 })[0] },
      { ...makeMatches('p1', 1, 'ATT', { goals: 1 })[0], id: 'e1' },
      { ...makeMatches('p1', 1, 'ATT', { goals: 1 })[0], id: 'e2' },
    ];
    expect(suggestStatChange(player, history)).toBeNull();
  });

  it('does not suggest an upgrade when shooting is already 5', () => {
    const player = makePlayer('p1', makeStats({ shooting: 5 }));
    const history = makeMatches('p1', 5, 'ATT', { goals: 3 });
    expect(suggestStatChange(player, history)).toBeNull();
  });

  it('suggests a downgrade when shooting >=3 but avg goals < 0.4', () => {
    const player = makePlayer('p1', makeStats({ shooting: 4 }));
    const history = makeMatches('p1', 5, 'ATT', { goals: 0 });
    const suggestion = suggestStatChange(player, history);
    expect(suggestion).toMatchObject({ statKey: 'shooting', direction: 'down', newValue: 3 });
  });

  it('does not suggest a downgrade when shooting is below 3', () => {
    const player = makePlayer('p1', makeStats({ shooting: 2 }));
    const history = makeMatches('p1', 5, 'ATT', { goals: 0 });
    expect(suggestStatChange(player, history)).toBeNull();
  });

  it('requires at least MIN_SAMPLE (3) qualifying appearances', () => {
    const player = makePlayer('p1', makeStats({ shooting: 3 }));
    const history = makeMatches('p1', 2, 'ATT', { goals: 5 }); // huge signal, but only 2 games
    expect(suggestStatChange(player, history)).toBeNull();
  });

  it('only looks at the last WINDOW (5) appearances at a position', () => {
    const player = makePlayer('p1', makeStats({ shooting: 3 }));
    // 5 recent games averaging 1.0 goal (neutral — below the 1.5 up-threshold
    // and above the 0.4 down-threshold, so no suggestion on their own),
    // followed by 5 older 5-goal games that — if incorrectly included —
    // would push the average to 3.0 and wrongly trigger an upgrade.
    const recentNeutral = makeMatches('p1', 5, 'ATT', { goals: 1 });
    const olderHigh = Array.from({ length: 5 }, (_, i) => ({
      ...makeMatches('p1', 1, 'ATT', { goals: 5 })[0],
      id: `old${i}`,
      date: 100 + i,
    }));
    expect(suggestStatChange(player, [...recentNeutral, ...olderHigh])).toBeNull();
  });
});

describe('suggestStatChange — MID/passing', () => {
  it('suggests an upgrade at avg assists >= 1.0 with >=3 games', () => {
    const player = makePlayer('p1', makeStats({ passing: 3 }));
    const history = makeMatches('p1', 3, 'MID', { assists: 1 });
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'passing', direction: 'up', newValue: 4 });
  });

  it('suggests a downgrade when passing >=3 and avg assists < 0.3', () => {
    const player = makePlayer('p1', makeStats({ passing: 4 }));
    const history = makeMatches('p1', 5, 'MID', { assists: 0 });
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'passing', direction: 'down', newValue: 3 });
  });
});

describe('suggestStatChange — DEF/defending', () => {
  it('suggests an upgrade with low fouls AND a high win rate', () => {
    const player = makePlayer('p1', makeStats({ defending: 3 }));
    const history = makeMatches('p1', 5, 'DEF', { fouls: 0 }, { scoreA: 2, scoreB: 0 });
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'defending', direction: 'up', newValue: 4 });
  });

  it('does not suggest an upgrade with low fouls but a poor win rate', () => {
    const player = makePlayer('p1', makeStats({ defending: 3 }));
    const history = makeMatches('p1', 5, 'DEF', { fouls: 0 }, { scoreA: 0, scoreB: 2 }); // all losses
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'defending', direction: 'down' });
    // fouls=0 doesn't satisfy the down-trigger's foul branch, but win-rate 0% <=35% does.
  });

  it('null win-rate (no decided matches) blocks both up and down win-rate branches', () => {
    const player = makePlayer('p1', makeStats({ defending: 3 }));
    // No score entered anywhere, low fouls: up needs winRate>=0.6 -> blocked. Down needs fouls>=1.0 OR winRate<=0.35 -> fouls=0 doesn't qualify, winRate is null so that branch is skipped too.
    const history = makeMatches('p1', 5, 'DEF', { fouls: 0 });
    expect(suggestStatChange(player, history)).toBeNull();
  });

  it('suggests a downgrade purely from high fouls, independent of win rate', () => {
    const player = makePlayer('p1', makeStats({ defending: 3 }));
    const history = makeMatches('p1', 5, 'DEF', { fouls: 2 }, { scoreA: 2, scoreB: 0 }); // winning but fouling a lot
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'defending', direction: 'down' });
  });
});

describe('suggestStatChange — GK/defending', () => {
  it('suggests an upgrade with high saves and low concedes', () => {
    const player = makePlayer('p1', makeStats({ defending: 3 }));
    const history = makeMatches('p1', 5, 'GK', { saves: 3, concedes: 0 });
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'defending', direction: 'up', newValue: 4 });
  });

  it('suggests a downgrade with high concedes and low saves', () => {
    const player = makePlayer('p1', makeStats({ defending: 3 }));
    const history = makeMatches('p1', 5, 'GK', { saves: 0, concedes: 3 });
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'defending', direction: 'down' });
  });
});

describe('suggestStatChange — ranking across positions', () => {
  it('picks the candidate with the larger sample size', () => {
    const player = makePlayer('p1', makeStats({ shooting: 3, passing: 3 }));
    const attGames = makeMatches('p1', 3, 'ATT', { goals: 2 });
    const midGames = makeMatches('p1', 5, 'MID', { assists: 2 }).map((e, i) => ({ ...e, id: `mid${i}` }));
    const suggestion = suggestStatChange(player, [...attGames, ...midGames]);
    expect(suggestion?.statKey).toBe('passing'); // MID has 5 qualifying games vs ATT's 3
  });

  it('breaks a sample-size tie by margin past threshold', () => {
    const player = makePlayer('p1', makeStats({ shooting: 3, passing: 3 }));
    const attGames = makeMatches('p1', 3, 'ATT', { goals: 2 }); // margin 0.5 above 1.5
    const midGames = makeMatches('p1', 3, 'MID', { assists: 5 }).map((e, i) => ({ ...e, id: `mid${i}` })); // margin 4 above 1.0
    const suggestion = suggestStatChange(player, [...attGames, ...midGames]);
    expect(suggestion?.statKey).toBe('passing');
  });

  it('returns null when nothing qualifies anywhere', () => {
    const player = makePlayer('p1', makeStats());
    expect(suggestStatChange(player, [])).toBeNull();
  });
});

describe('suggestStatChange — statHistory cutoff', () => {
  it('does not re-suggest using appearances that all predate the most recent statHistory entry', () => {
    const statHistory: StatHistoryEntry[] = [{ at: 1000, stats: makeStats({ defending: 4 }), source: 'suggestion' }];
    const player: Player = { ...makePlayer('p1', makeStats({ defending: 4 })), statHistory };
    // Same stale evidence that justified the accepted downgrade — all dated before the cutoff.
    const history = makeMatches('p1', 5, 'GK', { saves: 0, concedes: 3 }).map((e, i) => ({ ...e, date: i })); // dates 0..4, all < 1000
    expect(suggestStatChange(player, history)).toBeNull();
  });

  it('a player with no statHistory still gets suggestions from full history (unchanged behavior)', () => {
    const player = makePlayer('p1', makeStats({ defending: 4 })); // no statHistory field at all
    const history = makeMatches('p1', 5, 'GK', { saves: 0, concedes: 3 });
    expect(suggestStatChange(player, history)).toMatchObject({ statKey: 'defending', direction: 'down' });
  });

  it("a legacy statsVerifiedAt-only player (no statHistory array) is also treated as having a cutoff, via effectiveStatHistory's fallback", () => {
    const player: Player = {
      ...makePlayer('p1', makeStats({ defending: 4 })),
      statsVerifiedBy: ['Alice'],
      statsVerifiedAt: 1000,
    };
    const history = makeMatches('p1', 5, 'GK', { saves: 0, concedes: 3 }).map((e, i) => ({ ...e, date: i })); // all < 1000
    expect(suggestStatChange(player, history)).toBeNull();
  });

  it('appearances after the cutoff count, but need to independently hit MIN_SAMPLE — old pre-cutoff appearances do not partially carry over', () => {
    const statHistory: StatHistoryEntry[] = [{ at: 1000, stats: makeStats({ defending: 4 }), source: 'suggestion' }];
    const player: Player = { ...makePlayer('p1', makeStats({ defending: 4 })), statHistory };
    const stale = makeMatches('p1', 5, 'GK', { saves: 0, concedes: 3 }).map((e, i) => ({ ...e, date: i })); // 0..4, pre-cutoff
    const fresh = makeMatches('p1', 2, 'GK', { saves: 0, concedes: 3 }).map((e, i) => ({ ...e, id: `fresh${i}`, date: 2000 + i })); // only 2 post-cutoff
    expect(suggestStatChange(player, [...stale, ...fresh])).toBeNull(); // 2 < MIN_SAMPLE(3), stale ones don't count at all
  });

  it('exactly MIN_SAMPLE fresh post-cutoff appearances re-triggers a suggestion, sized only to those', () => {
    const statHistory: StatHistoryEntry[] = [{ at: 1000, stats: makeStats({ defending: 4 }), source: 'suggestion' }];
    const player: Player = { ...makePlayer('p1', makeStats({ defending: 4 })), statHistory };
    const stale = makeMatches('p1', 5, 'GK', { saves: 0, concedes: 3 }).map((e, i) => ({ ...e, date: i }));
    const fresh = makeMatches('p1', 3, 'GK', { saves: 0, concedes: 3 }).map((e, i) => ({ ...e, id: `fresh${i}`, date: 2000 + i }));
    const suggestion = suggestStatChange(player, [...stale, ...fresh]);
    expect(suggestion).toMatchObject({ statKey: 'defending', direction: 'down', sampleSize: 3 });
  });
});
