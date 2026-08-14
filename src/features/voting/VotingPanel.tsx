import { useEffect, useState } from 'react';
import { PlayerCard } from '../../components/PlayerCard';
import { StatStepper } from '../../components/StatStepper';
import { overall } from '../../lib/rating';
import { useVoting } from '../../state/VotingContext';
import { STAT_KEYS, STAT_LABELS, emptyStats } from '../../types';
import type { Player, PlayerStats, StatKey, StatValue } from '../../types';

/**
 * The shared secret-ballot / results surface, used inside both
 * VoteHostPanel (the host's own ballot) and VoteJoinScreen (a voter's
 * screen once joined) — identical either way, since the host votes like
 * anyone else. Reads everything straight from VotingContext rather than
 * being prop-drilled, since there's only ever one active session per tab.
 */
export function VotingPanel() {
  const voting = useVoting();
  const [draft, setDraft] = useState<PlayerStats>(() => voting.myVote ?? emptyStats());

  // A fresh round — a brand-new subject, or the host resetting this one —
  // clears myVote in context; mirror that by starting the local ballot
  // over from a neutral default rather than carrying over stale picks.
  useEffect(() => {
    if (voting.phase === 'collecting' && voting.myVote === null) {
      setDraft(emptyStats());
    }
  }, [voting.phase, voting.myVote]);

  if (!voting.subject) return null;

  const previewPlayer: Player = {
    id: voting.subject.playerId,
    name: voting.subject.name,
    nickname: voting.subject.nickname,
    position: voting.subject.position,
    stats: draft,
    photoUrl: voting.subject.photoDataUrl,
    createdAt: 0,
  };

  function updateDraftStat(key: StatKey, value: StatValue) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  const derivedOverall = overall({ stats: draft }, voting.subject.position);

  return (
    <div className="sp-vote-panel">
      <div className="sp-vote-panel__subject">
        <PlayerCard player={previewPlayer} hideRatings />
      </div>

      <div className="sp-vote-panel__status">
        <h4>Session status ({voting.voters.length} connected)</h4>
        <ul className="sp-vote-panel__voters">
          {voting.voters.map((v) => (
            <li key={v.id} className="sp-vote-panel__voter">
              <span>
                {v.displayName}
                {v.id === voting.myVoterId && ' (you)'}
              </span>
              <span className={v.hasVoted ? 'sp-badge sp-vote-panel__voted' : 'sp-hint'}>
                {v.hasVoted ? 'Voted' : 'Pending'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {voting.phase === 'collecting' && (
        <div className="sp-vote-panel__ballot">
          <div className="sp-vote-panel__ballot-head">
            <h4>Your secret estimate</h4>
            <span className="sp-badge">
              Derived OVR: <strong>{derivedOverall}</strong>
            </span>
          </div>
          <div className="sp-vote-panel__steppers">
            {STAT_KEYS.map((key) => (
              <StatStepper key={key} statKey={key} value={draft[key]} onChange={(v) => updateDraftStat(key, v)} />
            ))}
          </div>
          <button type="button" className="sp-btn sp-btn--primary" onClick={() => voting.castVote(draft)}>
            {voting.hasSubmitted ? 'Update my secret vote' : 'Submit my secret vote'}
          </button>
          {voting.hasSubmitted && <p className="sp-hint">Vote submitted — you can still change it until reveal.</p>}
        </div>
      )}

      {voting.phase === 'revealed' && voting.revealedBallots && (
        <div className="sp-vote-panel__results">
          <h4>Results</h4>
          <div className="sp-vote-panel__table-wrap">
            <table className="sp-vote-panel__table">
              <thead>
                <tr>
                  <th>Voter</th>
                  {STAT_KEYS.map((key) => (
                    <th key={key}>{STAT_LABELS[key]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {voting.revealedBallots.map((b) => (
                  <tr key={b.voterId}>
                    <td>{b.displayName}</td>
                    {STAT_KEYS.map((key) => (
                      <td key={key}>{b.stats[key]}</td>
                    ))}
                  </tr>
                ))}
                {voting.tally && (
                  <tr className="sp-vote-panel__table-average">
                    <td>Average</td>
                    {STAT_KEYS.map((key) => (
                      <td key={key}>{voting.tally![key]}</td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
