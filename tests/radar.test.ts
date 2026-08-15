import { describe, expect, it } from 'vitest';
import { radarAxisAngle, radarPoint, ringPolygonPoints, statsPolygonPoints } from '../src/lib/radar';
import { emptyStats } from '../src/types';
import type { PlayerStats } from '../src/types';

describe('radarAxisAngle', () => {
  it('axis 0 points straight up', () => {
    expect(radarAxisAngle(0)).toBeCloseTo(-Math.PI / 2);
  });

  it('spaces all 6 axes evenly', () => {
    const step = (2 * Math.PI) / 6;
    for (let i = 1; i < 6; i++) {
      expect(radarAxisAngle(i) - radarAxisAngle(i - 1)).toBeCloseTo(step);
    }
  });
});

describe('radarPoint', () => {
  it('maps the max value onto the outer ring along the axis direction', () => {
    const p = radarPoint(0, 5, 100);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-100);
  });

  it('maps value 0 to the center regardless of axis', () => {
    for (let i = 0; i < 6; i++) {
      const p = radarPoint(i, 0, 100);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    }
  });
});

describe('statsPolygonPoints', () => {
  it('produces exactly 6 coordinate pairs', () => {
    const stats: PlayerStats = { ...emptyStats(), pace: 3, shooting: 4 };
    const points = statsPolygonPoints(stats, 100).split(' ');
    expect(points).toHaveLength(6);
    for (const pair of points) {
      expect(pair.split(',')).toHaveLength(2);
    }
  });
});

describe('ringPolygonPoints', () => {
  it('produces exactly 6 coordinate pairs for a grid ring', () => {
    const points = ringPolygonPoints(3, 100).split(' ');
    expect(points).toHaveLength(6);
  });
});
