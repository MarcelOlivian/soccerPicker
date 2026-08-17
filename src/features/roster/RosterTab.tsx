import { useState } from 'react';
import { deleteImage } from '../../lib/imageStore';
import { demoRoster } from '../../lib/demoRoster';
import { appendStatHistoryEntry, inferStatChangeSource } from '../../lib/statHistory';
import { useAppState } from '../../state/AppContext';
import type { Player } from '../../types';
import { PlayerForm } from './PlayerForm';
import { PlayerGrid } from './PlayerGrid';

type FormTarget = 'new' | Player | null;

export function RosterTab() {
  const { state, dispatch } = useAppState();
  const [formTarget, setFormTarget] = useState<FormTarget>(null);

  function handleSave(player: Player) {
    const previous = formTarget === 'new' ? undefined : state.players.find((p) => p.id === player.id);
    const enriched = appendStatHistoryEntry(previous, player, inferStatChangeSource(previous, player));
    dispatch({ type: formTarget === 'new' ? 'ADD_PLAYER' : 'UPDATE_PLAYER', player: enriched });
    setFormTarget(null);
  }

  function handleDuplicate(player: Player) {
    // Uploaded photos aren't copied — sharing an IndexedDB key between two
    // players would make deleting one silently break the other's photo.
    // URL-based photos carry over fine since they're just a string.
    const newPlayer: Player = {
      ...player,
      id: crypto.randomUUID(),
      name: `${player.name} (copy)`,
      photoKey: undefined,
      // The copy hasn't itself been through a vote, edit, or suggestion —
      // even if the original had.
      statsVerifiedBy: undefined,
      statsVerifiedAt: undefined,
      statHistory: undefined,
      createdAt: Date.now(),
    };
    dispatch({ type: 'DUPLICATE_PLAYER', id: player.id, newPlayer });
  }

  async function handleDelete(player: Player) {
    if (!confirm(`Remove ${player.name} from the roster?`)) return;
    if (player.photoKey) await deleteImage(player.photoKey);
    dispatch({ type: 'DELETE_PLAYER', id: player.id });
  }

  function handleLoadDemo() {
    dispatch({ type: 'MERGE_PLAYERS', players: demoRoster(), mode: 'merge' });
  }

  return (
    <div className="sp-roster-tab">
      <div className="sp-roster-tab__header">
        <h2>Player database</h2>
        <div className="sp-header__controls">
          {state.players.length === 0 && (
            <button type="button" className="sp-btn" onClick={handleLoadDemo}>
              Load 14 demo players
            </button>
          )}
          <button type="button" className="sp-btn sp-btn--primary" onClick={() => setFormTarget('new')}>
            + New player
          </button>
        </div>
      </div>

      {formTarget && (
        <PlayerForm
          initial={formTarget === 'new' ? undefined : formTarget}
          onSave={handleSave}
          onCancel={() => setFormTarget(null)}
        />
      )}

      {state.players.length === 0 && !formTarget ? (
        <div className="sp-panel sp-empty-state">
          <p>No players yet. Add your regulars, or start from a demo roster.</p>
        </div>
      ) : (
        <PlayerGrid
          players={state.players}
          onEdit={setFormTarget}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
