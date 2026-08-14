import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import QRCode from 'qrcode';

interface SessionShareProps {
  sessionCode: string;
  /** URL fragment key this session's join link uses — "join" for a live draft, "vote" for stats voting. */
  fragmentKey: string;
  qrAltText: string;
  /** Feature-specific status text (e.g. "Waiting for Captain B…"), rendered between the code and the copy button. */
  children?: ReactNode;
}

/**
 * The session code, a copyable join link, and its QR code — the shareable
 * bit of "go live", reused by both the live-draft host panel and the
 * stats-voting host panel. Each caller supplies its own status text as
 * children and decides what surrounds this (its own header, end-session
 * button, etc.).
 */
export function SessionShare({ sessionCode, fragmentKey, qrAltText, children }: SessionShareProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const joinUrl = `${location.origin}${location.pathname}#${fragmentKey}=${sessionCode}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(joinUrl, { margin: 1, width: 180 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [joinUrl]);

  return (
    <div className="sp-session-share">
      <div className="sp-session-share__info">
        <span className="sp-session-share__code">{sessionCode}</span>
        {children}
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
      </div>
      {qrDataUrl && <img className="sp-session-share__qr" src={qrDataUrl} alt={qrAltText} width={140} height={140} />}
    </div>
  );
}
