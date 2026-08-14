import { autoFillSlots } from '../lib/autoFill';
import { applyPick, autoDraftRemaining, picksForTeam, resetDraft, undoPick } from '../lib/draft';
import { formationSlots } from '../lib/formations';
import { pruneMatchToPlayers } from '../lib/matchCleanup';
import type {
  AppState,
  DraftOrder,
  FormationId,
  MatchHistoryEntry,
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
  | { type: 'AUTO_DRAFT_REMAINING' }
  | { type: 'SWAP_DRAFT_TEAMS'; playerIdA: string; playerIdB: string }
  | { type: 'AUTO_FILL_PLACEMENTS' }
  | { type: 'SET_PLACEMENT'; slotId: string; playerId: string | null }
  | { type: 'SWAP_PLACEMENTS'; slotA: string; slotB: string }
  | { type: 'CLEAR_PLACEMENTS' }
  | { type: 'RESET_MATCH' }
  | { type: 'SAVE_MATCH_TO_HISTORY'; entry: MatchHistoryEntry }
  | { type: 'DELETE_HISTORY_ENTRY'; id: string }
  | { type: 'SET_HISTORY_SCORE'; id: string; scoreA?: number; scoreB?: number }
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

    case 'DELETE_PLAYER': {
      const players = state.players.filter((p) => p.id !== action.id);
      return { ...state, players, match: pruneMatchToPlayers(state.match, players) };
    }

    case 'DUPLICATE_PLAYER': {
      const source = state.players.find((p) => p.id === action.id);
      if (!source) return state;
      return { ...state, players: [...state.players, action.newPlayer] };
    }

    case 'MERGE_PLAYERS': {
      if (action.mode === 'replace') {
        return { ...state, players: action.players, match: pruneMatchToPlayers(state.match, action.players) };
      }
      // merge: incoming players with a matching name replace the existing
      // entry (by a possibly-different id — an imported player is a fresh
      // object); everything else is appended.
      const byName = new Map(state.players.map((p) => [p.name.trim().toLowerCase(), p]));
      for (const incoming of action.players) {
        byName.set(incoming.name.trim().toLowerCase(), incoming);
      }
      const players = Array.from(byName.values());
      return { ...state, players, match: pruneMatchToPlayers(state.match, players) };
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

    case 'AUTO_DRAFT_REMAINING': {
      const pickedIds = new Set(state.match.draft.picks.map((p) => p.playerId));
      const byId = new Map(state.players.map((p) => [p.id, p]));
      const remainingPlayers = state.match.attendingIds
        .filter((id) => !pickedIds.has(id))
        .map((id) => byId.get(id))
        .filter((p): p is Player => !!p);
      const newPicks = autoDraftRemaining(remainingPlayers, state.match.draft.picks, state.match.draft.order);
      return {
        ...state,
        match: {
          ...state.match,
          draft: { ...state.match.draft, picks: [...state.match.draft.picks, ...newPicks] },
        },
      };
    }

    case 'SWAP_DRAFT_TEAMS': {
      const otherTeam = (t: Team): Team => (t === 'A' ? 'B' : 'A');
      const picks = state.match.draft.picks.map((p) => {
        if (p.playerId === action.playerIdA || p.playerId === action.playerIdB) {
          return { ...p, team: otherTeam(p.team) };
        }
        return p;
      });
      // A placement made under the old team assignment is no longer valid —
      // SET_PLACEMENT's sameTeam check would reject any *new* attempt, but
      // won't retroactively fix an existing one.
      const placements: Placements = {};
      for (const [slot, pid] of Object.entries(state.match.placements)) {
        if (pid === action.playerIdA || pid === action.playerIdB) continue;
        placements[slot] = pid;
      }
      return { ...state, match: { ...state.match, draft: { ...state.match.draft, picks }, placements } };
    }

    case 'AUTO_FILL_PLACEMENTS': {
      const byId = new Map(state.players.map((p) => [p.id, p]));
      const slots = formationSlots(state.match.formation);
      const placedIds = new Set(Object.values(state.match.placements).filter((id): id is string => !!id));
      const newPlacements: Placements = {};
      for (const team of ['A', 'B'] as const) {
        const emptySlots = slots.filter((s) => s.team === team && !state.match.placements[s.id]);
        const unplacedPlayers = picksForTeam(state.match.draft.picks, team)
          .map((p) => byId.get(p.playerId))
          .filter((p): p is Player => !!p && !placedIds.has(p.id));
        Object.assign(newPlacements, autoFillSlots(unplacedPlayers, emptySlots));
      }
      return {
        ...state,
        match: { ...state.match, placements: { ...state.match.placements, ...newPlacements } },
      };
    }

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

    case 'SAVE_MATCH_TO_HISTORY':
      return { ...state, history: [action.entry, ...state.history] };

    case 'DELETE_HISTORY_ENTRY':
      return { ...state, history: state.history.filter((h) => h.id !== action.id) };

    case 'SET_HISTORY_SCORE':
      return {
        ...state,
        history: state.history.map((h) =>
          h.id === action.id ? { ...h, scoreA: action.scoreA, scoreB: action.scoreB } : h,
        ),
      };

    case 'LOAD_STATE':
      return action.state;

    case 'SET_MATCH':
      return { ...state, match: action.match };

    default:
      return state;
  }
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
