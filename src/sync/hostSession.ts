import { nextTeam, remaining } from '../lib/draft';
import { blobToDataUrl, getImageBlob } from '../lib/imageStore';
import type { Action } from '../state/reducer';
import { teamOf } from '../state/reducer';
import type { AppState, Team } from '../types';
import type { ClientMessage, HostMessage } from './protocol';
import type { SyncTransport } from './transport';

function slotTeamFromId(slotId: string): Team | undefined {
  if (slotId.startsWith('A-')) return 'A';
  if (slotId.startsWith('B-')) return 'B';
  return undefined;
}

/** It's this team's turn, and the player hasn't already been picked by anyone. */
export function canPick(state: AppState, playerId: string, clientTeam: Team): boolean {
  const turn = nextTeam(state.match.draft.picks, state.match.draft.order);
  if (turn !== clientTeam) return false;
  return remaining(state.match.attendingIds, state.match.draft.picks).includes(playerId);
}

/** A client may only touch slots and players on their own side of the pitch. */
export function canPlace(state: AppState, slotId: string, playerId: string | null, clientTeam: Team): boolean {
  const slotTeam = slotTeamFromId(slotId);
  if (slotTeam && slotTeam !== clientTeam) return false;
  if (playerId) {
    const playerTeam = teamOf(state, playerId);
    if (playerTeam && playerTeam !== clientTeam) return false;
  }
  return true;
}

export function canSwap(slotA: string, slotB: string, clientTeam: Team): boolean {
  const teamA = slotTeamFromId(slotA);
  const teamB = slotTeamFromId(slotB);
  if (teamA && teamA !== clientTeam) return false;
  if (teamB && teamB !== clientTeam) return false;
  return true;
}

export interface HostSessionDeps {
  transport: SyncTransport;
  getState: () => AppState;
  dispatch: (action: Action) => void;
  /** Which team the connected client plays as. Defaults to 'B' (the host is always 'A'). */
  clientTeam?: Team;
}

export interface HostSession {
  /** Push the current match state to the client. Call this whenever match state changes, from any source. */
  broadcastState: () => void;
  dispose: () => void;
}

/**
 * Wires a transport to the app's own reducer. The host never trusts a
 * client message directly — every PICK/PLACE/SWAP is validated against
 * current state before being turned into the exact same dispatch a local
 * click would produce. Rejected messages are silently dropped: the client
 * has no local mutation to roll back, so there's nothing to correct.
 */
export function createHostSession(deps: HostSessionDeps): HostSession {
  const { transport, getState, dispatch } = deps;
  const clientTeam: Team = deps.clientTeam ?? 'B';

  async function streamPhotos(state: AppState) {
    for (const player of state.players) {
      if (!player.photoKey) continue;
      const blob = await getImageBlob(player.photoKey);
      if (!blob) continue;
      transport.send({ type: 'PHOTOS', playerId: player.id, dataUrl: await blobToDataUrl(blob) });
    }
  }

  function sendHello() {
    const state = getState();
    const players = state.players.map(({ photoKey: _photoKey, ...rest }) => rest);
    const hello: HostMessage = { type: 'HELLO', players, match: state.match, youAre: clientTeam };
    transport.send(hello);
    void streamPhotos(state);
  }

  const unsubscribe = transport.onMessage((msg) => {
    const message = msg as ClientMessage;
    switch (message.type) {
      case 'JOIN':
        // A rejoin (reconnect, or a second device opening the same link)
        // just gets the full current state again — there is no per-client
        // session state to reconcile since the host is the only writer.
        sendHello();
        break;
      case 'PICK': {
        const state = getState();
        if (canPick(state, message.playerId, clientTeam)) {
          dispatch({ type: 'APPLY_PICK', playerId: message.playerId });
        }
        break;
      }
      case 'PLACE': {
        const state = getState();
        if (canPlace(state, message.slotId, message.playerId, clientTeam)) {
          dispatch({ type: 'SET_PLACEMENT', slotId: message.slotId, playerId: message.playerId });
        }
        break;
      }
      case 'SWAP': {
        if (canSwap(message.slotA, message.slotB, clientTeam)) {
          dispatch({ type: 'SWAP_PLACEMENTS', slotA: message.slotA, slotB: message.slotB });
        }
        break;
      }
      case 'PING':
        break;
    }
  });

  return {
    broadcastState: () => transport.send({ type: 'STATE', match: getState().match }),
    dispose: unsubscribe,
  };
}
