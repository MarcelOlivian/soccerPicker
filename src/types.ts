export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

export const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

export type StatValue = 1 | 2 | 3 | 4 | 5;

export const STAT_KEYS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physicality',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  pace: 'PAC',
  shooting: 'SHO',
  passing: 'PAS',
  dribbling: 'DRI',
  defending: 'DEF',
  physicality: 'PHY',
};

export const STAT_DESCRIPTIONS: Record<StatKey, string> = {
  pace: 'Pace: overall speed, combining sprint speed and acceleration.',
  shooting: 'Shooting: overall goal-scoring ability — power, accuracy, and finishing.',
  passing: 'Passing: short passing, long passing, vision, crossing, and curve.',
  dribbling: 'Dribbling: agility, balance, composure, ball control, and dribbling skill.',
  defending: 'Defending: tackling, interceptions, heading, and defensive awareness.',
  physicality: 'Physicality: strength, jumping, aggression, and endurance.',
};

export type PlayerStats = Record<StatKey, StatValue>;

export interface Player {
  id: string;
  name: string;
  nickname?: string;
  position: Position;
  stats: PlayerStats;
  /** External image link. */
  photoUrl?: string;
  /** Key into the IndexedDB image store, for uploaded photos. */
  photoKey?: string;
  /** A short signature line — a taunt, a quote, a thing they always say. */
  taunt?: string;
  createdAt: number;
}

export type FormationId = '5' | '6' | '7';

export type Team = 'A' | 'B';

export type DraftOrder = 'snake' | 'alternating';

export interface DraftPick {
  playerId: string;
  team: Team;
}

export interface DraftState {
  captainA?: string;
  captainB?: string;
  order: DraftOrder;
  picks: DraftPick[];
}

/** slotId -> playerId, or null if the slot is empty. */
export type Placements = Record<string, string | null>;

export interface MatchState {
  formation: FormationId;
  attendingIds: string[];
  draft: DraftState;
  placements: Placements;
}

/** A player's name/position/overall frozen at the moment a match was saved to history — never a live reference, so editing or deleting a player later can't corrupt a past record. */
export interface HistoryPlayerSnapshot {
  id: string;
  name: string;
  nickname?: string;
  position: Position;
  overall: number;
  isCaptain: boolean;
}

export interface MatchHistoryEntry {
  id: string;
  /** Date.now() at save time. */
  date: number;
  formation: FormationId;
  teamAName: string;
  teamBName: string;
  teamAPlayers: HistoryPlayerSnapshot[];
  teamBPlayers: HistoryPlayerSnapshot[];
  strengthA: number;
  strengthB: number;
  scoreA?: number;
  scoreB?: number;
}

export interface AppState {
  schemaVersion: 3;
  players: Player[];
  match: MatchState;
  history: MatchHistoryEntry[];
}

export function emptyDraft(order: DraftOrder = 'snake'): DraftState {
  return { order, picks: [] };
}

export function emptyMatch(formation: FormationId = '6'): MatchState {
  return {
    formation,
    attendingIds: [],
    draft: emptyDraft(),
    placements: {},
  };
}

export function emptyStats(): PlayerStats {
  return {
    pace: 3,
    shooting: 3,
    passing: 3,
    dribbling: 3,
    defending: 3,
    physicality: 3,
  };
}
