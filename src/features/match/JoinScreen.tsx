import { useEffect, useState } from 'react';
import { useLive } from '../../state/LiveContext';

/** Entry point for Captain B: pick up a code from a `#join=...` link automatically, or type one in. */
export function JoinScreen() {
  const { role, status, sessionCode, errorMessage, joinSession, leaveSession } = useLive();
  const [codeInput, setCodeInput] = useState('');

  useEffect(() => {
    const match = /#join=([^&]+)/.exec(location.hash);
    if (match) {
      const code = decodeURIComponent(match[1]);
      setCodeInput(code);
      if (role === 'solo') {
        joinSession(code);
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role === 'host') return null;

  if (role === 'client') {
    return (
      <div className="sp-panel">
        <div className="sp-live-panel__head">
          <h4>Joined as Captain B</h4>
          <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={leaveSession}>
            Leave
          </button>
        </div>
        <p className="sp-hint">
          {status === 'connecting' && `Connecting to ${sessionCode}…`}
          {status === 'open' && 'Connected — waiting for the host to sync the roster.'}
          {status === 'error' && (errorMessage ?? 'Could not connect.')}
          {status === 'closed' && 'Lost connection to the host — trying to reconnect…'}
        </p>
      </div>
    );
  }

  return (
    <div className="sp-panel">
      <h3>Join a live draft</h3>
      <div className="sp-field">
        <label htmlFor="join-code">Session code</label>
        <input
          id="join-code"
          type="text"
          value={codeInput}
          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
          placeholder="SOCCER-XXXX"
        />
      </div>
      <button
        type="button"
        className="sp-btn sp-btn--primary"
        disabled={!codeInput.trim()}
        onClick={() => joinSession(codeInput)}
      >
        Join
      </button>
      {errorMessage && (
        <p className="sp-hint" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
