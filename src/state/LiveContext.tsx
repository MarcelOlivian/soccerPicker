import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ClientSession } from '../sync/clientSession';
import { createClientSession } from '../sync/clientSession';
import type { HostSession } from '../sync/hostSession';
import { createHostSession } from '../sync/hostSession';
import type { PeerJsServerConfig } from '../sync/peerjsTransport';
import { PeerJsTransport } from '../sync/peerjsTransport';
import type { ConnectionStatus, SyncTransport } from '../sync/transport';
import { useAppState } from './AppContext';

export type LiveRole = 'solo' | 'host' | 'client';
export type LiveStatus = ConnectionStatus | 'idle';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I — easy to read aloud

function generateSessionCode(): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `SOCCER-${code}`;
}

// Defaults to PeerJS's public cloud broker. Set VITE_PEERJS_HOST at build
// time (see e2e/live.spec.ts) to point at a self-hosted/local PeerServer
// instead — this is the entire override surface if the public broker ever
// needs replacing.
const PEERJS_SERVER_CONFIG: PeerJsServerConfig | undefined = import.meta.env.VITE_PEERJS_HOST
  ? {
      host: import.meta.env.VITE_PEERJS_HOST,
      port: Number(import.meta.env.VITE_PEERJS_PORT) || 443,
      path: import.meta.env.VITE_PEERJS_PATH || '/',
      secure: import.meta.env.VITE_PEERJS_SECURE === 'true',
    }
  : undefined;

interface LiveContextValue {
  role: LiveRole;
  status: LiveStatus;
  sessionCode: string | null;
  errorMessage: string | null;
  /** Client-only: true once HELLO has been processed and local state reflects the host's roster/match. */
  synced: boolean;
  goLive: () => void;
  stopLive: () => void;
  joinSession: (code: string) => void;
  leaveSession: () => void;
  applyPick: (playerId: string) => void;
  setPlacement: (slotId: string, playerId: string | null) => void;
  swapPlacements: (slotA: string, slotB: string) => void;
}

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useAppState();
  const [role, setRole] = useState<LiveRole>('solo');
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);

  const transportRef = useRef<SyncTransport | null>(null);
  const hostSessionRef = useRef<HostSession | null>(null);
  const clientSessionRef = useRef<ClientSession | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const teardown = useCallback(() => {
    hostSessionRef.current?.dispose();
    hostSessionRef.current = null;
    clientSessionRef.current?.dispose();
    clientSessionRef.current = null;
    transportRef.current?.close();
    transportRef.current = null;
  }, []);

  const goLive = useCallback(() => {
    teardown();
    const code = generateSessionCode();
    setSessionCode(code);
    setRole('host');
    setStatus('connecting');
    setErrorMessage(null);
    setSynced(true); // host's own state is already the source of truth

    const transport = PeerJsTransport.host(
      code,
      (err) => {
        setErrorMessage(err.message);
        setStatus('error');
      },
      PEERJS_SERVER_CONFIG,
    );
    transportRef.current = transport;
    transport.onStatus(setStatus);

    hostSessionRef.current = createHostSession({
      transport,
      getState: () => stateRef.current,
      dispatch,
    });
  }, [dispatch, teardown]);

  const joinSession = useCallback(
    (code: string) => {
      teardown();
      const normalized = code.trim().toUpperCase();
      setSessionCode(normalized);
      setRole('client');
      setStatus('connecting');
      setErrorMessage(null);
      setSynced(false);

      const transport = PeerJsTransport.join(
        normalized,
        (err) => {
          setErrorMessage(err.message);
          setStatus('error');
        },
        PEERJS_SERVER_CONFIG,
      );
      transportRef.current = transport;

      const session = createClientSession({
        transport,
        dispatch,
        getState: () => stateRef.current,
        onHello: () => setSynced(true),
        onBye: (reason) => setErrorMessage(reason),
      });
      clientSessionRef.current = session;

      let hasJoinedThisConnection = false;
      transport.onStatus((s) => {
        setStatus(s);
        if (s === 'open' && !hasJoinedThisConnection) {
          hasJoinedThisConnection = true;
          session.join();
        }
        if (s !== 'open') {
          hasJoinedThisConnection = false; // a reconnect gets a fresh JOIN → fresh HELLO
          setSynced(false);
        }
      });
    },
    [dispatch, teardown],
  );

  const stopLive = useCallback(() => {
    teardown();
    setRole('solo');
    setStatus('idle');
    setSessionCode(null);
    setErrorMessage(null);
    setSynced(false);
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  // Broadcast to the client on every match change, whether it came from a
  // local host click or a validated remote PICK/PLACE/SWAP — both paths
  // dispatch through the exact same reducer, so this is the one place that
  // needs to know about it.
  useEffect(() => {
    if (role === 'host' && status === 'open') {
      hostSessionRef.current?.broadcastState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status, state.match]);

  const applyPick = useCallback(
    (playerId: string) => {
      if (role === 'client') clientSessionRef.current?.sendPick(playerId);
      else dispatch({ type: 'APPLY_PICK', playerId });
    },
    [role, dispatch],
  );

  const setPlacement = useCallback(
    (slotId: string, playerId: string | null) => {
      if (role === 'client') clientSessionRef.current?.sendPlace(slotId, playerId);
      else dispatch({ type: 'SET_PLACEMENT', slotId, playerId });
    },
    [role, dispatch],
  );

  const swapPlacements = useCallback(
    (slotA: string, slotB: string) => {
      if (role === 'client') clientSessionRef.current?.sendSwap(slotA, slotB);
      else dispatch({ type: 'SWAP_PLACEMENTS', slotA, slotB });
    },
    [role, dispatch],
  );

  const value: LiveContextValue = {
    role,
    status,
    sessionCode,
    errorMessage,
    synced,
    goLive,
    stopLive,
    joinSession,
    leaveSession: stopLive,
    applyPick,
    setPlacement,
    swapPlacements,
  };

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within a LiveProvider');
  return ctx;
}
