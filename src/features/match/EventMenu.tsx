import { useState } from 'react';
import type { Player } from '../../types';

interface EventMenuProps {
  player: Player;
  /** The scorer's team, currently placed on the pitch, excluding the scorer. */
  teammates: Player[];
  onRecordGoal: (isOwnGoal: boolean, assistPlayerId: string | null) => void;
  onRecordFoul: () => void;
  onCancel: () => void;
}

/**
 * Referee popup for a tapped, placed player in tracking mode. Nothing is
 * dispatched until either an immediate menu button (OWN GOAL/FOUL) fires or
 * an assist-step choice is made — the "GOAL" menu button only moves to the
 * assist step, it doesn't record anything by itself, so Cancel there is a
 * true cancel, not a partial undo.
 */
export function EventMenu({ player, teammates, onRecordGoal, onRecordFoul, onCancel }: EventMenuProps) {
  const [step, setStep] = useState<'menu' | 'assist'>('menu');

  return (
    <div className="sp-modal-backdrop" onClick={onCancel}>
      <div className="sp-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Record event for ${player.name}`}>
        {step === 'menu' ? (
          <>
            <p className="sp-modal-panel__title">{player.name}</p>
            <div className="sp-modal-panel__actions">
              <button type="button" className="sp-btn sp-btn--primary" onClick={() => setStep('assist')}>
                Goal
              </button>
              <button type="button" className="sp-btn" onClick={() => onRecordGoal(true, null)}>
                Own goal
              </button>
              <button type="button" className="sp-btn sp-btn--danger" onClick={onRecordFoul}>
                Foul
              </button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sp-modal-panel__title">Who assisted?</p>
            <div className="sp-modal-panel__actions">
              {teammates.map((t) => (
                <button type="button" className="sp-btn" key={t.id} onClick={() => onRecordGoal(false, t.id)}>
                  {t.name}
                </button>
              ))}
              <button type="button" className="sp-btn sp-btn--ghost" onClick={() => onRecordGoal(false, null)}>
                No assist
              </button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
