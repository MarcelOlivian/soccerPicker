import { SessionShare } from '../../components/SessionShare';
import { useVoting } from '../../state/VotingContext';
import type { PlayerStats } from '../../types';
import { VotingPanel } from './VotingPanel';

interface VoteHostPanelProps {
  /** Called with the rounded-average stats once the host chooses to bring them into the player form. */
  onApplyStats: (stats: PlayerStats) => void;
}

/** Host-side view of a stats-voting session: share the code, watch/cast ballots, reveal, and bring the result into the form. */
export function VoteHostPanel({ onApplyStats }: VoteHostPanelProps) {
  const voting = useVoting();

  if (voting.role !== 'host') return null;

  const pendingCount = voting.voters.filter((v) => !v.hasVoted).length;

  function handleReveal() {
    if (pendingCount > 0) {
      const noun = pendingCount === 1 ? 'voter hasn\'t' : 'voters haven\'t';
      if (!confirm(`${pendingCount} ${noun} voted yet. Reveal anyway?`)) return;
    }
    voting.reveal();
  }

  function handleUseStats() {
    if (voting.tally) onApplyStats(voting.tally);
    voting.endVote();
  }

  return (
    <div className="sp-panel sp-vote-host-panel">
      <div className="sp-live-panel__head">
        <h4>Stats vote</h4>
        <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={voting.endVote}>
          Cancel vote
        </button>
      </div>

      <SessionShare sessionCode={voting.sessionCode ?? ''} fragmentKey="vote" qrAltText="QR code to join this stats vote">
        <p className="sp-hint">
          {voting.status === 'connecting' && 'Setting up…'}
          {voting.status === 'open' && 'Share the code or QR above so others can join.'}
          {voting.status === 'error' && (voting.errorMessage ?? 'Could not reach the sync broker.')}
          {voting.status === 'closed' && 'Connection closed — trying to reconnect…'}
        </p>
      </SessionShare>

      <VotingPanel />

      {voting.phase === 'collecting' && (
        <div className="sp-stage__actions">
          <button type="button" className="sp-btn sp-btn--primary" onClick={handleReveal}>
            Reveal votes{pendingCount > 0 ? ` (${pendingCount} pending)` : ''}
          </button>
        </div>
      )}

      {voting.phase === 'revealed' && (
        <div className="sp-stage__actions">
          <button type="button" className="sp-btn sp-btn--ghost" onClick={voting.resetRound}>
            Vote again
          </button>
          <button type="button" className="sp-btn sp-btn--primary" onClick={handleUseStats}>
            Use these stats
          </button>
        </div>
      )}
    </div>
  );
}
