import { SessionShare } from '../../components/SessionShare';
import { useVoting } from '../../state/VotingContext';
import { MIN_VOTERS } from '../../sync/votingProtocol';
import type { PlayerStats } from '../../types';
import { VotingPanel } from './VotingPanel';

interface VoteHostPanelProps {
  /** Called with the rounded-average stats and the display names of everyone who cast a ballot, once the host chooses to bring the result into the player form. */
  onApplyStats: (stats: PlayerStats, votedBy: string[]) => void;
}

/** Host-side view of a stats-voting session: share the code, watch/cast ballots, reveal, and bring the result into the form. */
export function VoteHostPanel({ onApplyStats }: VoteHostPanelProps) {
  const voting = useVoting();

  if (voting.role !== 'host') return null;

  const votedCount = voting.voters.filter((v) => v.hasVoted).length;
  const pendingCount = voting.voters.filter((v) => !v.hasVoted).length;
  const belowMinimum = votedCount < MIN_VOTERS;

  function handleReveal() {
    if (belowMinimum) return;
    if (pendingCount > 0) {
      const noun = pendingCount === 1 ? 'voter hasn\'t' : 'voters haven\'t';
      if (!confirm(`${pendingCount} ${noun} voted yet. Reveal anyway?`)) return;
    }
    voting.reveal();
  }

  function handleUseStats() {
    if (voting.tally && voting.revealedBallots) {
      onApplyStats(voting.tally, voting.revealedBallots.map((b) => b.displayName));
    }
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
          <button type="button" className="sp-btn sp-btn--primary" disabled={belowMinimum} onClick={handleReveal}>
            {belowMinimum
              ? `Reveal votes (need ${MIN_VOTERS - votedCount} more vote${MIN_VOTERS - votedCount === 1 ? '' : 's'})`
              : `Reveal votes${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
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
