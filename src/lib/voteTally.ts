import { STAT_KEYS, emptyStats } from '../types';
import type { PlayerStats, StatValue } from '../types';

const MIN_STAT: StatValue = 1;
const MAX_STAT: StatValue = 5;

function clamp(value: number): StatValue {
  return Math.min(MAX_STAT, Math.max(MIN_STAT, value)) as StatValue;
}

/**
 * Rounded per-stat mean across all cast ballots, clamped into the legal
 * 1-5 StatValue range (a mean of e.g. 3.5 must land on a real value, and a
 * pathological all-1s/all-5s spread can never fall outside 1-5 anyway, but
 * clamping keeps this correct even if a bad ballot slipped past validation
 * elsewhere). Half-way values round up, matching how most people expect
 * "3.5" to read.
 */
export function tallyVotes(ballots: PlayerStats[]): PlayerStats {
  if (ballots.length === 0) return emptyStats();
  const result = {} as PlayerStats;
  for (const key of STAT_KEYS) {
    const sum = ballots.reduce((acc, ballot) => acc + ballot[key], 0);
    const mean = sum / ballots.length;
    result[key] = clamp(Math.round(mean));
  }
  return result;
}
