import { describe, expect, it } from 'vitest';
import { formationSlots, playersPerTeam, slotCoords, totalPlayers } from '../src/lib/formations';

/** Parses a "12.5%" style coordinate back into a 0..1 number. */
function pct(value: string): number {
  return Number(value.replace('%', '')) / 100;
}

describe('formations', () => {
  it('mirrors team B across the halfway line', () => {
    const slots = formationSlots('6');
    expect(slots).toHaveLength(totalPlayers('6'));
    expect(playersPerTeam('6')).toBe(6);

    const gkA = slots.find((s) => s.team === 'A' && s.position === 'GK')!;
    const gkB = slots.find((s) => s.team === 'B' && s.position === 'GK')!;
    expect(gkA.x).toBeCloseTo(1 - gkB.x);
    expect(gkA.y).toBeCloseTo(gkB.y);
  });

  describe('slotCoords', () => {
    it('uses the authored x/y in landscape', () => {
      const slot = { x: 0.06, y: 0.5 };
      expect(slotCoords(slot, false)).toEqual({ left: '6%', top: '50%' });
    });

    it('turns a quarter turn in portrait, putting team A at the top edge', () => {
      const slots = formationSlots('6');
      const gkA = slots.find((s) => s.team === 'A' && s.position === 'GK')!;
      const gkB = slots.find((s) => s.team === 'B' && s.position === 'GK')!;

      // A's goal is near the top, B's near the bottom — the halves are stacked,
      // not side by side.
      expect(pct(slotCoords(gkA, true).top)).toBeLessThan(0.1);
      expect(pct(slotCoords(gkB, true).top)).toBeGreaterThan(0.9);

      // Both keepers stay centred horizontally.
      expect(pct(slotCoords(gkA, true).left)).toBeCloseTo(0.5);
      expect(pct(slotCoords(gkB, true).left)).toBeCloseTo(0.5);
    });

    it('keeps every team A slot above every team B slot in portrait', () => {
      const slots = formationSlots('6');
      const tops = (team: 'A' | 'B') =>
        slots.filter((s) => s.team === team).map((s) => pct(slotCoords(s, true).top));
      expect(Math.max(...tops('A'))).toBeLessThan(Math.min(...tops('B')));
    });

    it('maps the same transform the pitch SVG applies: (x, y) -> (1 - y, x)', () => {
      const slot = { x: 0.2, y: 0.3 };
      const { left, top } = slotCoords(slot, true);
      expect(pct(left)).toBeCloseTo(0.7);
      expect(pct(top)).toBeCloseTo(0.2);
    });
  });
});
