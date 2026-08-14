import { SessionShare } from '../../components/SessionShare';
import { useLive } from '../../state/LiveContext';

/** Host-side "go live" control: shows the session code, a copyable join link, and a QR code once hosting. */
export function GoLivePanel() {
  const { role, status, sessionCode, errorMessage, goLive, stopLive } = useLive();

  if (role === 'client') return null;

  if (role === 'solo') {
    return (
      <div className="sp-live-panel__solo">
        <button type="button" className="sp-btn sp-btn--sm" onClick={goLive}>
          Go live
        </button>
        {errorMessage && (
          <p className="sp-hint" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="sp-panel sp-live-panel">
      <div className="sp-live-panel__head">
        <h4>Live draft</h4>
        <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={stopLive}>
          End session
        </button>
      </div>
      <SessionShare sessionCode={sessionCode ?? ''} fragmentKey="join" qrAltText="QR code to join this live draft">
        <p className="sp-hint">
          {status === 'connecting' && "Waiting for Captain B to open the link or scan the code…"}
          {status === 'open' && 'Captain B is connected — picks and placements sync live.'}
          {status === 'error' && (errorMessage ?? 'Could not reach the sync broker.')}
          {status === 'closed' && 'Captain B disconnected — trying to reconnect…'}
        </p>
      </SessionShare>
      {status === 'error' && (
        <p className="sp-hint">
          Carry on with one screen — the roster handoff link (in the header) still works without a live connection.
        </p>
      )}
    </div>
  );
}
