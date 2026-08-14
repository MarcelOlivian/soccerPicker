import { useSyncExternalStore } from 'react';

/**
 * Live draft and stats-voting both open a PeerJS `Peer` under a session
 * code used as its peer id — running two on the same device at once isn't
 * meaningfully supported (one broker connection, one obvious "you're now
 * live" mental model for the person driving it), so the two features are
 * mutually exclusive by user decision. `LiveContext` and `VotingContext`
 * are both mounted app-wide and would otherwise need to import each other
 * to check "is the other one active?" — this tiny module-scoped registry
 * is the shared seam instead, avoiding a circular provider dependency.
 */
export type SessionOwner = 'draft' | 'voting' | null;

let owner: SessionOwner = null;
const listeners = new Set<() => void>();

function notify() {
  for (const cb of listeners) cb();
}

export class SessionConflictError extends Error {
  readonly heldBy: Exclude<SessionOwner, null>;
  constructor(heldBy: Exclude<SessionOwner, null>) {
    const label = heldBy === 'draft' ? 'a live draft' : 'a stats vote';
    super(`Can't start this — ${label} is already active on this device. Stop it first.`);
    this.heldBy = heldBy;
  }
}

/** Claims the session slot for a feature, or throws SessionConflictError if the other feature already holds it. */
export function claimSession(feature: Exclude<SessionOwner, null>): void {
  if (owner && owner !== feature) {
    throw new SessionConflictError(owner);
  }
  owner = feature;
  notify();
}

/** No-op if the caller doesn't currently hold the slot (e.g. already released, or never claimed). */
export function releaseSession(feature: Exclude<SessionOwner, null>): void {
  if (owner === feature) {
    owner = null;
    notify();
  }
}

export function getSessionOwner(): SessionOwner {
  return owner;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Reactive read of the current session owner, for UI that should grey out while the other feature is live. */
export function useSessionOwner(): SessionOwner {
  return useSyncExternalStore(subscribe, getSessionOwner);
}
