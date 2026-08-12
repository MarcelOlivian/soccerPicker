import { STAT_DESCRIPTIONS, STAT_LABELS } from '../types';
import type { StatKey, StatValue } from '../types';
import { Tooltip } from './Tooltip';

const LEVELS: StatValue[] = [1, 2, 3, 4, 5];

interface StatBlocksProps {
  statKey: StatKey;
  value: StatValue;
}

/**
 * Read-only 5-block stat row, e.g. "PAC ▮▮▮▯▯". Drawn as CSS rectangles
 * rather than unicode block glyphs — the empty-state glyph (▯) isn't in
 * JetBrains Mono and falls back to a mismatched tofu box in most browsers.
 */
export function StatBlocks({ statKey, value }: StatBlocksProps) {
  const label = STAT_LABELS[statKey];
  return (
    <span className="sp-stat-row">
      <Tooltip content={STAT_DESCRIPTIONS[statKey]}>
        <span className="sp-stat-row__label" tabIndex={0}>
          {label}
        </span>
      </Tooltip>
      <span className="sp-stat-row__blocks" aria-hidden="true">
        {LEVELS.map((level) => (
          <span key={level} className={`sp-block ${level <= value ? 'sp-block--on' : 'sp-block--off'}`} />
        ))}
      </span>
      <span className="sp-visually-hidden">
        {label}: {value} of 5
      </span>
    </span>
  );
}
