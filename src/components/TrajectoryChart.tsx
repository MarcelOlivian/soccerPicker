import { buildTrajectoryGeometry } from '../lib/trajectory';
import type { TrajectoryPoint } from '../lib/trajectory';

interface TrajectoryChartProps {
  statPoints: TrajectoryPoint[];
  matchPoints: TrajectoryPoint[];
}

const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 12;

/**
 * Inline SVG OVR-over-time line chart — mirrors RadarChart.tsx's hairline,
 * no-gradient/no-shadow line-art style. The line tracks statHistory (voted
 * / edited / suggestion-accepted OVR, always computed at the player's
 * *current* preferred position for a consistent y-axis); small hollow
 * circles mark individual match-appearance OVRs (the frozen
 * HistoryPlayerSnapshot.overall) — never interpolated onto the line.
 */
export function TrajectoryChart({ statPoints, matchPoints }: TrajectoryChartProps) {
  const innerWidth = WIDTH - PADDING * 2;
  const innerHeight = HEIGHT - PADDING * 2;
  const geo = buildTrajectoryGeometry(statPoints, matchPoints, innerWidth, innerHeight);

  if (!geo.hasData) {
    return (
      <p className="sp-hint">
        No stat or match history yet — this player's trajectory appears after their first vote, edit, or saved match.
      </p>
    );
  }

  return (
    <svg className="sp-trajectory-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Overall rating over time">
      <g transform={`translate(${PADDING} ${PADDING})`}>
        <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--sp-line-faint)" strokeWidth="0.5" />
        <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--sp-line-faint)" strokeWidth="0.5" />
        {geo.linePoints && <polyline points={geo.linePoints} fill="none" stroke="var(--sp-accent)" strokeWidth="1.5" />}
        {geo.lineDots.map((p, i) => (
          <circle key={`line-${i}`} cx={p.x} cy={p.y} r={2.5} fill="var(--sp-accent)" />
        ))}
        {geo.matchDots.map((p, i) => (
          <circle key={`match-${i}`} cx={p.x} cy={p.y} r={2} fill="var(--sp-bg)" stroke="var(--sp-muted)" strokeWidth="1" />
        ))}
        {geo.lineDots.length === 0 && geo.matchDots.length === 1 && (
          <circle cx={geo.matchDots[0].x} cy={geo.matchDots[0].y} r={3} fill="var(--sp-accent)" />
        )}
      </g>
    </svg>
  );
}
