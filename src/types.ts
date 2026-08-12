export type Position = 'GK' | 'DEF' | 'MID' | 'ATT';

export const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'ATT'];

export type StatValue = 1 | 2 | 3 | 4 | 5;

export const STAT_KEYS = [
  'pace',
  'stamina',
  'finishing',
  'defending',
  'passing',
  'goalkeeping',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

export const STAT_LABELS: Record<StatKey, string> = {
  pace: 'PAC',
  stamina: 'STA',
  finishing: 'FIN',
  defending: 'DEF',
  passing: 'PAS',
  goalkeeping: 'GKP',
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

export interface AppState {
  schemaVersion: 1;
  players: Player[];
  match: MatchState;
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
    stamina: 3,
    finishing: 3,
    defending: 3,
    passing: 3,
    goalkeeping: 1,
  };
}
