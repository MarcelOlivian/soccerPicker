import type { PlayerStats, Position } from '../types';

/**
 * Wire protocol for a secret stats-voting session. Deliberately separate
 * from protocol.ts (the live-draft protocol): that one's HELLO carries
 * `youAre: Team`, a two-seat concept, and its client does a whole-app
 * LOAD_STATE that would clobber a voter's own roster — voting shares the
 * transport layer, not the message vocabulary.
 *
 * The host is still the single writer/authority (same model as the draft),
 * but now for N voters instead of one client — see peerHub.ts.
 */

/** What a voter is allowed to see about the player being rated — never the existing/in-progress stats. */
export interface VoteSubject {
  playerId: string;
  name: string;
  nickname?: string;
  position: Position;
  /** Resolved host-side (from photoUrl or the IndexedDB blob) — never a raw photoKey, which only means anything on the host's own device. */
  photoDataUrl?: string;
}

export interface VoterSummary {
  id: string;
  displayName: string;
  hasVoted: boolean;
}

export type VotePhase = 'collecting' | 'revealed';

export interface RevealedBallot {
  voterId: string;
  displayName: string;
  stats: PlayerStats;
}

// host -> voters
export interface VoteHelloMessage {
  type: 'VOTE_HELLO';
  youAre: string;
  subject: VoteSubject;
  voters: VoterSummary[];
  phase: VotePhase;
}

/** Someone joined, left, or (silently) cast/changed a ballot — flags only, never values. */
export interface VoteRosterMessage {
  type: 'VOTE_ROSTER';
  voters: VoterSummary[];
}

export interface VoteRevealMessage {
  type: 'VOTE_REVEAL';
  ballots: RevealedBallot[];
}

/** Host started a fresh round for the same subject (e.g. after discussing the reveal). */
export interface VoteResetMessage {
  type: 'VOTE_RESET';
}

export interface VoteClosedMessage {
  type: 'VOTE_CLOSED';
  reason: string;
}

export type VoteHostMessage =
  | VoteHelloMessage
  | VoteRosterMessage
  | VoteRevealMessage
  | VoteResetMessage
  | VoteClosedMessage;

// voters -> host
export interface VoteJoinMessage {
  type: 'VOTE_JOIN';
  displayName?: string;
}

export interface VoteCastMessage {
  type: 'VOTE_CAST';
  stats: PlayerStats;
}

export type VoteClientMessage = VoteJoinMessage | VoteCastMessage;

export type VoteMessage = VoteHostMessage | VoteClientMessage;
