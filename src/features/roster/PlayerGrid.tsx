import { useMemo, useState } from 'react';
import { PlayerCard } from '../../components/PlayerCard';
import { preferredOverall } from '../../lib/rating';
import type { Player } from '../../types';

type SortKey = 'name' | 'overall' | 'position';

interface PlayerGridProps {
  players: Player[];
  onEdit: (player: Player) => void;
  onDuplicate: (player: Player) => void;
  onDelete: (player: Player) => void;
}

export function PlayerGrid({ players, onEdit, onDuplicate, onDelete }: PlayerGridProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? players.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q),
        )
      : players;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'position') return a.position.localeCompare(b.position) || a.name.localeCompare(b.name);
      if (sortKey === 'overall') return preferredOverall(b) - preferredOverall(a);
      return a.name.localeCompare(b.name);
    });
  }, [players, query, sortKey]);

  return (
    <div>
      <div className="sp-roster-toolbar">
        <input
          type="text"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search players"
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort players">
          <option value="name">Sort: Name</option>
          <option value="overall">Sort: Overall</option>
          <option value="position">Sort: Position</option>
        </select>
      </div>
      <div className="sp-player-grid">
        {visible.map((player) => (
          <PlayerCard
            key={player.id}
            player={player}
            actions={
              <>
                <button type="button" className="sp-btn sp-btn--sm" onClick={() => onEdit(player)}>
                  Edit
                </button>
                <button type="button" className="sp-btn sp-btn--sm" onClick={() => onDuplicate(player)}>
                  Dup
                </button>
                <button
                  type="button"
                  className="sp-btn sp-btn--sm sp-btn--danger"
                  onClick={() => onDelete(player)}
                >
                  Del
                </button>
              </>
            }
          />
        ))}
      </div>
      {visible.length === 0 && <p className="sp-hint">No players match “{query}”.</p>}
    </div>
  );
}
