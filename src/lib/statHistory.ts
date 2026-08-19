import { formatShortDate } from './dateFormat';
import { STAT_KEYS, STAT_LABELS, emptyStats } from '../types';
import type { Player, PlayerStats, StatHistoryEntry, StatHistorySource, StatKey } from '../types';

/**
 * Every stat-history entry for a player, oldest first. If the player has
 * never gone through this feature's save path (statHistory absent/empty)
 * but does carry a single legacy vote record (statsVerifiedBy/At, from
 * before this field existed), synthesize one display-only entry from it so
 * the trajectory chart and audit log aren't empty on day one. Otherwise []
 * — a genuinely untouched player.
 */
export function effectiveStatHistory(player: Player): StatHistoryEntry[] {
  if (player.statHistory && player.statHistory.length > 0) return player.statHistory;
  if (player.statsVerifiedBy?.length && player.statsVerifiedAt) {
    return [{ at: player.statsVerifiedAt, stats: player.stats, source: 'vote', verifiedBy: player.statsVerifiedBy }];
  }
  return [];
}

function statsEqual(a: PlayerStats, b: PlayerStats): boolean {
  return STAT_KEYS.every((k) => a[k] === b[k]);
}

/**
 * vote vs manual inference for a save through PlayerForm's normal edit
 * path (RosterTab's own save, not the Evolution "review suggestion" path,
 * which always knows its source is 'suggestion' up front). A save whose
 * statsVerifiedAt is newer than what was stored before it came from
 * PlayerForm's vote-reveal apply; anything else — a hand-edited stepper, or
 * a resave with the same verification — is 'manual'.
 */
export function inferStatChangeSource(previous: Player | undefined, next: Player): StatHistorySource {
  if (next.statsVerifiedAt !== undefined && next.statsVerifiedAt !== previous?.statsVerifiedAt) return 'vote';
  return 'manual';
}

/**
 * Compares `previous` (the player as currently stored, before this save)
 * against `next` (about to be saved) and, only if `next.stats` actually
 * differs, returns `next` with one new StatHistoryEntry appended. A
 * brand-new player (`previous` undefined) never appends — there is nothing
 * to diff against yet, and effectiveStatHistory()'s vote-record fallback
 * already covers a fresh player's first vote reveal.
 */
export function appendStatHistoryEntry(
  previous: Player | undefined,
  next: Player,
  source: StatHistorySource,
  note?: string,
): Player {
  if (!previous || statsEqual(previous.stats, next.stats)) return next;
  const entry: StatHistoryEntry = {
    at: Date.now(),
    stats: next.stats,
    source,
    verifiedBy: source === 'vote' ? next.statsVerifiedBy : undefined,
    note,
  };
  return { ...next, statHistory: [...(next.statHistory ?? previous.statHistory ?? []), entry] };
}

function diffStats(from: PlayerStats, to: PlayerStats): { key: StatKey; value: number }[] {
  return STAT_KEYS.filter((k) => from[k] !== to[k]).map((k) => ({ key: k, value: to[k] }));
}

function describeStatHistoryEntry(entry: StatHistoryEntry, previousStats: PlayerStats): string {
  const date = formatShortDate(entry.at);
  const changed = diffStats(previousStats, entry.stats);
  const changeList = changed.length > 0 ? changed.map((c) => `${STAT_LABELS[c.key]} ${c.value}`).join(', ') : 'no change';
  if (entry.source === 'vote') {
    const n = entry.verifiedBy?.length ?? 0;
    return `${date}: Stat vote by ${n} player${n === 1 ? '' : 's'} (${changeList}).`;
  }
  if (entry.source === 'suggestion') {
    return `${date}: Performance suggestion accepted${entry.note ? ` — ${entry.note}` : ''} (${changeList}).`;
  }
  if (entry.source === 'csv') {
    return `${date}: Updated from CSV import (${changeList}).`;
  }
  return `${date}: Manually edited (${changeList}).`;
}

/**
 * Human-readable audit-log lines, newest first. Every player starts at
 * emptyStats() before their first recorded change, so that's the diff
 * baseline for the very first entry.
 */
export function auditLogLines(player: Player): string[] {
  const entries = effectiveStatHistory(player); // oldest first
  const lines: string[] = [];
  let previous = emptyStats();
  for (const entry of entries) {
    lines.push(describeStatHistoryEntry(entry, previous));
    previous = entry.stats;
  }
  return lines.reverse();
}
