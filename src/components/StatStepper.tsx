import type { StatValue } from '../types';

const LEVELS: StatValue[] = [1, 2, 3, 4, 5];

interface StatStepperProps {
  label: string;
  value: StatValue;
  onChange: (value: StatValue) => void;
}

/** Interactive stat editor: click a block to set the level directly. Same CSS blocks as StatBlocks, just clickable. */
export function StatStepper({ label, value, onChange }: StatStepperProps) {
  return (
    <div className="sp-stepper">
      <span className="sp-stepper__label">{label}</span>
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
