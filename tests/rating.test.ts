import { describe, expect, it } from 'vitest';
import { overall, overallDelta, preferredOverall, weightedMean } from '../src/lib/rating';
import type { Player, PlayerStats } from '../src/types';

function makePlayer(position: Player['position'], stats: PlayerStats): Player {
  return {
    id: 'p1',
    name: 'Test Player',
    position,
    stats,
    createdAt: 0,
  };
}

const strikerStats: PlayerStats = {
  pace: 5,
  shooting: 5,
  passing: 3,
  dribbling: 4,
  defending: 1,
  physicality: 4,
};

const keeperStats: PlayerStats = {
  pace: 2,
  shooting: 1,
  passing: 3,
  dribbling: 1,
  defending: 5,
  physicality: 4,
};

describe('rating', () => {
  it('scores a maxed-out 5/5/5/5/5/5 player at 95 in every position', () => {
    const perfect = makePlayer('ATT', {
      pace: 5,
      shooting: 5,
      passing: 5,
      dribbling: 5,
      defending: 5,
      physicality: 5,
    });
    for (const pos of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      expect(overall(perfect, pos)).toBe(95);
    }
  });

  it('scores a bottomed-out 1/1/1/1/1/1 player at 45 in every position', () => {
    const worst = makePlayer('DEF', {
      pace: 1,
      shooting: 1,
      passing: 1,
      dribbling: 1,
      defending: 1,
      physicality: 1,
    });
    for (const pos of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      expect(overall(worst, pos)).toBe(45);
    }
  });

  it('rates a striker highest at ATT and lowest at GK', () => {
    const striker = makePlayer('ATT', strikerStats);
    const att = overall(striker, 'ATT');
    const gk = overall(striker, 'GK');
    const def = overall(striker, 'DEF');
    expect(att).toBeGreaterThan(def);
    expect(def).toBeGreaterThan(gk);
  });

  it('drops a goalkeeper placed at ATT relative to their preferred GK rating', () => {
    const keeper = makePlayer('GK', keeperStats);
    const atGoal = overall(keeper, 'GK');
    const atAttack = overall(keeper, 'ATT');
    expect(atAttack).toBeLessThan(atGoal);
  });

  it('overallDelta is zero at the preferred position and negative when misplaced', () => {
    const striker = makePlayer('ATT', strikerStats);
    expect(overallDelta(striker, 'ATT')).toBe(0);
    expect(overallDelta(striker, 'GK')).toBeLessThan(0);
    expect(preferredOverall(striker)).toBe(overall(striker, 'ATT'));
  });

  it('weightedMean stays within the 1-5 stat range', () => {
    const mean = weightedMean(strikerStats, 'MID');
    expect(mean).toBeGreaterThanOrEqual(1);
    expect(mean).toBeLessThanOrEqual(5);
  });

  it('each position weight table sums to 1', async () => {
    // Indirect check: a uniform stat block of value v must map to the same
    // overall as a plain v-only computation, for every position, which only
    // holds if the weights for that position sum to exactly 1.
    for (const pos of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const uniform = makePlayer(pos, {
        pace: 4,
        shooting: 4,
        passing: 4,
        dribbling: 4,
        defending: 4,
        physicality: 4,
      });
      expect(weightedMean(uniform.stats, pos)).toBeCloseTo(4, 10);
    }
  });
});
