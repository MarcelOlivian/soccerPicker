import Peer from 'peerjs';
import type { DataConnection, PeerError } from 'peerjs';
import type { PeerJsServerConfig } from './peerjsTransport';
import { PeerUnavailableError, RECONNECT_DELAYS_MS } from './peerjsTransport';
import type { ConnectionStatus } from './transport';
import type { VoteClientMessage, VoteHostMessage } from './votingProtocol';

/**
 * Host-side transport for a stats-voting session: N voters, not one. This
 * is what `PeerJsTransport` (peerjsTransport.ts) can't do — it holds a
 * single `DataConnection` slot that a second peer would silently overwrite.
 * Voters themselves don't need any of this: a voter only ever talks to one
 * host, so the voter side reuses `PeerJsTransport.join()` verbatim.
 *
 * Same broker, same session-code-as-peer-id convention, same reconnect
 * backoff as the draft transport — just a `Map<peerId, DataConnection>`
 * instead of one field, and a broadcast/unicast send instead of one target.
 */
export interface PeerHub {
  broadcast(msg: VoteHostMessage): void;
  sendTo(peerId: string, msg: VoteHostMessage): void;
  onMessage(cb: (msg: VoteClientMessage, from: string) => void): () => void;
  /** Fires with the current list of connected voter peer ids on every join/leave. */
  onPeerChange(cb: (peerIds: string[]) => void): () => void;
  onStatus(cb: (status: ConnectionStatus) => void): () => void;
  close(): void;
}

class PeerHubImpl implements PeerHub {
  private peer: Peer | null = null;
  private readonly conns = new Map<string, DataConnection>();
  private readonly messageListeners = new Set<(msg: VoteClientMessage, from: string) => void>();
  private readonly peerChangeListeners = new Set<(peerIds: string[]) => void>();
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();
  private status: ConnectionStatus = 'connecting';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private readonly sessionCode: string;
  private readonly onFatalError: (err: Error) => void;
  private readonly serverConfig?: PeerJsServerConfig;

  constructor(sessionCode: string, onFatalError: (err: Error) => void, serverConfig?: PeerJsServerConfig) {
    this.sessionCode = sessionCode;
    this.onFatalError = onFatalError;
    this.serverConfig = serverConfig;
    this.start();
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private emitPeerChange() {
    const ids = Array.from(this.conns.keys());
    for (const cb of this.peerChangeListeners) cb(ids);
  }

  private start() {
    this.setStatus('connecting');
    const peer = new Peer(this.sessionCode, this.serverConfig);
    this.peer = peer;
    // Unlike the two-seat draft transport (which only reaches 'open' once
    // its one client connects), a voting host is a fully working session —
    // one worth showing a QR code for — as soon as the broker accepts its
    // id, regardless of whether any voter has joined yet.
    peer.on('open', () => {
      this.reconnectAttempt = 0;
      this.setStatus('open');
    });
    peer.on('connection', (conn) => this.bindConnection(conn));
    peer.on('disconnected', () => this.recoverSignaling());
    peer.on('error', (err) => this.handlePeerError(err));
  }

  private bindConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
      this.emitPeerChange();
    });
    conn.on('data', (data) => {
      for (const cb of this.messageListeners) cb(data as VoteClientMessage, conn.peer);
    });
    const drop = () => {
      if (this.conns.delete(conn.peer)) this.emitPeerChange();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }

  private recoverSignaling() {
    if (this.manuallyClosed) return;
    this.scheduleReconnect(() => this.peer?.reconnect());
  }

  private handlePeerError(err: PeerError<string>) {
    if (err.type === 'unavailable-id') {
      this.onFatalError(new PeerUnavailableError(this.sessionCode));
      return;
    }
    this.setStatus('error');
    this.scheduleReconnect(() => this.start());
  }

  private scheduleReconnect(attempt: () => void) {
    if (this.reconnectTimer) return; // already pending
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.manuallyClosed) return;
      this.setStatus('connecting');
      attempt();
    }, delay);
  }

  broadcast(msg: VoteHostMessage): void {
    for (const conn of this.conns.values()) conn.send(msg);
  }

  sendTo(peerId: string, msg: VoteHostMessage): void {
    this.conns.get(peerId)?.send(msg);
  }

  onMessage(cb: (msg: VoteClientMessage, from: string) => void): () => void {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  onPeerChange(cb: (peerIds: string[]) => void): () => void {
    this.peerChangeListeners.add(cb);
    cb(Array.from(this.conns.keys()));
    return () => this.peerChangeListeners.delete(cb);
  }

  onStatus(cb: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  close(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    for (const conn of this.conns.values()) conn.close();
    this.conns.clear();
    this.peer?.destroy();
    this.setStatus('closed');
  }
}

export function hostPeerHub(
  sessionCode: string,
  onFatalError: (err: Error) => void = () => {},
  serverConfig?: PeerJsServerConfig,
): PeerHub {
  return new PeerHubImpl(sessionCode, onFatalError, serverConfig);
}
