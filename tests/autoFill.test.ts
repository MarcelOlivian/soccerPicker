import { describe, expect, it } from 'vitest';
import { autoFillSlots } from '../src/lib/autoFill';
import type { SlotDef } from '../src/lib/formations';
import type { Player, StatValue } from '../src/types';

function makeSlot(id: string, position: SlotDef['position']): SlotDef {
  return { id, position, team: 'A', x: 0, y: 0 };
}

function makePlayer(id: string, stats: Partial<Record<keyof Player['stats'], StatValue>>): Player {
  const base: Player['stats'] = { pace: 1, stamina: 1, finishing: 1, defending: 1, passing: 1, goalkeeping: 1 };
  return { id, name: id, position: 'MID', stats: { ...base, ...stats }, createdAt: 0 };
}

describe('autoFillSlots', () => {
  it('assigns each specialist to the slot they best fit, benching the generalist', () => {
    // A natural keeper, a natural striker, and a jack-of-all-trades who's
    // decent everywhere but the best at nothing — with only 2 slots, the
    // optimal assignment uses the two specialists at their specialty and
    // benches the generalist, rather than settling for a "good enough"
    // generalist fit anywhere.
    const keeper = makePlayer('keeper', { goalkeeping: 5 });
    const striker = makePlayer('striker', { finishing: 5, pace: 5 });
    const utility = makePlayer('utility', { pace: 3, stamina: 3, finishing: 3, defending: 3, passing: 3 });
    const slots = [makeSlot('gk', 'GK'), makeSlot('att', 'ATT')];

    const result = autoFillSlots([utility, keeper, striker], slots);

    expect(result).toEqual({ gk: 'keeper', att: 'striker' });
  });

  it('leaves excess players unassigned once every slot is filled', () => {
    const players = [makePlayer('p1', {}), makePlayer('p2', {}), makePlayer('p3', {})];
    const slots = [makeSlot('def1', 'DEF')];
    const result = autoFillSlots(players, slots);
    expect(Object.keys(result)).toHaveLength(1);
    expect(Object.values(result)[0]).toBeDefined();
  });

  it('fills as many slots as it can when there are fewer players than slots', () => {
    const players = [makePlayer('p1', {})];
    const slots = [makeSlot('def1', 'DEF'), makeSlot('def2', 'DEF')];
    const result = autoFillSlots(players, slots);
    expect(Object.keys(result)).toHaveLength(1);
    expect(Object.values(result)).toEqual(['p1']);
  });

  it('returns an empty assignment when there are no players or no slots', () => {
    expect(autoFillSlots([], [makeSlot('def1', 'DEF')])).toEqual({});
    expect(autoFillSlots([makePlayer('p1', {})], [])).toEqual({});
  });
});
