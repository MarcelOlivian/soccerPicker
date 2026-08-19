import { describe, expect, it } from 'vitest';
import { appendStatHistoryEntry, auditLogLines, effectiveStatHistory, inferStatChangeSource } from '../src/lib/statHistory';
import type { Player, PlayerStats, StatHistoryEntry } from '../src/types';

function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return { pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3, ...overrides };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Marcus Webb',
    position: 'MID',
    stats: makeStats(),
    createdAt: 0,
    ...overrides,
  };
}

describe('effectiveStatHistory', () => {
  it('returns [] for a player with no statHistory and no legacy vote record', () => {
    expect(effectiveStatHistory(makePlayer())).toEqual([]);
  });

  it('synthesizes one entry from a legacy statsVerifiedBy/At pair when statHistory is absent', () => {
    const player = makePlayer({ statsVerifiedBy: ['Ana', 'Bo'], statsVerifiedAt: 1000 });
    expect(effectiveStatHistory(player)).toEqual([{ at: 1000, stats: player.stats, source: 'vote', verifiedBy: ['Ana', 'Bo'] }]);
  });

  it('prefers a real statHistory array over the legacy vote-record synthesis', () => {
    const realHistory: StatHistoryEntry[] = [{ at: 500, stats: makeStats({ shooting: 4 }), source: 'manual' }];
    const player = makePlayer({ statHistory: realHistory, statsVerifiedBy: ['Ana'], statsVerifiedAt: 1000 });
    expect(effectiveStatHistory(player)).toBe(realHistory);
  });

  it('returns [] when statsVerifiedBy is present but empty', () => {
    const player = makePlayer({ statsVerifiedBy: [], statsVerifiedAt: 1000 });
    expect(effectiveStatHistory(player)).toEqual([]);
  });
});

describe('inferStatChangeSource', () => {
  it('returns "vote" when statsVerifiedAt is newer than what was stored before', () => {
    const previous = makePlayer({ statsVerifiedAt: 1000 });
    const next = makePlayer({ statsVerifiedAt: 2000 });
    expect(inferStatChangeSource(previous, next)).toBe('vote');
  });

  it('returns "manual" when statsVerifiedAt is unchanged', () => {
    const previous = makePlayer({ statsVerifiedAt: 1000 });
    const next = makePlayer({ statsVerifiedAt: 1000, stats: makeStats({ shooting: 4 }) });
    expect(inferStatChangeSource(previous, next)).toBe('manual');
  });

  it('returns "manual" when there is no previous player', () => {
    expect(inferStatChangeSource(undefined, makePlayer())).toBe('manual');
  });

  it('returns "manual" when statsVerifiedAt is cleared (undefined) on next', () => {
    const previous = makePlayer({ statsVerifiedAt: 1000 });
    const next = makePlayer({ statsVerifiedAt: undefined });
    expect(inferStatChangeSource(previous, next)).toBe('manual');
  });
});

describe('appendStatHistoryEntry', () => {
  it('does nothing (returns next unchanged) when there is no previous player', () => {
    const next = makePlayer();
    expect(appendStatHistoryEntry(undefined, next, 'manual')).toBe(next);
  });

  it('does nothing when stats are identical between previous and next', () => {
    const previous = makePlayer();
    const next = makePlayer({ name: 'renamed' }); // non-stat field changed
    const result = appendStatHistoryEntry(previous, next, 'manual');
    expect(result).toBe(next);
    expect(result.statHistory).toBeUndefined();
  });

  it('appends one entry when stats differ, with source "manual" and no verifiedBy', () => {
    const previous = makePlayer();
    const next = makePlayer({ stats: makeStats({ shooting: 4 }) });
    const result = appendStatHistoryEntry(previous, next, 'manual');
    expect(result.statHistory).toHaveLength(1);
    expect(result.statHistory![0]).toMatchObject({ stats: next.stats, source: 'manual', verifiedBy: undefined });
  });

  it('appends one entry with source "vote" and verifiedBy copied from next', () => {
    const previous = makePlayer();
    const next = makePlayer({ stats: makeStats({ shooting: 4 }), statsVerifiedBy: ['Ana', 'Bo'], statsVerifiedAt: 500 });
    const result = appendStatHistoryEntry(previous, next, 'vote');
    expect(result.statHistory![0]).toMatchObject({ stats: next.stats, source: 'vote', verifiedBy: ['Ana', 'Bo'] });
  });

  it('appends one entry with source "suggestion" and carries the note', () => {
    const previous = makePlayer();
    const next = makePlayer({ stats: makeStats({ shooting: 4 }) });
    const result = appendStatHistoryEntry(previous, next, 'suggestion', 'Averaging 1.6 goals/match as ATT.');
    expect(result.statHistory![0]).toMatchObject({ source: 'suggestion', note: 'Averaging 1.6 goals/match as ATT.' });
  });

  it('appends onto an existing statHistory array rather than replacing it', () => {
    const firstEntry: StatHistoryEntry = { at: 1, stats: makeStats({ shooting: 4 }), source: 'manual' };
    const previous = makePlayer({ stats: makeStats({ shooting: 4 }), statHistory: [firstEntry] });
    const next = makePlayer({ stats: makeStats({ shooting: 5 }), statHistory: [firstEntry] });
    const result = appendStatHistoryEntry(previous, next, 'manual');
    expect(result.statHistory).toHaveLength(2);
    expect(result.statHistory![0]).toBe(firstEntry);
  });
});

describe('auditLogLines', () => {
  it('returns [] for an untouched player', () => {
    expect(auditLogLines(makePlayer())).toEqual([]);
  });

  it('describes a vote entry with pluralized voter count, diffed against emptyStats()', () => {
    const player = makePlayer({ statsVerifiedBy: ['Ana', 'Bo', 'Cy'], statsVerifiedAt: 1755255720000 });
    const lines = auditLogLines(player);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Stat vote by 3 players');
    expect(lines[0]).toContain('Aug 15, 2025'); // sanity: contains a formatted date
  });

  it('pluralizes correctly for a single voter', () => {
    const player = makePlayer({ statsVerifiedBy: ['Ana'], statsVerifiedAt: 1000 });
    expect(auditLogLines(player)[0]).toContain('Stat vote by 1 player (');
  });

  it('describes a manual entry and a suggestion entry with its note, newest first', () => {
    const statHistory: StatHistoryEntry[] = [
      { at: 1000, stats: makeStats({ shooting: 4 }), source: 'manual' },
      { at: 2000, stats: makeStats({ shooting: 5 }), source: 'suggestion', note: 'Averaging 1.6 goals/match as ATT.' },
    ];
    const player = makePlayer({ stats: makeStats({ shooting: 5 }), statHistory });
    const lines = auditLogLines(player);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Performance suggestion accepted — Averaging 1.6 goals/match as ATT.');
    expect(lines[1]).toContain('Manually edited');
  });

  it('describes a csv entry as "Updated from CSV import"', () => {
    const statHistory: StatHistoryEntry[] = [{ at: 1000, stats: makeStats({ shooting: 4 }), source: 'csv' }];
    const player = makePlayer({ stats: makeStats({ shooting: 4 }), statHistory });
    const lines = auditLogLines(player);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Updated from CSV import');
    expect(lines[0]).toContain('SHO 4');
  });
});
