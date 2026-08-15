import { radarPoint, ringPolygonPoints, statsPolygonPoints } from '../lib/radar';
import { STAT_KEYS, STAT_LABELS } from '../types';
import type { PlayerStats } from '../types';

export interface RadarSeries {
  label: string;
  color: string;
  values: PlayerStats;
}

interface RadarChartProps {
  series: RadarSeries[];
  /**
   * Hides the PAC/SHO/PAS/DRI/DEF/PHY axis labels — needed at compact-card
   * sizes (~90-130px) where six labels would be illegible. Defaults true,
   * matching the large comparison-panel/full-roster-card use case.
   */
  showAxisLabels?: boolean;
}

const VIEW = 200;
const CENTER = VIEW / 2;
const RADIUS = 78;
const LABEL_RADIUS = RADIUS + 16;
const GRID_LEVELS = [1, 2, 3, 4, 5];

/** Inline SVG spider/radar chart, matching Pitch.tsx's hairline line-art style — no gradients, no shadows, viewBox-scaled so it fills whatever width its container gives it. */
export function RadarChart({ series, showAxisLabels = true }: RadarChartProps) {
  return (
    <svg className="sp-radar-chart" viewBox={`0 0 ${VIEW} ${VIEW}`} role="img" aria-label="Stats radar chart">
      <g transform={`translate(${CENTER} ${CENTER})`}>
        {GRID_LEVELS.map((level) => (
          <polygon
            key={level}
            points={ringPolygonPoints(level, RADIUS)}
            fill="none"
            stroke="var(--sp-line-faint)"
            strokeWidth="0.5"
          />
        ))}
        {STAT_KEYS.map((key, i) => {
          const p = radarPoint(i, 5, RADIUS);
          return <line key={key} x1={0} y1={0} x2={p.x} y2={p.y} stroke="var(--sp-line-faint)" strokeWidth="0.5" />;
        })}
        {series.map((s) => (
          <polygon
            key={s.label}
            points={statsPolygonPoints(s.values, RADIUS)}
            fill={s.color}
            fillOpacity="0.15"
            stroke={s.color}
            strokeWidth="1.5"
          />
        ))}
      </g>
      {showAxisLabels &&
        STAT_KEYS.map((key, i) => {
          const p = radarPoint(i, 5, LABEL_RADIUS);
          const anchor = p.x > 4 ? 'start' : p.x < -4 ? 'end' : 'middle';
          return (
            <text
              key={key}
              x={CENTER + p.x}
              y={CENTER + p.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="9"
              fontWeight="700"
              fill="var(--sp-muted)"
            >
              {STAT_LABELS[key]}
            </text>
          );
        })}
    </svg>
  );
}
