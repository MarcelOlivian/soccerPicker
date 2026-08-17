import { describe, expect, it } from 'vitest';
import { MIN_GAP_PX, PX_PER_DAY, buildTrajectoryGeometry, computeXPositions } from '../src/lib/trajectory';

const H = 100;
const DAY_MS = 86_400_000;

describe('computeXPositions', () => {
  it('returns [] for empty input', () => {
    expect(computeXPositions([], 28, 48)).toEqual([]);
  });

  it('a single timestamp maps to x=0', () => {
    expect(computeXPositions([1000], 28, 48)).toEqual([0]);
  });

  it('far-apart points keep true proportional spacing (above the gap floor)', () => {
    const xs = computeXPositions([0, 10 * DAY_MS], 28, 48);
    expect(xs[0]).toBe(0);
    expect(xs[1]).toBeCloseTo(280, 5);
  });

  it('close-together points are floored to minGapPx apart', () => {
    const xs = computeXPositions([0, 1000, 2000], 28, 48);
    expect(xs).toEqual([0, 48, 96]);
  });

  it('same-timestamp points (zero-span degenerate case) still space out by minGapPx', () => {
    const xs = computeXPositions([5000, 5000, 5000], 28, 48);
    expect(xs).toEqual([0, 48, 96]);
  });

  it('a cluster followed by one far point uses true proportional distance for the far point, not the floor', () => {
    const xs = computeXPositions([0, 60_000, 10 * DAY_MS], 28, 48);
    expect(xs[0]).toBe(0);
    expect(xs[1]).toBe(48);
    expect(xs[2]).toBeCloseTo(280, 5);
  });

  it('is never non-monotonic — each x is at least minGapPx past its predecessor', () => {
    const ats = [0, 500, 1_200_000, 1_200_500, 50 * DAY_MS, 50 * DAY_MS + 10];
    const xs = computeXPositions(ats, 28, 48);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] + 48);
    }
  });

  it('respects custom pxPerDay/minGapPx values', () => {
    const xs = computeXPositions([0, 5 * DAY_MS], 10, 20);
    expect(xs).toEqual([0, 50]);
  });
});

describe('buildTrajectoryGeometry', () => {
  it('returns hasData: false for empty input', () => {
    const geo = buildTrajectoryGeometry([], [], H);
    expect(geo.hasData).toBe(false);
    expect(geo.linePoints).toBe('');
    expect(geo.lineDots).toEqual([]);
    expect(geo.matchDots).toEqual([]);
    expect(geo.minOvr).toBe(0);
    expect(geo.maxOvr).toBe(0);
    expect(geo.width).toBe(0);
  });

  it('returns the padded y-domain actually used to scale the points', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 1000, ovr: 60 },
        { at: 2000, ovr: 70 },
      ],
      [{ at: 3000, ovr: 65 }],
      H,
    );
    // OVR_PADDING is 4: min 60 - 4 = 56, max 70 + 4 = 74.
    expect(geo.minOvr).toBe(56);
    expect(geo.maxOvr).toBe(74);
  });

  it('a single statPoint has hasData true, an empty linePoints, but one lineDot, and width = MIN_GAP_PX / 2', () => {
    const geo = buildTrajectoryGeometry([{ at: 1000, ovr: 70 }], [], H);
    expect(geo.hasData).toBe(true);
    expect(geo.linePoints).toBe('');
    expect(geo.lineDots).toHaveLength(1);
    expect(geo.lineDots[0].x).toBe(0);
    expect(geo.width).toBe(MIN_GAP_PX / 2);
  });

  it('two or more statPoints produce a non-empty linePoints with matching dot count', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 1000, ovr: 60 },
        { at: 2000, ovr: 70 },
        { at: 3000, ovr: 65 },
      ],
      [],
      H,
    );
    expect(geo.linePoints).not.toBe('');
    expect(geo.linePoints.split(' ')).toHaveLength(3);
    expect(geo.lineDots).toHaveLength(3);
  });

  it('matchPoints are scaled but never joined into linePoints', () => {
    const geo = buildTrajectoryGeometry([], [{ at: 1000, ovr: 70 }, { at: 2000, ovr: 80 }], H);
    expect(geo.linePoints).toBe('');
    expect(geo.matchDots).toHaveLength(2);
  });

  it('a zero-span time domain (all points share one timestamp) produces finite, non-NaN coordinates spaced by MIN_GAP_PX', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 5000, ovr: 60 },
        { at: 5000, ovr: 80 },
      ],
      [],
      H,
    );
    for (const p of geo.lineDots) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
    expect(Math.abs(geo.lineDots[1].x - geo.lineDots[0].x)).toBe(MIN_GAP_PX);
  });

  it('a zero-span OVR domain (all points share one rating) produces finite, non-NaN coordinates', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 1000, ovr: 70 },
        { at: 2000, ovr: 70 },
      ],
      [],
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
      H,
    );
    expect(geo.lineDots[1].x).toBeGreaterThan(geo.lineDots[0].x);
  });

  it('stat points and match points share one combined x/y domain', () => {
    const geo = buildTrajectoryGeometry(
      [{ at: 1000, ovr: 60 }],
      [{ at: 2000, ovr: 90 }],
      H,
    );
    // The match point (higher ovr, later at) should be up-and-right of the stat point.
    expect(geo.matchDots[0].x).toBeGreaterThan(geo.lineDots[0].x);
    expect(geo.matchDots[0].y).toBeLessThan(geo.lineDots[0].y);
  });

  it('stat and match dots sharing a timestamp are still pushed apart by MIN_GAP_PX, regardless of kind', () => {
    const geo = buildTrajectoryGeometry([{ at: 5000, ovr: 60 }], [{ at: 5000, ovr: 60 }], H);
    expect(Math.abs(geo.matchDots[0].x - geo.lineDots[0].x)).toBe(MIN_GAP_PX);
  });

  it('replicates the real screenshot scenario: several close points plus one far-later point', () => {
    // Three stat-history points minutes apart, then a match six months later.
    const base = 1_700_000_000_000;
    const geo = buildTrajectoryGeometry(
      [
        { at: base, ovr: 60 },
        { at: base + 5 * 60_000, ovr: 62 },
        { at: base + 10 * 60_000, ovr: 58 },
      ],
      [{ at: base + 180 * DAY_MS, ovr: 70 }],
      H,
    );
    // The three close points are each exactly MIN_GAP_PX apart.
    expect(geo.lineDots[1].x - geo.lineDots[0].x).toBe(MIN_GAP_PX);
    expect(geo.lineDots[2].x - geo.lineDots[1].x).toBe(MIN_GAP_PX);
    // The far point sits at its true proportional distance, not clamped to the floor.
    const expectedFarX = (180 * DAY_MS / DAY_MS) * PX_PER_DAY;
    expect(geo.matchDots[0].x).toBeCloseTo(expectedFarX, 0);
    expect(geo.matchDots[0].x - geo.lineDots[2].x).toBeGreaterThan(MIN_GAP_PX * 10);
  });

  it('width grows with a wider time span and with custom options', () => {
    const narrow = buildTrajectoryGeometry([{ at: 0, ovr: 60 }], [{ at: 1 * DAY_MS, ovr: 60 }], H);
    const wide = buildTrajectoryGeometry([{ at: 0, ovr: 60 }], [{ at: 365 * DAY_MS, ovr: 60 }], H);
    expect(wide.width).toBeGreaterThan(narrow.width);

    const customWide = buildTrajectoryGeometry([{ at: 0, ovr: 60 }], [{ at: 365 * DAY_MS, ovr: 60 }], H, { pxPerDay: 1 });
    expect(customWide.width).toBeLessThan(wide.width);
  });

  it('traces the polyline in chronological order even when statPoints is passed out of order', () => {
    const geo = buildTrajectoryGeometry(
      [
        { at: 3000, ovr: 70 },
        { at: 1000, ovr: 60 },
        { at: 2000, ovr: 65 },
      ],
      [],
      H,
    );
    const xs = geo.linePoints.split(' ').map((pair) => parseFloat(pair.split(',')[0]));
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });
});
