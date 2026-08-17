import { describe, expect, it } from 'vitest';
import { appearancesAtPosition, matchImpactBadges, matchResult, matchesForPlayer } from '../src/lib/playerMatchLog';
import type { HistoryPlayerSnapshot, MatchHistoryEntry } from '../src/types';

function makeSnapshot(id: string, overrides: Partial<HistoryPlayerSnapshot> = {}): HistoryPlayerSnapshot {
  return { id, name: id, position: 'MID', overall: 70, isCaptain: false, ...overrides };
}

function makeEntry(id: string, overrides: Partial<MatchHistoryEntry> = {}): MatchHistoryEntry {
  return {
    id,
    date: 1000,
    formation: '6',
    teamAName: 'Marcus',
    teamBName: 'Sofia',
    teamAPlayers: [],
    teamBPlayers: [],
    strengthA: 100,
    strengthB: 95,
    ...overrides,
  };
}

describe('matchesForPlayer', () => {
  it('finds a player on team A', () => {
    const entry = makeEntry('e1', { teamAPlayers: [makeSnapshot('p1')] });
    const result = matchesForPlayer([entry], 'p1');
    expect(result).toEqual([{ entry, snapshot: entry.teamAPlayers[0], team: 'A' }]);
  });

  it('finds a player on team B', () => {
    const entry = makeEntry('e1', { teamBPlayers: [makeSnapshot('p1')] });
    const result = matchesForPlayer([entry], 'p1');
    expect(result).toEqual([{ entry, snapshot: entry.teamBPlayers[0], team: 'B' }]);
  });

  it('skips an entry the player was not in', () => {
    const entry = makeEntry('e1', { teamAPlayers: [makeSnapshot('other')] });
    expect(matchesForPlayer([entry], 'p1')).toEqual([]);
  });

  it('preserves input order (already newest-first)', () => {
    const e1 = makeEntry('e1', { date: 2000, teamAPlayers: [makeSnapshot('p1')] });
    const e2 = makeEntry('e2', { date: 1000, teamAPlayers: [makeSnapshot('p1')] });
    const result = matchesForPlayer([e1, e2], 'p1');
    expect(result.map((r) => r.entry.id)).toEqual(['e1', 'e2']);
  });
});

describe('matchResult', () => {
  it('returns "unknown" when no score was entered', () => {
    expect(matchResult(makeEntry('e1'), 'A')).toBe('unknown');
  });

  it('returns "win" for the higher-scoring team', () => {
    expect(matchResult(makeEntry('e1', { scoreA: 3, scoreB: 1 }), 'A')).toBe('win');
    expect(matchResult(makeEntry('e1', { scoreA: 1, scoreB: 3 }), 'B')).toBe('win');
  });

  it('returns "loss" for the lower-scoring team', () => {
    expect(matchResult(makeEntry('e1', { scoreA: 1, scoreB: 3 }), 'A')).toBe('loss');
  });

  it('returns "draw" on equal scores', () => {
    expect(matchResult(makeEntry('e1', { scoreA: 2, scoreB: 2 }), 'A')).toBe('draw');
  });
});

describe('matchImpactBadges', () => {
  it('awards Hat-Trick for 3+ goals', () => {
    const snapshot = makeSnapshot('p1', { goals: 3 });
    expect(matchImpactBadges(makeEntry('e1'), snapshot, 'A')).toContain('Hat-Trick');
    expect(matchImpactBadges(makeEntry('e1'), makeSnapshot('p1', { goals: 2 }), 'A')).not.toContain('Hat-Trick');
  });

  it('awards Clean Sheet only for a GK with a scored, opponent-0 match', () => {
    const gk = makeSnapshot('p1', { position: 'GK' });
    expect(matchImpactBadges(makeEntry('e1', { scoreA: 2, scoreB: 0 }), gk, 'A')).toContain('Clean Sheet');
    expect(matchImpactBadges(makeEntry('e1', { scoreA: 2, scoreB: 1 }), gk, 'A')).not.toContain('Clean Sheet');
    expect(matchImpactBadges(makeEntry('e1'), gk, 'A')).not.toContain('Clean Sheet'); // no score entered
    const def = makeSnapshot('p1', { position: 'DEF' });
    expect(matchImpactBadges(makeEntry('e1', { scoreA: 2, scoreB: 0 }), def, 'A')).not.toContain('Clean Sheet');
  });

  it('awards Match Winner for a won match', () => {
    expect(matchImpactBadges(makeEntry('e1', { scoreA: 3, scoreB: 1 }), makeSnapshot('p1'), 'A')).toContain('Match Winner');
    expect(matchImpactBadges(makeEntry('e1', { scoreA: 1, scoreB: 3 }), makeSnapshot('p1'), 'A')).not.toContain('Match Winner');
  });

  it('can award multiple badges at once', () => {
    const gk = makeSnapshot('p1', { position: 'GK', goals: 3 });
    const badges = matchImpactBadges(makeEntry('e1', { scoreA: 4, scoreB: 0 }), gk, 'A');
    expect(badges).toEqual(expect.arrayContaining(['Hat-Trick', 'Clean Sheet', 'Match Winner']));
  });
});

describe('appearancesAtPosition', () => {
  it('filters by the assigned in-match position, not a profile position', () => {
    const entry = makeEntry('e1', { teamAPlayers: [makeSnapshot('p1', { position: 'GK' })] });
    const appearances = matchesForPlayer([entry], 'p1');
    expect(appearancesAtPosition(appearances, 'GK', 5)).toHaveLength(1);
    expect(appearancesAtPosition(appearances, 'DEF', 5)).toHaveLength(0);
  });

  it('caps the result at n, keeping the most recent (input order)', () => {
    const entries = [1, 2, 3, 4].map((i) =>
      makeEntry(`e${i}`, { date: i, teamAPlayers: [makeSnapshot('p1', { position: 'ATT' })] }),
    );
    const appearances = matchesForPlayer(entries, 'p1');
    const capped = appearancesAtPosition(appearances, 'ATT', 2);
    expect(capped).toHaveLength(2);
    expect(capped.map((a) => a.entry.id)).toEqual(['e1', 'e2']);
  });
});
