import type { SyncMessage } from './protocol';
import type { ConnectionStatus, SyncTransport } from './transport';

/**
 * In-memory paired transport for unit tests: messages sent on one side are
 * delivered synchronously (via microtask) to listeners on the other side.
 * No network, no browser APIs — this is what lets host-session validation
 * logic be tested without a real connection.
 */
class FakeTransport implements SyncTransport {
  private peer: FakeTransport | null = null;
  private messageListeners = new Set<(msg: SyncMessage) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private status: ConnectionStatus = 'connecting';

  _link(peer: FakeTransport) {
    this.peer = peer;
  }

  _setStatus(status: ConnectionStatus) {
    this.status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  _receive(msg: SyncMessage) {
    for (const cb of this.messageListeners) cb(msg);
  }

  send(msg: SyncMessage): void {
    if (this.status !== 'open' || !this.peer) return;
    // Round-trip through JSON to catch anything non-serializable, matching
    // real transports (WebRTC data channels, BroadcastChannel structured
    // clone) and to guarantee sender/receiver never share object identity.
    const cloned = JSON.parse(JSON.stringify(msg)) as SyncMessage;
    queueMicrotask(() => this.peer?._receive(cloned));
  }

  onMessage(cb: (msg: SyncMessage) => void): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  onStatus(cb: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  close(): void {
    this._setStatus('closed');
    this.peer?._setStatus('closed');
  }
}

/** Creates a connected pair, e.g. `const [host, client] = createFakeTransportPair();`. */
export function createFakeTransportPair(): [SyncTransport, SyncTransport] {
  const a = new FakeTransport();
  const b = new FakeTransport();
  a._link(b);
  b._link(a);
  a._setStatus('open');
  b._setStatus('open');
  return [a, b];
}
