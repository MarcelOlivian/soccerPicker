import { preferredOverall } from './rating';
import type { Player } from '../types';

export type PlayerSortKey = 'name' | 'overall' | 'position';

/**
 * Filters players by a case-insensitive name/nickname substring match, then
 * sorts by the given key. Pure — shared by the Setup roster grid and the
 * Compare tab's picker list so their search/sort behavior can't drift apart.
 */
export function filterAndSortPlayers(players: Player[], query: string, sortKey: PlayerSortKey): Player[] {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? players.filter((p) => p.name.toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q))
    : players;
  return [...filtered].sort((a, b) => {
    if (sortKey === 'position') return a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
    if (sortKey === 'overall') return preferredOverall(b) - preferredOverall(a);
    return a.name.localeCompare(b.name);
  });
}
