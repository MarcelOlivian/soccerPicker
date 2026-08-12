import { putImage } from '../lib/imageStore';
import type { Action } from '../state/reducer';
import type { AppState, Player } from '../types';
import type { HostMessage } from './protocol';
import type { SyncTransport } from './transport';

export interface ClientSessionDeps {
  transport: SyncTransport;
  dispatch: (action: Action) => void;
  getState: () => AppState;
  onHello?: () => void;
  onBye?: (reason: string) => void;
}

export interface ClientSession {
  sendPick: (playerId: string) => void;
  sendPlace: (slotId: string, playerId: string | null) => void;
  sendSwap: (slotA: string, slotB: string) => void;
  join: (displayName?: string) => void;
  dispose: () => void;
}

/**
 * The client never mutates match state on its own initiative — it renders
 * whatever the host last broadcast, and turns local user actions (a pick, a
 * drag on the board) into intents sent back over the wire. HELLO replaces
 * the whole local player list/match state once, up front; STATE messages
 * after that only ever touch match state, so photos streamed in via PHOTOS
 * (which arrive progressively, after HELLO) don't get wiped by a later
 * STATE update.
 */
export function createClientSession(deps: ClientSessionDeps): ClientSession {
  const { transport, dispatch, getState } = deps;

  const unsubscribe = transport.onMessage((msg) => {
    const message = msg as HostMessage;
    switch (message.type) {
      case 'HELLO': {
        const players: Player[] = message.players.map((p) => ({ ...p, photoKey: undefined }));
        dispatch({ type: 'LOAD_STATE', state: { schemaVersion: 1, players, match: message.match } });
        deps.onHello?.();
        break;
      }
      case 'PHOTOS': {
        void (async () => {
          const blob = await (await fetch(message.dataUrl)).blob();
          const key = await putImage(blob);
          const player = getState().players.find((p) => p.id === message.playerId);
          if (player) dispatch({ type: 'UPDATE_PLAYER', player: { ...player, photoKey: key } });
        })();
        break;
      }
      case 'STATE':
        dispatch({ type: 'SET_MATCH', match: message.match });
        break;
      case 'BYE':
        deps.onBye?.(message.reason);
        break;
    }
  });

  return {
    sendPick: (playerId) => transport.send({ type: 'PICK', playerId }),
    sendPlace: (slotId, playerId) => transport.send({ type: 'PLACE', slotId, playerId }),
    sendSwap: (slotA, slotB) => transport.send({ type: 'SWAP', slotA, slotB }),
    join: (displayName) => transport.send({ type: 'JOIN', displayName }),
    dispose: unsubscribe,
  };
}
