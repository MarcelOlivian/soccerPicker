import type { Player, PlayerStats, Position, StatKey } from '../types';

/**
 * Position-aware stat weights. Each row sums to 1.0. A player's Overall is
 * the weighted mean of their stats *at a given position* — this is what
 * makes moving a striker into goal actually cost their team something on
 * the balance meter, instead of the pitch board being pure decoration.
 */
// There's no dedicated goalkeeping stat (the app runs goalkeeping as a
// rotating turn, not a specialized role), so GK's row leans on defending
// (shot-stopping/positioning proxy) and physicality (reflexes/strength
// proxy) instead of a stat of its own — and leans on them *more heavily*
// than DEF does, so a natural keeper (high defending/physicality, low
// everything else) still rates distinctly better at GK than at DEF, where
// a more even spread across pace/passing pulls a specialist's score down.
const WEIGHTS: Record<Position, Record<StatKey, number>> = {
  GK: {
    defending: 0.4,
    physicality: 0.3,
    passing: 0.15,
    pace: 0.05,
    dribbling: 0.05,
    shooting: 0.05,
  },
  DEF: {
    defending: 0.3,
    physicality: 0.2,
    passing: 0.2,
    pace: 0.2,
    dribbling: 0.05,
    shooting: 0.05,
  },
  MID: {
    passing: 0.3,
    dribbling: 0.2,
    physicality: 0.2,
    pace: 0.15,
    shooting: 0.1,
    defending: 0.05,
  },
  ATT: {
    shooting: 0.4,
    pace: 0.25,
    dribbling: 0.15,
    physicality: 0.1,
    passing: 0.05,
    defending: 0.05,
  },
};

/** Weighted mean of a stat block at a position, in the raw 1-5 range. */
export function weightedMean(stats: PlayerStats, position: Position): number {
  const weights = WEIGHTS[position];
  let sum = 0;
  for (const key of Object.keys(weights) as StatKey[]) {
    sum += stats[key] * weights[key];
  }
  return sum;
}

/**
 * Maps the 1-5 weighted mean onto a FIFA-ish 45-95 integer scale, so a
 * middling 3.0 average reads as a plausible "68" rather than a blunt "3".
 */
export function overall(player: Pick<Player, 'stats'>, atPosition: Position): number {
  const mean = weightedMean(player.stats, atPosition);
  const scaled = ((mean - 1) / 4) * 50 + 45;
  return Math.round(scaled);
}

/** Overall at the player's own preferred position — what the card shows. */
export function preferredOverall(player: Player): number {
  return overall(player, player.position);
}

/** Signed difference between a player's overall at a slot vs. their preferred position. */
export function overallDelta(player: Player, atPosition: Position): number {
  return overall(player, atPosition) - preferredOverall(player);
}
