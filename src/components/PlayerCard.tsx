import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getImageUrl } from '../lib/imageStore';
import { overall, overallDelta } from '../lib/rating';
import { STAT_KEYS } from '../types';
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

const DETAIL_HOVER_DELAY_MS = 1000;
// Shorter than the mouse-hover delay — the conventional long-press
// threshold on mobile OSes, so a hold doesn't feel sluggish compared to a
// native context menu.
const DETAIL_TOUCH_HOLD_DELAY_MS = 500;
const TOUCH_MOVE_CANCEL_PX = 10;

interface PlayerCardProps {
  player: Player;
  /** Position to rate the card at — a pitch slot if placed there, else the player's own preferred position. */
  atPosition?: Position;
  team?: Team;
  selected?: boolean;
  faded?: boolean;
  /** This player is one of the two draft captains — given a slightly tinted background. */
  isCaptain?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  compact?: boolean;
  actions?: ReactNode;
  /**
   * Hides the overall rating, the stat bars, and disables the hover/
   * long-press detail popup (which would otherwise leak those same stats).
   * Used for the stats-voting subject card, so a voter is never anchored
   * by the very numbers they're about to secretly vote on. The position
   * badge stays — voters are told the position, just not the rating.
   */
  hideRatings?: boolean;
}

export function PlayerCard({
  player,
  atPosition,
  team,
  selected,
  faded,
  isCaptain,
  onClick,
  draggable,
  onDragStart,
  compact,
  actions,
  hideRatings,
}: PlayerCardProps) {
  const photoUrl = usePlayerPhotoUrl(player);
  const position = atPosition ?? player.position;
  const rating = overall(player, position);
  const delta = atPosition ? overallDelta(player, atPosition) : 0;

  // A dead/unreachable external photoUrl (network hiccup, expired link)
  // would otherwise render a broken-image icon forever — fall back to the
  // monogram instead. Resets whenever the URL itself changes, so a fresh
  // link gets its own chance to load.
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [photoUrl]);
  const showPhoto = !!photoUrl && !photoFailed;

  const [showDetail, setShowDetail] = useState(false);
  const detailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);

  function handleMouseEnter() {
    if (hideRatings) return;
    detailTimer.current = setTimeout(() => setShowDetail(true), DETAIL_HOVER_DELAY_MS);
  }

  function handleMouseLeave() {
    if (detailTimer.current) clearTimeout(detailTimer.current);
    detailTimer.current = null;
    setShowDetail(false);
  }

  function handleClick() {
    // A click is a deliberate action, not an idle hover — cancel any
    // pending/shown detail popup so it can't surprise-appear afterward.
    // This card's instance can survive the click unmounted (e.g. a pitch
    // slot swap re-uses the same component for a different player, since
    // React keys slots by position, not by occupant), so a timer started
    // before the click would otherwise still fire for whoever ends up here.
    if (detailTimer.current) clearTimeout(detailTimer.current);
    detailTimer.current = null;
    setShowDetail(false);
    onClick?.();
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (hideRatings) return;
    // Don't hijack a long press meant for the Edit/Dup/Del buttons.
    if ((e.target as HTMLElement).closest('.sp-card__actions')) return;
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
    longPressFired.current = false;
    detailTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setShowDetail(true);
    }, DETAIL_TOUCH_HOLD_DELAY_MS);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStart.current || !detailTimer.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    if (Math.hypot(dx, dy) > TOUCH_MOVE_CANCEL_PX) {
      clearTimeout(detailTimer.current);
      detailTimer.current = null;
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (detailTimer.current) {
      clearTimeout(detailTimer.current);
      detailTimer.current = null;
    }
    if (longPressFired.current) {
      // A peek, not a tap — suppress the synthetic click this touch would
      // otherwise produce, so it doesn't also trigger tap-to-select/place.
      e.preventDefault();
      setShowDetail(false);
    }
    touchStart.current = null;
  }

  useEffect(
    () => () => {
      if (detailTimer.current) clearTimeout(detailTimer.current);
    },
    [],
  );

  const classes = ['sp-card'];
  if (compact) classes.push('sp-card--compact');
  if (selected) classes.push('sp-card--selected');
  if (faded) classes.push('sp-card--faded');
  if (isCaptain) classes.push('sp-card--captain');

  return (
    <article
      className={classes.join(' ')}
      data-team={team ?? 'none'}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      draggable={draggable}
      onDragStart={onDragStart}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="sp-card__bar" />
      <div className="sp-card__head">
        {!hideRatings && (
          <span className="sp-card__overall">
            {rating}
            {delta !== 0 && (
              <span className={`sp-card__delta ${delta < 0 ? 'sp-card__delta--down' : 'sp-card__delta--up'}`}>
                {delta > 0 ? '+' : ''}
                {delta}
              </span>
            )}
          </span>
        )}
        <span className="sp-badge">{position}</span>
      </div>
      <div className="sp-card__photo">
        {showPhoto ? <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} /> : <Monogram name={player.name} />}
      </div>
      <div className="sp-card__name" title={player.name}>
        {player.name}
        {player.nickname && <span className="sp-card__nickname"> ({player.nickname})</span>}
      </div>
      {!compact && !hideRatings && (
        <div className="sp-card__stats">
          {STAT_KEYS.map((key) => (
            <StatBlocks key={key} statKey={key} value={player.stats[key]} />
          ))}
        </div>
      )}
      {actions && (
        <div className="sp-card__actions" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
      {showDetail && !hideRatings && (
        <div className="sp-card__detail" role="tooltip">
          <div className="sp-card__detail-photo">
            {showPhoto ? <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} /> : <Monogram name={player.name} />}
          </div>
          <div className="sp-card__detail-name">
            {player.name}
            {player.nickname && <span className="sp-card__nickname"> ({player.nickname})</span>}
          </div>
          <div className="sp-card__detail-meta">
            <span className="sp-badge">{position}</span>
            <span className="sp-card__detail-overall">{rating}</span>
          </div>
          <div className="sp-card__stats">
            {STAT_KEYS.map((key) => (
              <StatBlocks key={key} statKey={key} value={player.stats[key]} />
            ))}
          </div>
          {player.taunt && <p className="sp-card__taunt">&ldquo;{player.taunt}&rdquo;</p>}
        </div>
      )}
    </article>
  );
}
