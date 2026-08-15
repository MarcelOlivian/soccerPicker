import { preferredOverall } from './rating';
import type { DraftOrder, DraftPick, DraftState, Player, Team } from '../types';

/**
 * Which team picks next, given the picks made so far.
 *
 * 'alternating' is a flat A B A B A B… — simple, but the team that picks
 * first has a real structural edge over a full draft.
 *
 * 'snake' mirrors each pair of picks (A B B A A B B A …), which is the
 * classic fix: the disadvantage of picking first in one round is repaid by
 * picking first again immediately after, back-to-back.
 */
export function nextTeam(picks: DraftPick[], order: DraftOrder): Team {
  const n = picks.length;
  if (order === 'alternating') {
    return n % 2 === 0 ? 'A' : 'B';
  }
  const cycle = n % 4;
  return cycle === 0 || cycle === 3 ? 'A' : 'B';
}

/** Player ids from the attending roster that haven't been picked yet. */
export function remaining(attendingIds: string[], picks: DraftPick[]): string[] {
  const picked = new Set(picks.map((p) => p.playerId));
  return attendingIds.filter((id) => !picked.has(id));
}

export function isComplete(attendingIds: string[], picks: DraftPick[]): boolean {
  return attendingIds.length > 0 && picks.length >= attendingIds.length;
}

export function picksForTeam(picks: DraftPick[], team: Team): DraftPick[] {
  return picks.filter((p) => p.team === team);
}

/** Appends a pick for whichever team's turn it currently is. Pure — returns a new state. */
export function applyPick(state: DraftState, playerId: string): DraftState {
  if (state.picks.some((p) => p.playerId === playerId)) {
    // Already picked; no-op rather than double-assign.
    return state;
  }
  const team = nextTeam(state.picks, state.order);
  return { ...state, picks: [...state.picks, { playerId, team }] };
}

/** Removes the most recent pick, if any. Pure — returns a new state. */
export function undoPick(state: DraftState): DraftState {
  if (state.picks.length === 0) return state;
  return { ...state, picks: state.picks.slice(0, -1) };
}

export function resetDraft(order: DraftOrder = 'snake'): DraftState {
  return { order, picks: [] };
}

/** Short team label from the captain's first name, e.g. "Marcus Webb" -> "Marcus". Falls back to the raw team id if no captain name is available. */
export function teamShortName(captainName: string | undefined, team: Team): string {
  return captainName ? captainName.trim().split(/\s+/)[0] : team;
}

export function otherTeam(team: Team): Team {
  return team === 'A' ? 'B' : 'A';
}

function formatTeamBlock(teamName: string, teamPlayers: Player[], captainId: string | undefined): string {
  const lines = teamPlayers.map((p) => {
    const nickname = p.nickname ? ` (${p.nickname})` : '';
    const captainSuffix = p.id === captainId ? ' (captain)' : '';
    return `- ${p.name}${nickname}${captainSuffix}`;
  });
  return `Team ${teamName}\n${lines.join('\n')}`;
}

/** Plain-text roster grouped by team, e.g. for pasting into a chat. */
export function formatTeamsList(
  teamAName: string,
  teamAPlayers: Player[],
  captainAId: string | undefined,
  teamBName: string,
  teamBPlayers: Player[],
  captainBId: string | undefined,
): string {
  return [
    formatTeamBlock(teamAName, teamAPlayers, captainAId),
    formatTeamBlock(teamBName, teamBPlayers, captainBId),
  ].join('\n\n');
}

/**
 * Assigns each remaining player to whichever team's turn it is next,
 * always taking the strongest remaining player by preferred-position
 * overall — mirrors a captain always drafting the best player available on
 * their turn. Reusing the same turn order as manual picks means the final
 * team sizes come out exactly as manual picking would have produced, with
 * no separate size bookkeeping needed. Returns only the new picks, in turn
 * order — the caller appends them to the existing picks.
 */
export function autoDraftRemaining(
  remainingPlayers: Player[],
  existingPicks: DraftPick[],
  order: DraftOrder,
): DraftPick[] {
  const pool = [...remainingPlayers];
  const picks = [...existingPicks];
  const newPicks: DraftPick[] = [];

  while (pool.length > 0) {
    const team = nextTeam(picks, order);
    let bestIndex = 0;
    for (let i = 1; i < pool.length; i++) {
      if (preferredOverall(pool[i]) > preferredOverall(pool[bestIndex])) bestIndex = i;
    }
    const [player] = pool.splice(bestIndex, 1);
    const pick: DraftPick = { playerId: player.id, team };
    picks.push(pick);
    newPicks.push(pick);
  }

  return newPicks;
}

export interface SwapSuggestion {
  playerIdA: string;
  playerIdB: string;
  currentDiff: number;
  newDiff: number;
}

/**
 * Finds the single pairwise swap between the two teams' non-captain picks
 * that most reduces the balance gap (by preferred-position overall).
 * Captains are never candidates — swapping one to the other team would
 * strand "Team Marcus" without Marcus. Returns null if no swap improves on
 * the current difference.
 */
export function suggestBalanceSwap(
  teamAPlayers: Player[],
  captainAId: string | undefined,
  teamBPlayers: Player[],
  captainBId: string | undefined,
): SwapSuggestion | null {
  const strengthOf = (players: Player[]) => players.reduce((sum, p) => sum + preferredOverall(p), 0);
  const baseA = strengthOf(teamAPlayers);
  const baseB = strengthOf(teamBPlayers);
  const currentDiff = Math.abs(baseA - baseB);

  let best: SwapSuggestion | null = null;
  for (const a of teamAPlayers) {
    if (a.id === captainAId) continue;
    for (const b of teamBPlayers) {
      if (b.id === captainBId) continue;
      const newA = baseA - preferredOverall(a) + preferredOverall(b);
      const newB = baseB - preferredOverall(b) + preferredOverall(a);
      const newDiff = Math.abs(newA - newB);
      if (newDiff < currentDiff && (!best || newDiff < best.newDiff)) {
        best = { playerIdA: a.id, playerIdB: b.id, currentDiff, newDiff };
      }
    }
  }
  return best;
}
