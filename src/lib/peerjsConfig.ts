import type { PeerJsServerConfig } from '../sync/peerjsTransport';

// Defaults to PeerJS's public cloud broker. Set VITE_PEERJS_HOST at build
// time (see e2e/live.spec.ts) to point at a self-hosted/local PeerServer
// instead — this is the entire override surface if the public broker ever
// needs replacing. Shared by both the live-draft transport (LiveContext)
// and the stats-voting transport (VotingContext) — same broker, same
// override, whichever feature is active.
export const PEERJS_SERVER_CONFIG: PeerJsServerConfig | undefined = import.meta.env.VITE_PEERJS_HOST
  ? {
      host: import.meta.env.VITE_PEERJS_HOST,
      port: Number(import.meta.env.VITE_PEERJS_PORT) || 443,
      path: import.meta.env.VITE_PEERJS_PATH || '/',
      secure: import.meta.env.VITE_PEERJS_SECURE === 'true',
    }
  : undefined;
