import { useLive } from '../state/LiveContext';
import { useVoting } from '../state/VotingContext';

const LABELS: Record<string, string> = {
  idle: 'SOLO',
  connecting: 'WAITING',
  open: 'LIVE',
  closed: 'RECONNECTING',
  error: 'ERROR',
};

/** SOLO / WAITING / LIVE / RECONNECTING / VOTING — always visible in the header so the connection state is never a mystery. */
export function ConnectionChip() {
  const { role, status } = useLive();
  const voting = useVoting();

  // Mutually exclusive with the live draft (sessionLock.ts), so at most
  // one of these two states is ever active — check voting first since a
  // live draft can't be running at the same time.
  if (voting.role !== 'off') {
    if (voting.status === 'connecting') {
      return <span className="sp-badge sp-connection-chip sp-connection-chip--connecting">VOTING…</span>;
    }
    if (voting.status === 'error') {
      return <span className="sp-badge sp-connection-chip sp-connection-chip--error">ERROR</span>;
    }
    return (
      <span className="sp-badge sp-connection-chip sp-connection-chip--open">VOTING ({voting.voters.length})</span>
    );
  }

  if (role === 'solo') {
    return <span className="sp-badge">SOLO</span>;
  }

  const label = role === 'client' && status === 'connecting' ? 'CONNECTING' : (LABELS[status] ?? status.toUpperCase());

  return <span className={`sp-badge sp-connection-chip sp-connection-chip--${status}`}>{label}</span>;
}
