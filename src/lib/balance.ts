import type { Player, Position, Team } from '../types';
import { overall } from './rating';

export interface TeamAssignment {
  player: Player;
  /** Position to rate the player at: their pitch slot if placed, else their preferred position. */
  position: Position;
}

/** Sum of position-aware overalls for a team's current roster/placements. */
export function teamStrength(assignments: TeamAssignment[]): number {
  return assignments.reduce((sum, a) => sum + overall(a.player, a.position), 0);
}

export type BalanceVerdict = 'EVEN' | 'SLIGHT_EDGE' | 'EDGE';

export interface BalanceResult {
  strengthA: number;
  strengthB: number;
  diff: number;
  verdict: BalanceVerdict;
  leader: Team | null;
}

// Expressed as a fraction of the average team strength so the verdict holds
// steady whether it's 5-, 6-, or 7-a-side rather than needing per-formation
// tuning of absolute point thresholds.
const SLIGHT_EDGE_PCT = 0.05;
const EDGE_PCT = 0.12;

export function computeBalance(strengthA: number, strengthB: number): BalanceResult {
  const diff = strengthA - strengthB;
  const avg = (strengthA + strengthB) / 2 || 1;
  const pct = Math.abs(diff) / avg;

  let verdict: BalanceVerdict = 'EVEN';
  if (pct >= EDGE_PCT) verdict = 'EDGE';
  else if (pct >= SLIGHT_EDGE_PCT) verdict = 'SLIGHT_EDGE';

  return {
    strengthA,
    strengthB,
    diff,
    verdict,
    leader: diff === 0 ? null : diff > 0 ? 'A' : 'B',
  };
}
