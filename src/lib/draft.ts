import type { DraftOrder, DraftPick, DraftState, Team } from '../types';

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
