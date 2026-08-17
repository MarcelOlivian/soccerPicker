import { buildTrajectoryGeometry } from '../lib/trajectory';
import type { TrajectoryPoint } from '../lib/trajectory';

interface TrajectoryChartProps {
  statPoints: TrajectoryPoint[];
  matchPoints: TrajectoryPoint[];
}

const WIDTH = 320;
const HEIGHT = 120;
const PADDING = 12;
// Wider than PADDING on the left so the two-digit OVR tick labels have room
// without overlapping the y-axis line.
const PADDING_LEFT = 22;
// Taller than PADDING on top so the "OVR" axis title and the max-value tick
// label sit on their own separate lines instead of overlapping each other.
const PADDING_TOP = 22;

/**
 * Inline SVG OVR-over-time line chart — mirrors RadarChart.tsx's hairline,
 * no-gradient/no-shadow line-art style. The line tracks statHistory (voted
 * / edited / suggestion-accepted OVR, always computed at the player's
 * *current* preferred position for a consistent y-axis); small hollow
 * circles mark individual match-appearance OVRs (the frozen
 * HistoryPlayerSnapshot.overall) — never interpolated onto the line.
 */
export function TrajectoryChart({ statPoints, matchPoints }: TrajectoryChartProps) {
  const innerWidth = WIDTH - PADDING_LEFT - PADDING;
  const innerHeight = HEIGHT - PADDING_TOP - PADDING;
  const geo = buildTrajectoryGeometry(statPoints, matchPoints, innerWidth, innerHeight);

  if (!geo.hasData) {
    return (
      <p className="sp-hint">
        No stat or match history yet — this player's trajectory appears after their first vote, edit, or saved match.
      </p>
    );
  }

  return (
    <>
      <svg className="sp-trajectory-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Overall rating over time">
        <text x={2} y={9} fontSize="9" fontWeight="700" fill="var(--sp-muted)">
          OVR
        </text>
        <text x={PADDING_LEFT - 4} y={PADDING_TOP + 3} fontSize="9" textAnchor="end" fill="var(--sp-muted)">
          {Math.round(geo.maxOvr)}
        </text>
        <text x={PADDING_LEFT - 4} y={PADDING_TOP + innerHeight} fontSize="9" textAnchor="end" fill="var(--sp-muted)">
          {Math.round(geo.minOvr)}
        </text>
        <g transform={`translate(${PADDING_LEFT} ${PADDING_TOP})`}>
          <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="var(--sp-line-faint)" strokeWidth="0.5" />
          <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="var(--sp-line-faint)" strokeWidth="0.5" />
          {geo.linePoints && <polyline points={geo.linePoints} fill="none" stroke="var(--sp-accent)" strokeWidth="1.5" />}
          {geo.lineDots.map((p, i) => (
            <g key={`line-${i}`}>
              <circle cx={p.x} cy={p.y} r={2.5} fill="var(--sp-accent)" />
              <text x={p.x} y={p.y < 10 ? p.y + 11 : p.y - 5} fontSize="7" textAnchor="middle" fill="var(--sp-muted)">
                {Math.round(statPoints[i].ovr)}
              </text>
            </g>
          ))}
          {geo.matchDots.map((p, i) => (
            <g key={`match-${i}`}>
              <circle cx={p.x} cy={p.y} r={2} fill="var(--sp-bg)" stroke="var(--sp-muted)" strokeWidth="1" />
              <text x={p.x} y={p.y < 10 ? p.y + 11 : p.y - 5} fontSize="7" textAnchor="middle" fill="var(--sp-muted)">
                {Math.round(matchPoints[i].ovr)}
              </text>
            </g>
          ))}
          {geo.lineDots.length === 0 && geo.matchDots.length === 1 && (
            <circle cx={geo.matchDots[0].x} cy={geo.matchDots[0].y} r={3} fill="var(--sp-accent)" />
          )}
        </g>
      </svg>
      <ul className="sp-trajectory-chart__legend">
        <li>
          <span className="sp-trajectory-chart__dot sp-trajectory-chart__dot--history" /> Rating change
        </li>
        <li>
          <span className="sp-trajectory-chart__dot sp-trajectory-chart__dot--match" /> Match played
        </li>
      </ul>
    </>
  );
}
