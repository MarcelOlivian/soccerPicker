import { useState } from 'react';
import type { FoulType, Player, RestartType } from '../../types';

interface EventMenuProps {
  player: Player;
  /** The scorer's team, currently placed on the pitch, excluding the scorer. */
  teammates: Player[];
  /** Whether the tapped player currently occupies the GK slot — gates whether "Save" appears. */
  isGoalkeeper: boolean;
  /** Opposing team's currently-placed outfield players (their GK excluded) — the save-shooter step's options. */
  opposingOnPitch: Player[];
  onRecordGoal: (isOwnGoal: boolean, assistPlayerId: string | null) => void;
  onRecordFoul: (foulType: FoulType, restart: RestartType) => void;
  onRecordSave: (shooterId: string | null) => void;
  onCancel: () => void;
}

type Step = 'menu' | 'assist' | 'foul-type' | 'foul-restart' | 'save-shooter';

/**
 * Referee popup for a tapped, placed player in tracking mode. Nothing is
 * dispatched until a terminal choice fires — "Goal" only moves to the assist
 * step, "Foul" only moves to the foul-type step (then the restart step), so
 * Cancel at any intermediate step is a true cancel, not a partial undo.
 */
export function EventMenu({
  player,
  teammates,
  isGoalkeeper,
  opposingOnPitch,
  onRecordGoal,
  onRecordFoul,
  onRecordSave,
  onCancel,
}: EventMenuProps) {
  const [step, setStep] = useState<Step>('menu');
  const [pendingFoulType, setPendingFoulType] = useState<FoulType | null>(null);

  function chooseFoulType(foulType: FoulType) {
    setPendingFoulType(foulType);
    setStep('foul-restart');
  }

  function chooseRestart(restart: RestartType) {
    if (!pendingFoulType) return; // unreachable: foul-restart is only entered via chooseFoulType
    onRecordFoul(pendingFoulType, restart);
  }

  return (
    <div className="sp-modal-backdrop" onClick={onCancel}>
      <div className="sp-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Record event for ${player.name}`}>
        {step === 'menu' && (
          <>
            <p className="sp-modal-panel__title">{player.name}</p>
            <div className="sp-modal-panel__actions">
              <button type="button" className="sp-btn sp-btn--primary" onClick={() => setStep('assist')}>
                Goal
              </button>
              <button type="button" className="sp-btn" onClick={() => onRecordGoal(true, null)}>
                Own goal
              </button>
              {isGoalkeeper && (
                <button type="button" className="sp-btn" onClick={() => setStep('save-shooter')}>
                  Save
                </button>
              )}
              <button type="button" className="sp-btn sp-btn--danger" onClick={() => setStep('foul-type')}>
                Foul
              </button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}
        {step === 'assist' && (
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
        {step === 'foul-type' && (
          <>
            <p className="sp-modal-panel__title">What kind of foul?</p>
            <div className="sp-modal-panel__actions">
              <button type="button" className="sp-btn" onClick={() => chooseFoulType('HANDBALL')}>
                Handball
              </button>
              <button type="button" className="sp-btn" onClick={() => chooseFoulType('FOUL_PLAY')}>
                Foul Play
              </button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}
        {step === 'foul-restart' && (
          <>
            <p className="sp-modal-panel__title">Restart?</p>
            <div className="sp-modal-panel__actions">
              <button type="button" className="sp-btn" onClick={() => chooseRestart('FREE_KICK')}>
                Free Kick
              </button>
              <button type="button" className="sp-btn" onClick={() => chooseRestart('PENALTY')}>
                Penalty
              </button>
              <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
                Cancel
              </button>
            </div>
          </>
        )}
        {step === 'save-shooter' && (
          <>
            <p className="sp-modal-panel__title">Who attempted to score?</p>
            <div className="sp-modal-panel__actions">
              {opposingOnPitch.map((p) => (
                <button type="button" className="sp-btn" key={p.id} onClick={() => onRecordSave(p.id)}>
                  {p.name}
                </button>
              ))}
              <button type="button" className="sp-btn sp-btn--ghost" onClick={() => onRecordSave(null)}>
                Unclear
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
