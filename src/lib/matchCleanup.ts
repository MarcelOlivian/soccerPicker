import type { MatchState, Placements, Player } from '../types';

/**
 * Strips a match's attendance/picks/placements/captains down to only ids
 * present in the given players list. Used both when a single player is
 * explicitly deleted and to heal match state after a roster replace/merge
 * drops ids that used to be valid — without this, a stale id lingering in
 * attendingIds inflates "N attending tonight" even though its checkbox no
 * longer exists (there's no player left to render it for).
 */
export function pruneMatchToPlayers(match: MatchState, players: Player[]): MatchState {
  const validIds = new Set(players.map((p) => p.id));
  const attendingIds = match.attendingIds.filter((id) => validIds.has(id));
  const picks = match.draft.picks.filter((p) => validIds.has(p.playerId));
  const placements: Placements = {};
  for (const [slot, pid] of Object.entries(match.placements)) {
    if (pid && validIds.has(pid)) placements[slot] = pid;
  }
  const captainA = match.draft.captainA && validIds.has(match.draft.captainA) ? match.draft.captainA : undefined;
  const captainB = match.draft.captainB && validIds.has(match.draft.captainB) ? match.draft.captainB : undefined;
  return {
    ...match,
    attendingIds,
    placements,
    draft: { ...match.draft, picks, captainA, captainB },
  };
}
