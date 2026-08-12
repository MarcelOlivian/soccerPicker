import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useLive } from '../../state/LiveContext';

/** Host-side "go live" control: shows the session code, a copyable join link, and a QR code once hosting. */
export function GoLivePanel() {
  const { role, status, sessionCode, errorMessage, goLive, stopLive } = useLive();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const joinUrl = sessionCode ? `${location.origin}${location.pathname}#join=${sessionCode}` : null;

  useEffect(() => {
    if (!joinUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 180 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  if (role === 'client') return null;

  if (role === 'solo') {
    return (
      <button type="button" className="sp-btn sp-btn--sm" onClick={goLive}>
        Go live
      </button>
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
      <div className="sp-live-panel__body">
        <div className="sp-live-panel__info">
          <span className="sp-live-panel__code">{sessionCode}</span>
          <p className="sp-hint">
            {status === 'connecting' && "Waiting for Captain B to open the link or scan the code…"}
            {status === 'open' && 'Captain B is connected — picks and placements sync live.'}
            {status === 'error' && (errorMessage ?? 'Could not reach the sync broker.')}
            {status === 'closed' && 'Captain B disconnected — trying to reconnect…'}
          </p>
          {joinUrl && (
            <button
              type="button"
              className="sp-btn sp-btn--sm"
              onClick={async () => {
                await navigator.clipboard.writeText(joinUrl);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              {linkCopied ? 'Copied!' : 'Copy join link'}
            </button>
          )}
        </div>
        {qrDataUrl && <img className="sp-live-panel__qr" src={qrDataUrl} alt="QR code to join this live draft" width={140} height={140} />}
      </div>
      {status === 'error' && (
        <p className="sp-hint">
          Carry on with one screen — the roster handoff link (in the header) still works without a live connection.
        </p>
      )}
    </div>
  );
}
