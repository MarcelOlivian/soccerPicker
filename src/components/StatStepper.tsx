import { STAT_DESCRIPTIONS, STAT_LABELS } from '../types';
import type { StatKey, StatValue } from '../types';
import { Tooltip } from './Tooltip';

const LEVELS: StatValue[] = [1, 2, 3, 4, 5];

interface StatStepperProps {
  statKey: StatKey;
  value: StatValue;
  onChange: (value: StatValue) => void;
}

/** Interactive stat editor: click a block to set the level directly. Same CSS blocks as StatBlocks, just clickable. */
export function StatStepper({ statKey, value, onChange }: StatStepperProps) {
  const label = STAT_LABELS[statKey];
  return (
    <div className="sp-stepper">
      <Tooltip content={STAT_DESCRIPTIONS[statKey]}>
        <span className="sp-stepper__label" tabIndex={0}>
          {label}
        </span>
      </Tooltip>
      <div className="sp-stepper__blocks" role="radiogroup" aria-label={label}>
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            aria-label={`${label} ${level} of 5`}
            className={`sp-block sp-stepper__block ${level <= value ? 'sp-block--on' : 'sp-block--off'}`}
            onClick={() => onChange(level)}
          />
        ))}
      </div>
    </div>
  );
}
