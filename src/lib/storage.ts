import type { AppState } from '../types';
import { emptyMatch } from '../types';

const STORAGE_KEY = 'soccerpicker.v1';

export function defaultState(): AppState {
  return { schemaVersion: 1, players: [], match: emptyMatch() };
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
 * There is only one schema version so far; this is the seam where a future
 * version bump gets a real migration instead of silently discarding data.
 */
function migrate(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') return defaultState();
  const obj = raw as Partial<AppState>;
  if (obj.schemaVersion !== 1) return defaultState();
  if (!Array.isArray(obj.players)) return defaultState();
  if (!obj.match || typeof obj.match !== 'object') return defaultState();
  return {
    schemaVersion: 1,
    players: obj.players,
    match: { ...emptyMatch(), ...obj.match },
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
