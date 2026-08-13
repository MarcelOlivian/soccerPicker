import type { DragEvent } from 'react';
import { teamShortName } from '../lib/draft';
import type { Placements, Player, Team } from '../types';
import { PlayerCard } from './PlayerCard';

interface TeamColumnProps {
  team: Team;
  players: Player[];
  placements: Placements;
  strength: number;
  selectedPlayerId?: string | null;
  captainId?: string;
  /** Touch input: native drag competes with the OS's own long-press handling, so it's disabled in favor of tap-to-select. */
  coarsePointer?: boolean;
  onSelectPlayer: (playerId: string) => void;
  onDropUnassign: (e: DragEvent) => void;
}

/** Full team roster, dropping whoever is already placed on the pitch. Doubles as a drag target for un-assigning. */
export function TeamColumn({
  team,
  players,
  placements,
  strength,
  selectedPlayerId,
  captainId,
  coarsePointer,
  onSelectPlayer,
  onDropUnassign,
}: TeamColumnProps) {
  const placedIds = new Set(Object.values(placements).filter((id): id is string => !!id));
  const unplacedPlayers = players.filter((p) => !placedIds.has(p.id));
  const captain = players.find((p) => p.id === captainId);

  return (
    <div
      className="sp-team-column"
      data-team={team}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropUnassign}
    >
      <div className="sp-team-column__head">
        <h4>Team {teamShortName(captain?.name, team)}</h4>
        <span className="sp-badge">{strength}</span>
      </div>
      <div className="sp-team-column__list">
        {unplacedPlayers.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            team={team}
            compact
            isCaptain={p.id === captainId}
            selected={selectedPlayerId === p.id}
            draggable={!coarsePointer}
            onDragStart={(e) => e.dataTransfer.setData('application/x-player-id', p.id)}
            onClick={() => onSelectPlayer(p.id)}
          />
        ))}
        {players.length === 0 && <p className="sp-hint">No players drafted.</p>}
        {players.length > 0 && unplacedPlayers.length === 0 && <p className="sp-hint">All placed on the pitch.</p>}
      </div>
    </div>
  );
}
