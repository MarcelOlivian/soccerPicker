export interface TrajectoryPoint {
  at: number;
  ovr: number;
}

export interface ScaledPoint {
  x: number;
  y: number;
}

export interface TrajectoryGeometry {
  /** SVG polyline `points` for the statHistory OVR line — '' when fewer than 2 statHistory points. */
  linePoints: string;
  /** Scaled coordinates for each statHistory point (marker circles on the line). */
  lineDots: ScaledPoint[];
  /** Scaled coordinates for each match-appearance dot (never connected by a line — the frozen HistoryPlayerSnapshot.overall is exact, not interpolated). */
  matchDots: ScaledPoint[];
  /** False only when both point sets are empty — renders an empty-state message instead. */
  hasData: boolean;
}

const OVR_PADDING = 4;
const DAY_MS = 86_400_000;

/**
 * Scales a chronological statHistory OVR trajectory plus separate
 * match-appearance OVR dots onto one width x height viewBox. Both point
 * sets share one x-domain (min..max `at` across BOTH sets) and one y-domain
 * (min..max OVR across both, padded) so a match dot and a stat-history
 * point line up correctly relative to each other. A zero-span domain (a
 * single distinct timestamp, or a single distinct OVR) is widened to a
 * nominal window instead of dividing by zero, centering the lone point
 * rather than crashing or pinning it to an edge.
 */
export function buildTrajectoryGeometry(
  statPoints: TrajectoryPoint[],
  matchPoints: TrajectoryPoint[],
  width: number,
  height: number,
): TrajectoryGeometry {
  const all = [...statPoints, ...matchPoints];
  if (all.length === 0) return { linePoints: '', lineDots: [], matchDots: [], hasData: false };

  let minAt = Math.min(...all.map((p) => p.at));
  let maxAt = Math.max(...all.map((p) => p.at));
  if (minAt === maxAt) {
    minAt -= DAY_MS;
    maxAt += DAY_MS;
  }

  let minOvr = Math.min(...all.map((p) => p.ovr)) - OVR_PADDING;
  let maxOvr = Math.max(...all.map((p) => p.ovr)) + OVR_PADDING;
  if (minOvr === maxOvr) {
    minOvr -= 1;
    maxOvr += 1;
  }

  const scale = (p: TrajectoryPoint): ScaledPoint => ({
    x: ((p.at - minAt) / (maxAt - minAt)) * width,
    y: height - ((p.ovr - minOvr) / (maxOvr - minOvr)) * height, // SVG y grows downward; OVR grows upward.
  });

  const lineDots = statPoints.map(scale);
  const matchDots = matchPoints.map(scale);
  const linePoints = statPoints.length >= 2 ? lineDots.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') : '';

  return { linePoints, lineDots, matchDots, hasData: true };
}
