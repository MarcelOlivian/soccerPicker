import type { SyncMessage } from './protocol';

export type ConnectionStatus = 'connecting' | 'open' | 'closed' | 'error';

/**
 * Everything above this interface (host/client session logic, the React
 * hooks, the UI) is transport-agnostic. This is the seam: PeerJS is the
 * production path, BroadcastChannel is same-device dev/testing, and
 * FakeTransport is an in-memory pair for unit tests. If the public PeerJS
 * broker ever turns out to be unreliable in the wild, swapping it touches
 * only peerjsTransport.ts.
 */
export interface SyncTransport {
  send(msg: SyncMessage): void;
  onMessage(cb: (msg: SyncMessage) => void): () => void;
  onStatus(cb: (status: ConnectionStatus) => void): () => void;
  close(): void;
}
