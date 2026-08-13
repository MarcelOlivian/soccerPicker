import type { AppState } from '../types';
import { emptyMatch } from '../types';

const STORAGE_KEY = 'soccerpicker.v1';

export function defaultState(): AppState {
  return { schemaVersion: 2, players: [], match: emptyMatch(), history: [] };
}

/**
 * Behind an interface so a future cloud backend (Supabase, a Worker, etc.)
 * can be dropped in without touching the reducer or components that call it.
 */
export interface Store {
  load(): AppState;
  save(state: AppState): void;
}

export class StorageQuotaError extends Error {
  constructor() {
    super('Local storage is full — your roster could not be saved.');
    this.name = 'StorageQuotaError';
  }
}

/**
 * Reshapes whatever was persisted into a valid current-shape AppState.
 * v1 (pre-history) payloads are upgraded by backfilling an empty history
 * list — this is the seam the old comment here called out, now exercised
 * for the first time.
 */
function migrate(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return defaultState();
  const obj = raw as {
    schemaVersion?: number;
    players?: AppState['players'];
    match?: Partial<AppState['match']>;
    history?: AppState['history'];
  };
  if (obj.schemaVersion !== 1 && obj.schemaVersion !== 2) return defaultState();
  if (!Array.isArray(obj.players)) return defaultState();
  if (!obj.match || typeof obj.match !== 'object') return defaultState();
  return {
    schemaVersion: 2,
    players: obj.players,
    match: { ...emptyMatch(), ...obj.match },
    history: Array.isArray(obj.history) ? obj.history : [],
  };
}

class LocalStorageStore implements Store {
  load(): AppState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return migrate(JSON.parse(raw));
    } catch {
      // Corrupt JSON or storage inaccessible (e.g. private browsing) — start fresh.
      return defaultState();
    }
  }

  save(state: AppState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
        throw new StorageQuotaError();
      }
      throw err;
    }
  }
}

export const store: Store = new LocalStorageStore();
