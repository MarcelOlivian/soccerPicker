import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getImageUrl } from '../lib/imageStore';
import { overall, overallDelta } from '../lib/rating';
import type { Player, Position, Team } from '../types';
import { Monogram } from './Monogram';
import { StatBlocks } from './StatBlocks';

/** Resolves a player's photo to a displayable URL, whether it's an external link or an uploaded IndexedDB blob. */
export function usePlayerPhotoUrl(player: Player): string | undefined {
  const [url, setUrl] = useState<string | undefined>(player.photoUrl);

  useEffect(() => {
    let cancelled = false;
    if (player.photoUrl) {
      setUrl(player.photoUrl);
      return;
    }
    if (player.photoKey) {
      getImageUrl(player.photoKey).then((resolved) => {
        if (!cancelled) setUrl(resolved);
      });
    } else {
      setUrl(undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [player.photoUrl, player.photoKey]);

  return url;
}

interface PlayerCardProps {
  player: Player;
  /** Position to rate the card at — a pitch slot if placed there, else the player's own preferred position. */
  atPosition?: Position;
  team?: Team;
  selected?: boolean;
  faded?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
  actions?: ReactNode;
}

export function PlayerCard({
  player,
  atPosition,
  team,
  selected,
  faded,
  onClick,
  draggable,
  onDragStart,
  compact,
  actions,
}: PlayerCardProps) {
  const photoUrl = usePlayerPhotoUrl(player);
  const position = atPosition ?? player.position;
  const rating = overall(player, position);
  const delta = atPosition ? overallDelta(player, atPosition) : 0;

  const classes = ['sp-card'];
  if (compact) classes.push('sp-card--compact');
  if (selected) classes.push('sp-card--selected');
  if (faded) classes.push('sp-card--faded');

  return (
    <article
      className={classes.join(' ')}
      data-team={team ?? 'none'}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="sp-card__bar" />
      <div className="sp-card__head">
        <span className="sp-card__overall">
          {rating}
          {delta !== 0 && (
            <span className={`sp-card__delta ${delta < 0 ? 'sp-card__delta--down' : 'sp-card__delta--up'}`}>
              {delta > 0 ? '+' : ''}
              {delta}
            </span>
          )}
        </span>
        <span className="sp-badge">{position}</span>
      </div>
      <div className="sp-card__photo">
        {photoUrl ? <img src={photoUrl} alt="" /> : <Monogram name={player.name} />}
      </div>
      <div className="sp-card__name" title={player.name}>
        {player.nickname ? player.nickname : player.name}
      </div>
      {!compact && (
        <div className="sp-card__stats">
          <StatBlocks label="PAC" value={player.stats.pace} />
          <StatBlocks label="STA" value={player.stats.stamina} />
          <StatBlocks label="FIN" value={player.stats.finishing} />
          <StatBlocks label="DEF" value={player.stats.defending} />
          <StatBlocks label="PAS" value={player.stats.passing} />
          <StatBlocks label="GKP" value={player.stats.goalkeeping} />
        </div>
      )}
      {actions && (
        <div className="sp-card__actions" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </article>
  );
}
