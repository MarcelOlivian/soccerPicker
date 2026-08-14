import { describe, expect, it } from 'vitest';
import { tallyVotes } from '../src/lib/voteTally';
import { emptyStats } from '../src/types';
import type { PlayerStats } from '../src/types';

function ballot(overrides: Partial<PlayerStats>): PlayerStats {
  return { ...emptyStats(), ...overrides };
}

describe('tallyVotes', () => {
  it('returns emptyStats() when there are no ballots', () => {
    expect(tallyVotes([])).toEqual(emptyStats());
  });

  it('returns the single ballot unchanged when there is only one', () => {
    const only = ballot({ pace: 5, shooting: 1, passing: 3, dribbling: 2, defending: 4, physicality: 1 });
    expect(tallyVotes([only])).toEqual(only);
  });

  it('returns the exact value for a unanimous vote', () => {
    const unanimous = ballot({ pace: 4, shooting: 4, passing: 4, dribbling: 4, defending: 4, physicality: 4 });
    expect(tallyVotes([unanimous, unanimous, unanimous])).toEqual(unanimous);
  });

  it('averages and rounds half-way values up', () => {
    // pace: (3+4)/2 = 3.5 -> rounds to 4.
    const a = ballot({ pace: 3 });
    const b = ballot({ pace: 4 });
    expect(tallyVotes([a, b]).pace).toBe(4);
  });

  it('averages a spread of ballots correctly per stat', () => {
    const a = ballot({ pace: 1, shooting: 5, passing: 3, dribbling: 3, defending: 3, physicality: 3 });
    const b = ballot({ pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3 });
    const c = ballot({ pace: 5, shooting: 1, passing: 3, dribbling: 3, defending: 3, physicality: 3 });
    // pace: (1+3+5)/3 = 3, shooting: (5+3+1)/3 = 3.
    expect(tallyVotes([a, b, c])).toEqual(ballot({ pace: 3, shooting: 3, passing: 3, dribbling: 3, defending: 3, physicality: 3 }));
  });

  it('clamps into the 1-5 range', () => {
    const min = ballot({ pace: 1 });
    const max = ballot({ pace: 5 });
    const result = tallyVotes([min, max]);
    expect(result.pace).toBeGreaterThanOrEqual(1);
    expect(result.pace).toBeLessThanOrEqual(5);
  });
});
