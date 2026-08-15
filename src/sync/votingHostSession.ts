import type { PeerHub } from './peerHub';
import type { PlayerStats } from '../types';
import { MIN_VOTERS } from './votingProtocol';
import type { RevealedBallot, VotePhase, VoteSubject, VoterSummary } from './votingProtocol';

/**
 * The host casts a ballot the same way voters do (a user decision — the
 * host isn't purely a facilitator), but does so locally rather than over
 * the hub, since the host has no connection to itself. This fixed id keeps
 * the host's own entry in the same voter roster/ballot maps as everyone
 * else, so reveal/tally logic doesn't need a special case for it.
 */
export const HOST_VOTER_ID = '__host__';

export interface VotingHostSessionDeps {
  hub: PeerHub;
  getSubject: () => VoteSubject;
  hostDisplayName?: string;
  /** Called whenever the voter roster (join/leave/vote-flag) changes, so the UI can re-render. */
  onVotersChange?: (voters: VoterSummary[]) => void;
}

export interface VotingHostSession {
  getVoters: () => VoterSummary[];
  /** The host's own secret ballot — recorded locally, never sent over the hub. */
  castHostVote: (stats: PlayerStats) => void;
  /**
   * Reveals every cast ballot to everyone, host included. Safe to call
   * before all voters have voted. Returns null (and reveals nothing) below
   * MIN_VOTERS cast ballots — one person casting a ballot alone isn't a vote.
   */
  reveal: () => RevealedBallot[] | null;
  /** Starts a fresh round for the same subject: clears ballots, keeps the voter roster, notifies everyone. */
  reset: () => void;
  dispose: () => void;
}

/**
 * Owns the authoritative voter roster and ballot map for a stats-voting
 * session. Unlike the draft's hostSession.ts, this has no app-state reducer
 * to validate against — voting state is deliberately ephemeral (never
 * written into AppState), so this module *is* the source of truth for as
 * long as the session runs.
 */
export function createVotingHostSession(deps: VotingHostSessionDeps): VotingHostSession {
  const { hub, getSubject } = deps;
  const displayNames = new Map<string, string>();
  const ballots = new Map<string, PlayerStats>();
  let phase: VotePhase = 'collecting';
  let nextAnonIndex = 1;

  displayNames.set(HOST_VOTER_ID, deps.hostDisplayName?.trim() || 'Host');

  function voterSummaries(): VoterSummary[] {
    return Array.from(displayNames.entries()).map(([id, displayName]) => ({
      id,
      displayName,
      hasVoted: ballots.has(id),
    }));
  }

  function broadcastRoster() {
    hub.broadcast({ type: 'VOTE_ROSTER', voters: voterSummaries() });
    deps.onVotersChange?.(voterSummaries());
  }

  const unsubMessages = hub.onMessage((msg, from) => {
    switch (msg.type) {
      case 'VOTE_JOIN': {
        const trimmed = msg.displayName?.trim();
        const displayName = trimmed && trimmed.length > 0 ? trimmed : `Voter ${nextAnonIndex++}`;
        displayNames.set(from, displayName);
        hub.sendTo(from, {
          type: 'VOTE_HELLO',
          youAre: from,
          subject: getSubject(),
          voters: voterSummaries(),
          phase,
        });
        broadcastRoster();
        break;
      }
      case 'VOTE_CAST': {
        // A ballot from someone who never joined shouldn't happen (the UI
        // gates casting on having received VOTE_HELLO first), but a stray
        // message from a since-departed peer id is silently ignored rather
        // than resurrecting them in the roster.
        if (!displayNames.has(from)) return;
        ballots.set(from, msg.stats);
        broadcastRoster();
        break;
      }
    }
  });

  const unsubPeers = hub.onPeerChange((peerIds) => {
    const stillConnected = new Set(peerIds);
    let changed = false;
    for (const id of Array.from(displayNames.keys())) {
      if (id === HOST_VOTER_ID) continue; // the host is never "connected" over the hub
      if (!stillConnected.has(id)) {
        displayNames.delete(id);
        ballots.delete(id);
        changed = true;
      }
    }
    if (changed) broadcastRoster();
  });

  function castHostVote(stats: PlayerStats) {
    ballots.set(HOST_VOTER_ID, stats);
    broadcastRoster();
  }

  function reveal(): RevealedBallot[] | null {
    if (ballots.size < MIN_VOTERS) return null;
    phase = 'revealed';
    const revealed: RevealedBallot[] = Array.from(ballots.entries()).map(([id, stats]) => ({
      voterId: id,
      displayName: displayNames.get(id) ?? id,
      stats,
    }));
    hub.broadcast({ type: 'VOTE_REVEAL', ballots: revealed });
    return revealed;
  }

  function reset() {
    phase = 'collecting';
    ballots.clear();
    hub.broadcast({ type: 'VOTE_RESET' });
    broadcastRoster();
  }

  return {
    getVoters: voterSummaries,
    castHostVote,
    reveal,
    reset,
    dispose: () => {
      unsubMessages();
      unsubPeers();
    },
  };
}
