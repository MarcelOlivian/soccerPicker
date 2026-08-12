import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { StorageQuotaError, store } from '../lib/storage';
import type { AppState } from '../types';
import type { Action } from './reducer';
import { reduce } from './reducer';

interface AppContextValue {
  state: AppState;
  dispatch: (action: Action) => void;
  storageError: string | null;
  dismissStorageError: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const AUTOSAVE_DEBOUNCE_MS = 400;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => store.load());
  const [storageError, setStorageError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const dispatch = useCallback((action: Action) => {
    setState((prev) => reduce(prev, action));
  }, []);

  useEffect(() => {
    // Skip autosaving the state we just loaded from storage on mount.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        store.save(state);
      } catch (err) {
        if (err instanceof StorageQuotaError) {
          setStorageError(err.message);
        } else {
          throw err;
        }
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const dismissStorageError = useCallback(() => setStorageError(null), []);

  const value = useMemo(
    () => ({ state, dispatch, storageError, dismissStorageError }),
    [state, dispatch, storageError, dismissStorageError],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within an AppProvider');
  return ctx;
}
