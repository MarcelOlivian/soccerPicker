import type { MatchState, Player, Team } from '../types';

/**
 * Wire protocol for live two-seat drafting. The host is the single writer —
 * every message the client sends is an *intent* the host validates against
 * the same reducer it uses for local clicks; every message the host sends
 * is a fact the client should just render.
 */

export interface HelloMessage {
  type: 'HELLO';
  /** Player records without photoKey — uploaded photos follow separately as PHOTOS messages. */
  players: Omit<Player, 'photoKey'>[];
  match: MatchState;
  youAre: Team;
}

export interface PhotosMessage {
  type: 'PHOTOS';
  playerId: string;
  dataUrl: string;
}

export interface StateMessage {
  type: 'STATE';
  match: MatchState;
}

export interface ByeMessage {
  type: 'BYE';
  reason: string;
}

export type HostMessage = HelloMessage | PhotosMessage | StateMessage | ByeMessage;

export interface JoinMessage {
  type: 'JOIN';
  displayName?: string;
}

export interface PickMessage {
  type: 'PICK';
  playerId: string;
}

export interface PlaceMessage {
  type: 'PLACE';
  slotId: string;
  playerId: string | null;
}

export interface SwapMessage {
  type: 'SWAP';
  slotA: string;
  slotB: string;
}

export interface PingMessage {
  type: 'PING';
}

export type ClientMessage = JoinMessage | PickMessage | PlaceMessage | SwapMessage | PingMessage;

export type SyncMessage = HostMessage | ClientMessage;
