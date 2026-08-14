import type { PeerHub } from './peerHub';
import type { ConnectionStatus } from './transport';
import type { VoteClientMessage, VoteHostMessage } from './votingProtocol';

/** A unit-test stand-in for a single voter's connection to the host hub. */
export interface FakeVoter {
  readonly peerId: string;
  send(msg: VoteClientMessage): void;
  onMessage(cb: (msg: VoteHostMessage) => void): () => void;
}

export interface FakeHub {
  hub: PeerHub;
  voters: FakeVoter[];
  /** Simulates a voter's connection dropping — closing their tab mid-vote. */
  disconnectVoter(peerId: string): void;
}

function clone<T>(msg: T): T {
  // Round-trips through JSON like the real WebRTC data channel would, and
  // guarantees sender/receiver never share object identity — matches the
  // pattern already used by fakeTransport.ts for the draft protocol.
  return JSON.parse(JSON.stringify(msg)) as T;
}

/**
 * In-memory host hub + N in-memory voter transports, for unit-testing
 * votingHostSession.ts without a real broker. `createFakeTransportPair()`
 * (fakeTransport.ts) is strictly a pair and can't cover N voters.
 */
export function createFakeHub(voterCount: number): FakeHub {
  const hostMessageListeners = new Set<(msg: VoteClientMessage, from: string) => void>();
  const peerChangeListeners = new Set<(peerIds: string[]) => void>();
  const statusListeners = new Set<(status: ConnectionStatus) => void>();
  const voterInboxes = new Map<string, Set<(msg: VoteHostMessage) => void>>();
  let connectedIds: string[] = [];

  function emitPeerChange() {
    const ids = [...connectedIds];
    for (const cb of peerChangeListeners) cb(ids);
  }

  const hub: PeerHub = {
    broadcast(msg) {
      for (const id of connectedIds) {
        const cloned = clone(msg);
        for (const cb of voterInboxes.get(id) ?? []) queueMicrotask(() => cb(cloned));
      }
    },
    sendTo(peerId, msg) {
      const cloned = clone(msg);
      for (const cb of voterInboxes.get(peerId) ?? []) queueMicrotask(() => cb(cloned));
    },
    onMessage(cb) {
      hostMessageListeners.add(cb);
      return () => hostMessageListeners.delete(cb);
    },
    onPeerChange(cb) {
      peerChangeListeners.add(cb);
      cb([...connectedIds]);
      return () => peerChangeListeners.delete(cb);
    },
    onStatus(cb) {
      statusListeners.add(cb);
      cb('open');
      return () => statusListeners.delete(cb);
    },
    close() {
      for (const cb of statusListeners) cb('closed');
    },
  };

  const voters: FakeVoter[] = [];
  for (let i = 0; i < voterCount; i++) {
    const peerId = `voter-${i}`;
    voterInboxes.set(peerId, new Set());
    voters.push({
      peerId,
      send(msg) {
        const cloned = clone(msg);
        for (const cb of hostMessageListeners) queueMicrotask(() => cb(cloned, peerId));
      },
      onMessage(cb) {
        const inbox = voterInboxes.get(peerId);
        inbox?.add(cb);
        return () => inbox?.delete(cb);
      },
    });
  }
  connectedIds = voters.map((v) => v.peerId);

  function disconnectVoter(peerId: string) {
    connectedIds = connectedIds.filter((id) => id !== peerId);
    voterInboxes.delete(peerId);
    emitPeerChange();
  }

  return { hub, voters, disconnectVoter };
}
