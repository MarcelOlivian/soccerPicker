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
  /** Scaled coordinates for each statHistory point (marker circles on the line), in the same order as the `statPoints` argument. */
  lineDots: ScaledPoint[];
  /** Scaled coordinates for each match-appearance dot (never connected by a line — the frozen HistoryPlayerSnapshot.overall is exact, not interpolated), in the same order as the `matchPoints` argument. */
  matchDots: ScaledPoint[];
  /** False only when both point sets are empty — renders an empty-state message instead. */
  hasData: boolean;
  /** The padded y-domain actually used to scale every point — for axis tick labels. Both 0 when hasData is false. */
  minOvr: number;
  maxOvr: number;
  /**
   * Total inner pixel width needed to place every point without violating
   * minGapPx — grows unboundedly with the data (no upper cap), which is why
   * the chart is wrapped in a horizontally-scrollable container rather than
   * squeezed into a fixed panel width. 0 when hasData is false.
   */
  width: number;
}

const OVR_PADDING = 4;
const DAY_MS = 86_400_000;

/** Horizontal pixels per elapsed calendar day at "natural" (uncollided) spacing — preserves a true linear timeline for points that are genuinely far apart. */
export const PX_PER_DAY = 28;
/** Minimum horizontal pixels between any two chronologically-adjacent points, regardless of how close their timestamps are — enough room for a 2-digit OVR label and a short DD/MM date label without touching a neighbor's. */
export const MIN_GAP_PX = 48;

/**
 * Assigns x pixel positions to chronologically-sorted timestamps. Each
 * point's "natural" position is proportional to elapsed days since the
 * first point (`ats[0]`), preserving a true linear timeline for points far
 * apart in time — but a point is never placed closer than `minGapPx` after
 * its predecessor, a monotonic left-to-right floor that pushes
 * close-together points apart just enough to avoid overlapping dots/labels,
 * without disturbing points that are already far enough apart naturally.
 *
 * `ats` MUST already be sorted ascending — this function does not sort, so
 * that callers can align the result back to points tagged with their
 * original (pre-sort) index.
 */
export function computeXPositions(ats: number[], pxPerDay: number, minGapPx: number): number[] {
  if (ats.length === 0) return [];
  const xs: number[] = [0];
  for (let i = 1; i < ats.length; i++) {
    const raw = ((ats[i] - ats[0]) / DAY_MS) * pxPerDay;
    xs.push(Math.max(raw, xs[i - 1] + minGapPx));
  }
  return xs;
}

interface TaggedPoint extends TrajectoryPoint {
  kind: 'stat' | 'match';
  /** Index into the original statPoints/matchPoints array this point came from. */
  idx: number;
}

/**
 * Scales a chronological statHistory OVR trajectory plus separate
 * match-appearance OVR dots onto a shared y-domain (min..max OVR across
 * both sets, padded) and a collision-avoiding x-domain (see
 * computeXPositions) whose total pixel width is returned for the caller to
 * size a scrollable SVG. There is no fixed input width — a season of
 * close-together points can legitimately need more horizontal room than
 * any fixed panel, and that's the caller's (TrajectoryChart's) problem to
 * solve with a scroll wrapper, not this function's.
 *
 * A zero-span y-domain (all points share one OVR) is widened to a nominal
 * window instead of dividing by zero, centering the point(s) rather than
 * crashing or pinning them to an edge. A zero-span *time* domain needs no
 * such special-casing anymore — computeXPositions's minGapPx floor already
 * spaces same-timestamp points apart correctly as a degenerate case of
 * "very close together."
 */
export function buildTrajectoryGeometry(
  statPoints: TrajectoryPoint[],
  matchPoints: TrajectoryPoint[],
  height: number,
  options: { pxPerDay?: number; minGapPx?: number } = {},
): TrajectoryGeometry {
  const all = [...statPoints, ...matchPoints];
  if (all.length === 0) return { linePoints: '', lineDots: [], matchDots: [], hasData: false, minOvr: 0, maxOvr: 0, width: 0 };

  const pxPerDay = options.pxPerDay ?? PX_PER_DAY;
  const minGapPx = options.minGapPx ?? MIN_GAP_PX;

  let minOvr = Math.min(...all.map((p) => p.ovr)) - OVR_PADDING;
  let maxOvr = Math.max(...all.map((p) => p.ovr)) + OVR_PADDING;
  if (minOvr === maxOvr) {
    minOvr -= 1;
    maxOvr += 1;
  }
  const scaleY = (ovr: number) => height - ((ovr - minOvr) / (maxOvr - minOvr)) * height; // SVG y grows downward; OVR grows upward.

  const tagged: TaggedPoint[] = [
    ...statPoints.map((p, idx): TaggedPoint => ({ ...p, kind: 'stat', idx })),
    ...matchPoints.map((p, idx): TaggedPoint => ({ ...p, kind: 'match', idx })),
  ].sort((a, b) => a.at - b.at); // stable sort — ties keep stat-before-match / original relative order.

  const xs = computeXPositions(
    tagged.map((p) => p.at),
    pxPerDay,
    minGapPx,
  );

  const lineDots: ScaledPoint[] = Array.from({ length: statPoints.length });
  const matchDots: ScaledPoint[] = Array.from({ length: matchPoints.length });
  tagged.forEach((p, i) => {
    const scaled = { x: xs[i], y: scaleY(p.ovr) };
    if (p.kind === 'stat') lineDots[p.idx] = scaled;
    else matchDots[p.idx] = scaled;
  });

  // Trace the line in true chronological order (from the sorted `tagged`
  // array) rather than trusting statPoints's input order — cheap, and
  // removes an implicit ordering assumption the old code silently relied on.
  const chronologicalLineDots = tagged.filter((p) => p.kind === 'stat').map((p) => lineDots[p.idx]);
  const linePoints = statPoints.length >= 2 ? chronologicalLineDots.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') : '';

  const width = xs[xs.length - 1] + minGapPx / 2; // trailing padding so the last dot/label isn't flush against the SVG's right edge.

  return { linePoints, lineDots, matchDots, hasData: true, minOvr, maxOvr, width };
}
