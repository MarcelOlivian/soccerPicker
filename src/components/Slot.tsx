import type { CSSProperties, DragEvent } from 'react';
import type { SlotDef } from '../lib/formations';
import { slotCoords } from '../lib/formations';
import type { Player } from '../types';
import { PlayerCard } from './PlayerCard';

interface SlotProps {
  slot: SlotDef;
  player?: Player;
  /** This slot's occupant is the currently selected (click-to-place) player. */
  isSelected: boolean;
  /** A player is pending placement, so an empty slot should hint that it's a valid target. */
  isDropTarget: boolean;
  /** The pitch is turned a quarter turn (phone layout), so coordinates transpose. */
  portrait?: boolean;
  onClick: () => void;
  onDrop: (e: DragEvent) => void;
  onCardDragStart: (e: DragEvent) => void;
  onClear: () => void;
}

/** A single pitch position: a drop target when empty, a draggable placed card when filled. */
export function Slot({
  slot,
  player,
  isSelected,
  isDropTarget,
  portrait = false,
  onClick,
  onDrop,
  onCardDragStart,
  onClear,
}: SlotProps) {
  const style: CSSProperties = slotCoords(slot, portrait);

  return (
    <div
      className={`sp-slot ${player ? 'sp-slot--filled' : 'sp-slot--empty'}`}
      style={style}
      onClick={onClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label={player ? `${slot.position} slot, occupied by ${player.name}` : `${slot.position} slot, empty`}
    >
      {player ? (
        <div className="sp-slot__card">
          <PlayerCard
            player={player}
            atPosition={slot.position}
            team={slot.team}
            compact
            selected={isSelected}
            draggable
            onDragStart={onCardDragStart}
          />
          <button
            type="button"
            className="sp-slot__clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label={`Remove ${player.name} from this slot`}
          >
            ×
          </button>
        </div>
      ) : (
        <div className={`sp-slot__placeholder ${isDropTarget ? 'sp-slot__placeholder--target' : ''}`}>
          {slot.position}
        </div>
      )}
    </div>
  );
}
