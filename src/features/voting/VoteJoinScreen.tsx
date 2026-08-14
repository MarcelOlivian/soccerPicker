import { useEffect, useState } from 'react';
import { useVoting } from '../../state/VotingContext';
import { VotingPanel } from './VotingPanel';

interface VoteJoinScreenProps {
  onClose: () => void;
}

/** Voter entry point: pick up a code from a `#vote=...` link automatically, or type one in. */
export function VoteJoinScreen({ onClose }: VoteJoinScreenProps) {
  const voting = useVoting();
  const [codeInput, setCodeInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    const match = /#vote=([^&]+)/.exec(location.hash);
    if (match) {
      const code = decodeURIComponent(match[1]);
      setCodeInput(code);
      if (voting.role === 'off') {
        voting.joinVote(code);
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A host reaches this screen only if they somehow land here while
  // already running their own vote — nothing useful to show.
  if (voting.role === 'host') return null;

  if (voting.role === 'voter') {
    return (
      <div className="sp-panel">
        <div className="sp-live-panel__head">
          <h4>Stats vote</h4>
          <button
            type="button"
            className="sp-btn sp-btn--sm sp-btn--ghost"
            onClick={() => {
              voting.endVote();
              onClose();
            }}
          >
            Leave
          </button>
        </div>
        <p className="sp-hint">
          {voting.status === 'connecting' && `Connecting to ${voting.sessionCode}…`}
          {voting.status === 'open' && !voting.subject && 'Connected — waiting for the session to start.'}
          {voting.status === 'error' && (voting.errorMessage ?? 'Could not connect.')}
          {voting.status === 'closed' && 'Lost connection to the host — trying to reconnect…'}
        </p>
        <VotingPanel />
      </div>
    );
  }

  return (
    <div className="sp-panel">
      <div className="sp-live-panel__head">
        <h3>Join a stats vote</h3>
        <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="sp-field">
        <label htmlFor="vote-name">Your name (optional)</label>
        <input
          id="vote-name"
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Alex"
        />
      </div>
      <div className="sp-field">
        <label htmlFor="vote-code">Session code</label>
        <input
          id="vote-code"
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="VOTE-XXXX"
        />
      </div>
      <button
        type="button"
        className="sp-btn sp-btn--primary"
        disabled={!codeInput.trim()}
        onClick={() => voting.joinVote(codeInput, nameInput)}
      >
        Join
      </button>
      {voting.errorMessage && (
        <p className="sp-hint" role="alert">
          {voting.errorMessage}
        </p>
      )}
    </div>
  );
}
