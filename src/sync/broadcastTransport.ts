import type { SyncMessage } from './protocol';
import type { ConnectionStatus, SyncTransport } from './transport';

/**
 * Same-device transport for two browser windows/tabs on the same origin —
 * no network at all. Useful for a second screen (projector, bench view)
 * and it's how the live-mode UI gets built and exercised without depending
 * on the PeerJS broker.
 */
export class BroadcastChannelTransport implements SyncTransport {
  private channel: BroadcastChannel;
  private messageListeners = new Set<(msg: SyncMessage) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private status: ConnectionStatus = 'open';

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
      for (const cb of this.messageListeners) cb(event.data);
    };
  }

  send(msg: SyncMessage): void {
    this.channel.postMessage(msg);
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
    this.status = 'closed';
    for (const cb of this.statusListeners) cb('closed');
    this.channel.close();
  }
}
