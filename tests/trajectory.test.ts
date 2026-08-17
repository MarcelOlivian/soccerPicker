import { describe, expect, it } from 'vitest';
import { buildTrajectoryGeometry } from '../src/lib/trajectory';

const W = 300;
const H = 100;

describe('buildTrajectoryGeometry', () => {
  it('returns hasData: false for empty input', () => {
    const geo = buildTrajectoryGeometry([], [], W, H);
    expect(geo.hasData).toBe(false);
    expect(geo.linePoints).toBe('');
    expect(geo.lineDots).toEqual([]);
    expect(geo.matchDots).toEqual([]);
  });

  it('a single statPoint has hasData true, an empty linePoints, but one lineDot', () => {
    const geo = buildTrajectoryGeometry([{ at: 1000, ovr: 70 }], [], W, H);
    expect(geo.hasData).toBe(true);
    expect(geo.linePoints).toBe('');
    expect(geo.lineDots).toHaveLength(1);
  });

  it('two or more statPoints produce a non-empty linePoints with matching dot count', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 1000, ovr: 60 },
        { at: 2000, ovr: 70 },
        { at: 3000, ovr: 65 },
      ],
      [],
      W,
      H,
    );
    expect(geo.linePoints).not.toBe('');
    expect(geo.linePoints.split(' ')).toHaveLength(3);
    expect(geo.lineDots).toHaveLength(3);
  });

  it('matchPoints are scaled but never joined into linePoints', () => {
    const geo = buildTrajectoryGeometry([], [{ at: 1000, ovr: 70 }, { at: 2000, ovr: 80 }], W, H);
    expect(geo.linePoints).toBe('');
    expect(geo.matchDots).toHaveLength(2);
  });

  it('a zero-span time domain (all points share one timestamp) produces finite, non-NaN coordinates', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 5000, ovr: 60 },
        { at: 5000, ovr: 80 },
      ],
      [],
      W,
      H,
    );
    for (const p of geo.lineDots) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('a zero-span OVR domain (all points share one rating) produces finite, non-NaN coordinates', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 1000, ovr: 70 },
        { at: 2000, ovr: 70 },
      ],
      [],
      W,
      H,
    );
    for (const p of geo.lineDots) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('a higher OVR maps to a smaller y (SVG y grows downward, OVR grows upward)', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 1000, ovr: 60 },
        { at: 2000, ovr: 90 },
      ],
      [],
      W,
      H,
    );
    expect(geo.lineDots[1].y).toBeLessThan(geo.lineDots[0].y);
  });

  it('a later timestamp maps to a larger x', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 1000, ovr: 70 },
        { at: 5000, ovr: 70 },
      ],
      [],
      W,
      H,
    );
    expect(geo.lineDots[1].x).toBeGreaterThan(geo.lineDots[0].x);
  });

  it('stat points and match points share one combined x/y domain', () => {
    const geo = buildTrajectoryGeometry(
      [{ at: 1000, ovr: 60 }],
      [{ at: 2000, ovr: 90 }],
      W,
      H,
    );
    // The match point (higher ovr, later at) should be up-and-right of the stat point.
    expect(geo.matchDots[0].x).toBeGreaterThan(geo.lineDots[0].x);
    expect(geo.matchDots[0].y).toBeLessThan(geo.lineDots[0].y);
  });
});
