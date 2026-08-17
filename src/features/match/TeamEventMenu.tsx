import type { Team } from '../../types';

interface TeamEventMenuProps {
  teamAName: string;
  teamBName: string;
  onRecord: (type: 'CORNER' | 'THROW_IN', team: Team) => void;
  onCancel: () => void;
}

/** Referee popup for team-only events with no player to tap — corners and throw-ins. Reuses EventMenu's modal CSS verbatim. */
export function TeamEventMenu({ teamAName, teamBName, onRecord, onCancel }: TeamEventMenuProps) {
  return (
    <div className="sp-modal-backdrop" onClick={onCancel}>
      <div className="sp-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Record team event">
        <p className="sp-modal-panel__title">Team event</p>
        <div className="sp-modal-panel__actions">
          <button type="button" className="sp-btn" onClick={() => onRecord('CORNER', 'A')}>
            Corner — {teamAName}
          </button>
          <button type="button" className="sp-btn" onClick={() => onRecord('CORNER', 'B')}>
            Corner — {teamBName}
          </button>
          <button type="button" className="sp-btn" onClick={() => onRecord('THROW_IN', 'A')}>
            Throw-in — {teamAName}
          </button>
          <button type="button" className="sp-btn" onClick={() => onRecord('THROW_IN', 'B')}>
            Throw-in — {teamBName}
          </button>
          <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
