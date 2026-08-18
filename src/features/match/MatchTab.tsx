import { useState } from 'react';
import { isComplete } from '../../lib/draft';
import { totalPlayers } from '../../lib/formations';
import { useAppState } from '../../state/AppContext';
import { useLive } from '../../state/LiveContext';
import { AttendanceStage } from './AttendanceStage';
import { BoardStage } from './BoardStage';
import { DraftStage } from './DraftStage';
import { GoLivePanel } from './GoLivePanel';
import { JoinScreen } from './JoinScreen';

type Stage = 'attendance' | 'draft' | 'board';

const STAGES: { id: Stage; label: string }[] = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'draft', label: 'Draft' },
  { id: 'board', label: 'Field' },
];

interface MatchTabProps {
  onNavigateToHistory: () => void;
}

export function MatchTab({ onNavigateToHistory }: MatchTabProps) {
  const [stage, setStage] = useState<Stage>('attendance');
  const { role, synced } = useLive();
  const { state } = useAppState();
  const attendanceReady = state.match.attendingIds.length === totalPlayers(state.match.formation);
  const draftComplete = isComplete(state.match.attendingIds, state.match.draft.picks);

  // Captain B hasn't received the host's roster/match yet — nothing else is
  // renderable until then, since the board/draft views read from state that
  // HELLO is responsible for populating.
  if (role === 'client' && !synced) {
    return (
      <div className="sp-match-tab">
        <JoinScreen />
      </div>
    );
  }

  return (
    <div className="sp-match-tab">
      {role !== 'client' && <GoLivePanel />}
      {stage !== 'board' && role !== 'host' && <JoinScreen />}

      <nav className="sp-breadcrumb" aria-label="Match stage">
        {STAGES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            disabled={(s.id === 'draft' && !attendanceReady) || (s.id === 'board' && !draftComplete)}
            className={`sp-breadcrumb__step ${stage === s.id ? 'sp-breadcrumb__step--active' : ''} ${
              s.id === 'board' && draftComplete ? 'sp-breadcrumb__step--ready' : ''
            }`}
            onClick={() => setStage(s.id)}
          >
            {i + 1}. {s.label.toUpperCase()}
          </button>
        ))}
      </nav>

      {stage === 'attendance' &&
        (role === 'client' ? (
          <div className="sp-panel">
            <p className="sp-hint">The host controls attendance and formation.</p>
          </div>
        ) : (
          <AttendanceStage onContinue={() => setStage('draft')} />
        ))}
      {stage === 'draft' && <DraftStage onContinue={() => setStage('board')} />}
      {stage === 'board' && (
        <BoardStage onStartNewMatch={() => setStage('attendance')} onNavigateToHistory={onNavigateToHistory} />
      )}
    </div>
  );
}
