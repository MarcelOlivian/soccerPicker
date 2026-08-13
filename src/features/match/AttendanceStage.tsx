import { FORMATION_IDS, FORMATION_LABELS, totalPlayers } from '../../lib/formations';
import { useAppState } from '../../state/AppContext';
import type { FormationId } from '../../types';

interface AttendanceStageProps {
  onContinue: () => void;
}

export function AttendanceStage({ onContinue }: AttendanceStageProps) {
  const { state, dispatch } = useAppState();
  const { match, players } = state;
  const need = totalPlayers(match.formation);
  const have = match.attendingIds.length;
  const short = have < need;

  function setFormation(formation: FormationId) {
    dispatch({ type: 'SET_FORMATION', formation });
  }

  function toggle(id: string) {
    dispatch({ type: 'TOGGLE_ATTENDING', id });
  }

  return (
    <div className="sp-stage">
      <div className="sp-panel">
        <h3>Formation</h3>
        <div className="sp-formation-select">
          {FORMATION_IDS.map((f) => (
            <button
              key={f}
              type="button"
              className={`sp-btn ${match.formation === f ? 'sp-btn--primary' : ''}`}
              onClick={() => setFormation(f)}
            >
              {FORMATION_LABELS[f]}
            </button>
          ))}
        </div>
        <p className={`sp-hint ${short ? 'sp-hint--warn' : ''}`}>
          {FORMATION_LABELS[match.formation]} plays best with {need} ({need / 2} per team). {have} attending
          tonight.
        </p>
      </div>

      <div className="sp-panel">
        <h3>Who's here tonight?</h3>
        {players.length === 0 ? (
          <p className="sp-hint">No players in the database yet — add some in the Setup tab first.</p>
        ) : (
          <div className="sp-attendance-list">
            {players.map((p) => (
              <label key={p.id} className="sp-attendance-row">
                <input
                  type="checkbox"
                  checked={match.attendingIds.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="sp-attendance-row__name">
                  {p.name}
                  {p.nickname && <span className="sp-card__nickname"> ({p.nickname})</span>}
                </span>
                <span className="sp-badge">{p.position}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="sp-stage__actions">
        <button type="button" className="sp-btn sp-btn--primary" disabled={have < 2} onClick={onContinue}>
          Continue to draft →
        </button>
      </div>
    </div>
  );
}
