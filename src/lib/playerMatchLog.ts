import type { HistoryPlayerSnapshot, MatchHistoryEntry, Position, Team } from '../types';

export interface PlayerMatchAppearance {
  entry: MatchHistoryEntry;
  snapshot: HistoryPlayerSnapshot;
  team: Team;
}

/**
 * Every history entry the player appears in, newest first — history is
 * already stored newest-first (SAVE_MATCH_TO_HISTORY prepends, MERGE_HISTORY
 * re-sorts descending by date), so this is a straight filter+map with no
 * re-sort needed.
 */
export function matchesForPlayer(history: MatchHistoryEntry[], playerId: string): PlayerMatchAppearance[] {
  const out: PlayerMatchAppearance[] = [];
  for (const entry of history) {
    const a = entry.teamAPlayers.find((p) => p.id === playerId);
    if (a) {
      out.push({ entry, snapshot: a, team: 'A' });
      continue;
    }
    const b = entry.teamBPlayers.find((p) => p.id === playerId);
    if (b) out.push({ entry, snapshot: b, team: 'B' });
  }
  return out;
}

export type MatchResult = 'win' | 'loss' | 'draw' | 'unknown';

/** 'unknown' when no score was ever entered for this match — never counted as a loss. */
export function matchResult(entry: MatchHistoryEntry, team: Team): MatchResult {
  if (entry.scoreA === undefined || entry.scoreB === undefined) return 'unknown';
  const own = team === 'A' ? entry.scoreA : entry.scoreB;
  const opp = team === 'A' ? entry.scoreB : entry.scoreA;
  if (own > opp) return 'win';
  if (own < opp) return 'loss';
  return 'draw';
}

/** Exactly 'Hat-Trick' / 'Clean Sheet' / 'Match Winner' — no more, by design. */
export function matchImpactBadges(entry: MatchHistoryEntry, snapshot: HistoryPlayerSnapshot, team: Team): string[] {
  const badges: string[] = [];
  if ((snapshot.goals ?? 0) >= 3) badges.push('Hat-Trick');
  const scoreEntered = entry.scoreA !== undefined && entry.scoreB !== undefined;
  const oppScore = team === 'A' ? entry.scoreB : entry.scoreA;
  if (snapshot.position === 'GK' && scoreEntered && oppScore === 0) badges.push('Clean Sheet');
  if (matchResult(entry, team) === 'win') badges.push('Match Winner');
  return badges;
}

/**
 * Appearances at a specific in-match position (HistoryPlayerSnapshot.position,
 * not the player's profile position), most-recent-first, capped at n.
 * `appearances` is already newest-first, so this is filter+slice.
 */
export function appearancesAtPosition(
  appearances: PlayerMatchAppearance[],
  position: Position,
  n: number,
): PlayerMatchAppearance[] {
  return appearances.filter((a) => a.snapshot.position === position).slice(0, n);
}
