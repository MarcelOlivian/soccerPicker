import type { Player, PlayerStats, Position, StatKey } from '../types';

/**
 * Position-aware stat weights. Each row sums to 1.0. A player's Overall is
 * the weighted mean of their stats *at a given position* — this is what
 * makes moving a striker into goal actually cost their team something on
 * the balance meter, instead of the pitch board being pure decoration.
 */
const WEIGHTS: Record<Position, Record<StatKey, number>> = {
  GK: {
    goalkeeping: 0.45,
    defending: 0.15,
    passing: 0.15,
    pace: 0.1,
    stamina: 0.1,
    finishing: 0.05,
  },
  DEF: {
    defending: 0.35,
    stamina: 0.2,
    passing: 0.2,
    pace: 0.15,
    finishing: 0.1,
    goalkeeping: 0,
  },
  MID: {
    passing: 0.3,
    stamina: 0.3,
    pace: 0.15,
    finishing: 0.15,
    defending: 0.1,
    goalkeeping: 0,
  },
  ATT: {
    finishing: 0.4,
    pace: 0.25,
    stamina: 0.15,
    passing: 0.15,
    defending: 0.05,
    goalkeeping: 0,
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
