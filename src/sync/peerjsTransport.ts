import Peer from 'peerjs';
import type { DataConnection, PeerError } from 'peerjs';
import type { SyncMessage } from './protocol';
import type { ConnectionStatus, SyncTransport } from './transport';

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

/** Overrides for PeerJS's broker connection. Omit to use the default public cloud broker. */
export interface PeerJsServerConfig {
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
}

export class PeerUnavailableError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`Session code is already in use (${code})`);
    this.code = code;
  }
}

/**
 * Production transport: a WebRTC data channel, brokered by the free public
 * PeerJS cloud service. Only the connection handshake touches the broker —
 * once open, data flows peer-to-peer. This is the one piece of the app
 * that depends on a third-party service with no uptime guarantee, so it's
 * kept behind the same SyncTransport interface as every other transport:
 * if the broker ever needs replacing (a self-hosted PeerServer, a small
 * relay Worker), this file is the entire blast radius.
 *
 * Reconnection is two-layered, matching how PeerJS actually fails:
 *  - the signaling socket to the broker can drop (peer 'disconnected') —
 *    recovered with `peer.reconnect()` on the same id.
 *  - the RTC data channel itself can drop (`conn 'close'`) — on the client
 *    side this re-attempts `peer.connect(hostCode)`; the host doesn't need
 *    to do anything but keep listening, since a reconnecting client shows
 *    up as a fresh 'connection' event.
 */
export class PeerJsTransport implements SyncTransport {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private readonly messageListeners = new Set<(msg: SyncMessage) => void>();
  private readonly statusListeners = new Set<(status: ConnectionStatus) => void>();
  private status: ConnectionStatus = 'connecting';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private manuallyClosed = false;
  private readonly role: 'host' | 'client';
  private readonly sessionCode: string;
  private readonly onFatalError: (err: Error) => void;
  private readonly serverConfig?: PeerJsServerConfig;

  private constructor(
    role: 'host' | 'client',
    sessionCode: string,
    onFatalError: (err: Error) => void,
    serverConfig?: PeerJsServerConfig,
  ) {
    this.role = role;
    this.sessionCode = sessionCode;
    this.onFatalError = onFatalError;
    this.serverConfig = serverConfig;
  }

  static host(
    sessionCode: string,
    onFatalError: (err: Error) => void = () => {},
    serverConfig?: PeerJsServerConfig,
  ): PeerJsTransport {
    const transport = new PeerJsTransport('host', sessionCode, onFatalError, serverConfig);
    transport.startAsHost();
    return transport;
  }

  static join(
    sessionCode: string,
    onFatalError: (err: Error) => void = () => {},
    serverConfig?: PeerJsServerConfig,
  ): PeerJsTransport {
    const transport = new PeerJsTransport('client', sessionCode, onFatalError, serverConfig);
    transport.startAsClient();
    return transport;
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    for (const cb of this.statusListeners) cb(status);
  }

  private startAsHost() {
    this.setStatus('connecting');
    const peer = new Peer(this.sessionCode, this.serverConfig);
    this.peer = peer;
    peer.on('connection', (conn) => this.bindConnection(conn));
    peer.on('disconnected', () => this.recoverSignaling());
    peer.on('error', (err) => this.handlePeerError(err));
  }

  private startAsClient() {
    this.setStatus('connecting');
    const peer = new Peer(this.serverConfig ?? {});
    this.peer = peer;
    peer.on('open', () => this.connectToHost());
    peer.on('disconnected', () => this.recoverSignaling());
    peer.on('error', (err) => this.handlePeerError(err));
  }

  private connectToHost() {
    if (!this.peer || this.manuallyClosed) return;
    const conn = this.peer.connect(this.sessionCode, { reliable: true });
    this.bindConnection(conn);
  }

  private bindConnection(conn: DataConnection) {
    this.conn = conn;
    conn.on('open', () => {
      this.reconnectAttempt = 0;
      this.setStatus('open');
    });
    conn.on('data', (data) => {
      for (const cb of this.messageListeners) cb(data as SyncMessage);
    });
    conn.on('close', () => {
      if (this.manuallyClosed) return;
      this.setStatus('closed');
      if (this.role === 'client') this.scheduleReconnect(() => this.connectToHost());
      // Host side needs no action — a reconnecting client fires a fresh 'connection' event.
    });
    conn.on('error', () => this.setStatus('error'));
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
    this.scheduleReconnect(() => {
      if (this.role === 'host') this.startAsHost();
      else this.startAsClient();
    });
  }

  private scheduleReconnect(attempt: () => void) {
    if (this.reconnectTimer) return; // already pending
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.manuallyClosed) return;
      // Without this, status jumps straight from 'closed' to 'open' with no
      // visible sign a retry is in flight during the backoff wait.
      this.setStatus('connecting');
      attempt();
    }, delay);
  }

  send(msg: SyncMessage): void {
    if (this.status !== 'open' || !this.conn) return;
    this.conn.send(msg);
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
    this.manuallyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.conn?.close();
    this.peer?.destroy();
    this.setStatus('closed');
  }
}
