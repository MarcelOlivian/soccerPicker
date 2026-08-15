import { STAT_KEYS } from '../types';
import type { PlayerStats } from '../types';

export interface Point {
  x: number;
  y: number;
}

const AXIS_COUNT = STAT_KEYS.length; // 6
const STAT_MAX = 5; // StatValue upper bound

/**
 * Angle (radians) of axis `index` of `axisCount`, evenly spaced, starting
 * straight up (12 o'clock) and proceeding clockwise — standard radar/spider
 * chart convention.
 */
export function radarAxisAngle(index: number, axisCount: number = AXIS_COUNT): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / axisCount;
}

/**
 * Cartesian point for a given axis index/value, centered at (0,0). Value is
 * mapped linearly from [0, max] onto [0, radius] — value 0 sits at the
 * center, value `max` sits exactly on the outer ring. No real stat is ever
 * 0 (StatValue is 1-5), so the innermost visible ring is level 1, never the
 * dead center.
 */
export function radarPoint(
  index: number,
  value: number,
  radius: number,
  max: number = STAT_MAX,
  axisCount: number = AXIS_COUNT,
): Point {
  const angle = radarAxisAngle(index, axisCount);
  const r = (value / max) * radius;
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

function pointsAttr(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

/** SVG `<polygon>` `points` attribute for one player's full 6-stat shape, centered at (0,0). */
export function statsPolygonPoints(stats: PlayerStats, radius: number): string {
  return pointsAttr(STAT_KEYS.map((key, i) => radarPoint(i, stats[key], radius)));
}

/** Points for one background grid ring at a whole stat level (1-5), for the faint reference hexagons. */
export function ringPolygonPoints(level: number, radius: number): string {
  return pointsAttr(Array.from({ length: AXIS_COUNT }, (_, i) => radarPoint(i, level, radius)));
}
