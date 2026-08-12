import { applyPick, resetDraft, undoPick } from '../lib/draft';
import type {
  AppState,
  DraftOrder,
  FormationId,
  MatchState,
  Placements,
  Player,
  Team,
} from '../types';
import { emptyMatch } from '../types';

export type Action =
  | { type: 'ADD_PLAYER'; player: Player }
  | { type: 'UPDATE_PLAYER'; player: Player }
  | { type: 'DELETE_PLAYER'; id: string }
  | { type: 'DUPLICATE_PLAYER'; id: string; newPlayer: Player }
  | { type: 'MERGE_PLAYERS'; players: Player[]; mode: 'merge' | 'replace' }
  | { type: 'SET_FORMATION'; formation: FormationId }
  | { type: 'SET_ATTENDING'; ids: string[] }
  | { type: 'TOGGLE_ATTENDING'; id: string }
  | { type: 'SET_CAPTAINS'; captainA?: string; captainB?: string }
  | { type: 'SET_DRAFT_ORDER'; order: DraftOrder }
  | { type: 'APPLY_PICK'; playerId: string }
  | { type: 'UNDO_PICK' }
  | { type: 'RESET_DRAFT' }
  | { type: 'SET_PLACEMENT'; slotId: string; playerId: string | null }
  | { type: 'SWAP_PLACEMENTS'; slotA: string; slotB: string }
  | { type: 'CLEAR_PLACEMENTS' }
  | { type: 'RESET_MATCH' }
  | { type: 'LOAD_STATE'; state: AppState }
  // Live-client only: wholesale-replaces match state from a host STATE
  // broadcast, without touching players (whose photos arrive separately
  // and progressively over PHOTOS messages).
  | { type: 'SET_MATCH'; match: MatchState };

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_PLAYER':
      return { ...state, players: [...state.players, action.player] };

    case 'UPDATE_PLAYER':
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.player.id ? action.player : p)),
      };

    case 'DELETE_PLAYER':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.id),
        match: removePlayerFromMatch(state.match, action.id),
      };

    case 'DUPLICATE_PLAYER': {
      const source = state.players.find((p) => p.id === action.id);
      if (!source) return state;
      return { ...state, players: [...state.players, action.newPlayer] };
    }

    case 'MERGE_PLAYERS': {
      if (action.mode === 'replace') {
        return { ...state, players: action.players };
      }
      // merge: incoming players with a matching name replace the existing
      // entry; everything else is appended.
      const byName = new Map(state.players.map((p) => [p.name.trim().toLowerCase(), p]));
      for (const incoming of action.players) {
        byName.set(incoming.name.trim().toLowerCase(), incoming);
      }
      return { ...state, players: Array.from(byName.values()) };
    }

    case 'SET_FORMATION':
      return {
        ...state,
        match: { ...state.match, formation: action.formation, placements: {} },
      };

    case 'SET_ATTENDING':
      return { ...state, match: { ...state.match, attendingIds: action.ids } };

    case 'TOGGLE_ATTENDING': {
      const already = state.match.attendingIds.includes(action.id);
      const attendingIds = already
        ? state.match.attendingIds.filter((id) => id !== action.id)
        : [...state.match.attendingIds, action.id];
      return { ...state, match: { ...state.match, attendingIds } };
    }

    case 'SET_CAPTAINS': {
      // Captains are auto-assigned as each team's first pick, so resetting
      // captains means restarting the draft from scratch.
      let draft: AppState['match']['draft'] = {
        ...resetDraft(state.match.draft.order),
        captainA: action.captainA,
        captainB: action.captainB,
      };
      if (action.captainA) draft = applyPick(draft, action.captainA);
      if (action.captainB) draft = applyPick(draft, action.captainB);
      return { ...state, match: { ...state.match, draft, placements: {} } };
    }

    case 'SET_DRAFT_ORDER':
      return {
        ...state,
        match: { ...state.match, draft: { ...state.match.draft, order: action.order } },
      };

    case 'APPLY_PICK':
      return {
        ...state,
        match: { ...state.match, draft: applyPick(state.match.draft, action.playerId) },
      };

    case 'UNDO_PICK':
      return { ...state, match: { ...state.match, draft: undoPick(state.match.draft) } };

    case 'RESET_DRAFT':
      return {
        ...state,
        match: { ...state.match, draft: resetDraft(state.match.draft.order), placements: {} },
      };

    case 'SET_PLACEMENT': {
      if (action.playerId !== null && !sameTeam(state, action.playerId, action.slotId)) {
        // A slot only accepts a player from the team that "owns" that half
        // of the pitch — otherwise a click or drag could plant a Team B
        // player in a Team A slot. Reject rather than silently corrupt state.
        return state;
      }
      const placements: Placements = { ...state.match.placements };
      if (action.playerId === null) {
        delete placements[action.slotId];
      } else {
        // A player can only occupy one slot at a time — clear any prior slot.
        for (const [slot, pid] of Object.entries(placements)) {
          if (pid === action.playerId) delete placements[slot];
        }
        placements[action.slotId] = action.playerId;
      }
      return { ...state, match: { ...state.match, placements } };
    }

    case 'SWAP_PLACEMENTS': {
      const placements: Placements = { ...state.match.placements };
      const a = placements[action.slotA] ?? null;
      const b = placements[action.slotB] ?? null;
      if (
        (a !== null && !sameTeam(state, a, action.slotB)) ||
        (b !== null && !sameTeam(state, b, action.slotA))
      ) {
        return state;
      }
      if (b === null) delete placements[action.slotA];
      else placements[action.slotA] = b;
      if (a === null) delete placements[action.slotB];
      else placements[action.slotB] = a;
      return { ...state, match: { ...state.match, placements } };
    }

    case 'CLEAR_PLACEMENTS':
      return { ...state, match: { ...state.match, placements: {} } };

    case 'RESET_MATCH':
      return { ...state, match: emptyMatch(state.match.formation) };

    case 'LOAD_STATE':
      return action.state;

    case 'SET_MATCH':
      return { ...state, match: action.match };

    default:
      return state;
  }
}

function removePlayerFromMatch(match: AppState['match'], playerId: string): AppState['match'] {
  const attendingIds = match.attendingIds.filter((id) => id !== playerId);
  const picks = match.draft.picks.filter((p) => p.playerId !== playerId);
  const placements: Placements = {};
  for (const [slot, pid] of Object.entries(match.placements)) {
    if (pid !== playerId) placements[slot] = pid;
  }
  const captainA = match.draft.captainA === playerId ? undefined : match.draft.captainA;
  const captainB = match.draft.captainB === playerId ? undefined : match.draft.captainB;
  return {
    ...match,
    attendingIds,
    placements,
    draft: { ...match.draft, picks, captainA, captainB },
  };
}

export function teamOf(state: AppState, playerId: string): Team | undefined {
  return state.match.draft.picks.find((p) => p.playerId === playerId)?.team;
}

/**
 * Pitch slot ids are generated by lib/formations.ts as `${team}-${position}-${index}`
 * (e.g. "A-DEF-1"), so the owning team can be read straight off the id
 * without importing the formation geometry into the reducer.
 */
function slotTeam(slotId: string): Team | undefined {
  if (slotId.startsWith('A-')) return 'A';
  if (slotId.startsWith('B-')) return 'B';
  return undefined;
}

/** True unless the player has a known draft team AND the slot has a known team AND they disagree. */
function sameTeam(state: AppState, playerId: string, slotId: string): boolean {
  const playerTeam = teamOf(state, playerId);
  const targetTeam = slotTeam(slotId);
  if (!playerTeam || !targetTeam) return true;
  return playerTeam === targetTeam;
}
