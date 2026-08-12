import { useLive } from '../state/LiveContext';

const LABELS: Record<string, string> = {
  idle: 'SOLO',
  connecting: 'WAITING',
  open: 'LIVE',
  closed: 'RECONNECTING',
  error: 'ERROR',
};

/** SOLO / WAITING / LIVE / RECONNECTING — always visible in the header so the connection state is never a mystery. */
export function ConnectionChip() {
  const { role, status } = useLive();

  if (role === 'solo') {
    return <span className="sp-badge">SOLO</span>;
  }

  const label = role === 'client' && status === 'connecting' ? 'CONNECTING' : (LABELS[status] ?? status.toUpperCase());

  return <span className={`sp-badge sp-connection-chip sp-connection-chip--${status}`}>{label}</span>;
}
