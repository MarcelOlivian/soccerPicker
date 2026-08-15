import { describe, expect, it } from 'vitest';
import { filterAndSortPlayers } from '../src/lib/playerSearch';
import { emptyStats } from '../src/types';
import type { Player } from '../src/types';

function makePlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name'>): Player {
  return {
    position: 'MID',
    stats: emptyStats(),
    createdAt: 0,
    ...overrides,
  };
}

const players: Player[] = [
  makePlayer({ id: '1', name: 'Amara Okafor', position: 'MID', stats: { ...emptyStats(), pace: 5 } }),
  makePlayer({ id: '2', name: 'Diego Alvarez', nickname: 'Tank', position: 'DEF', stats: { ...emptyStats(), pace: 2 } }),
  makePlayer({ id: '3', name: 'Bianca Rossi', position: 'DEF', stats: { ...emptyStats(), pace: 4 } }),
];

describe('filterAndSortPlayers', () => {
  it('returns all players sorted by name when the query is empty', () => {
    const result = filterAndSortPlayers(players, '', 'name');
    expect(result.map((p) => p.name)).toEqual(['Amara Okafor', 'Bianca Rossi', 'Diego Alvarez']);
  });

  it('matches a query against the name, case-insensitively', () => {
    const result = filterAndSortPlayers(players, 'amara', 'name');
    expect(result.map((p) => p.id)).toEqual(['1']);
  });

  it('matches a query against the nickname, case-insensitively', () => {
    const result = filterAndSortPlayers(players, 'TANK', 'name');
    expect(result.map((p) => p.id)).toEqual(['2']);
  });

  it('sorts by overall descending', () => {
    const result = filterAndSortPlayers(players, '', 'overall');
    // Amara (pace 5) > Bianca (pace 4) > Diego (pace 2), all else equal.
    expect(result.map((p) => p.id)).toEqual(['1', '3', '2']);
  });

  it('sorts by position, breaking ties by name', () => {
    const result = filterAndSortPlayers(players, '', 'position');
    // DEF before MID; within DEF, Bianca before Diego by name.
    expect(result.map((p) => p.id)).toEqual(['3', '2', '1']);
  });
});
