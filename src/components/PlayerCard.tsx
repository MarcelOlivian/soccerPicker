import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getImageUrl } from '../lib/imageStore';
import { overall, overallDelta } from '../lib/rating';
import { formatStatsVerifiedAt, isStatsVerified } from '../lib/statsVerified';
import { STAT_KEYS } from '../types';
import type { Player, Position, Team } from '../types';
import { Monogram } from './Monogram';
import { RadarChart } from './RadarChart';
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
  /**
   * Renders a small flip icon; clicking it toggles the card between its
   * normal face and a name+overall+radar-chart view. Only meaningful when
   * !hideRatings. Used only by the Setup roster grid and the Draft-stage
   * deck — nowhere else in the app passes this.
   */
  allowRadarFlip?: boolean;
  /**
   * Renders a compare-selection badge in .sp-card__head-right, reading
   * "● Selected"/"○ Select" purely off the `selected` prop (no separate
   * state, so it can never drift out of sync with the outline). Used only
   * by the Compare tab's picker list.
   */
  compareBadge?: boolean;
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
  allowRadarFlip,
  compareBadge,
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

  const [showRadar, setShowRadar] = useState(false);

  function handleFlipClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowRadar((v) => !v);
  }

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
    // Don't hijack a long press meant for the Edit/Dup/Del buttons or the flip icon.
    if ((e.target as HTMLElement).closest('.sp-card__actions, .sp-card__flip')) return;
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

  const verified = isStatsVerified(player);
  const verifiedTitle =
    verified && player.statsVerifiedAt
      ? `Stats voted by ${player.statsVerifiedBy!.join(', ')} on ${formatStatsVerifiedAt(player.statsVerifiedAt)}`
      : 'Stats set by a stats vote';

  const canFlip = !!allowRadarFlip && !hideRatings;

  const classes = ['sp-card'];
  if (compact) classes.push('sp-card--compact');
  if (selected) classes.push('sp-card--selected');
  if (faded) classes.push('sp-card--faded');
  if (isCaptain) classes.push('sp-card--captain');
  if (verified) classes.push('sp-card--verified');

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
        <span className="sp-card__head-right">
          {verified && (
            <span className="sp-badge sp-badge--verified" title={verifiedTitle}>
              ✓
            </span>
          )}
          {compareBadge && (
            <span className={`sp-badge ${selected ? 'sp-badge--compare-on' : ''}`}>
              {selected ? '● Selected' : '○ Select'}
            </span>
          )}
          {canFlip && (
            <button
              type="button"
              className={`sp-card__flip ${showRadar ? 'sp-card__flip--active' : ''}`}
              onClick={handleFlipClick}
              aria-label={showRadar ? 'Show player card' : 'Show stats radar'}
              title={showRadar ? 'Show player card' : 'Show stats radar'}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <polygon points="10,2 17,6 17,14 10,18 3,14 3,6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="10" cy="10" r="1" fill="currentColor" />
              </svg>
            </button>
          )}
          <span className="sp-badge">{position}</span>
        </span>
      </div>
      <div className="sp-card__photo">
        {showRadar ? (
          <RadarChart
            series={[{ label: player.name, color: 'var(--sp-accent)', values: player.stats }]}
            showAxisLabels={!compact}
          />
        ) : showPhoto ? (
          <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} />
        ) : (
          <Monogram name={player.name} />
        )}
      </div>
      <div className="sp-card__name" title={player.name}>
        {player.name}
        {player.nickname && <span className="sp-card__nickname"> ({player.nickname})</span>}
      </div>
      {!compact && !hideRatings && !showRadar && (
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
            {verified && (
              <span className="sp-badge sp-badge--verified" title={verifiedTitle}>
                ✓
              </span>
            )}
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
