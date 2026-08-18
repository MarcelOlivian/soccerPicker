import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { overall, overallDelta } from '../lib/rating';
import { formatStatsVerifiedAt, isStatsVerified } from '../lib/statsVerified';
import { usePlayerPhotoUrl } from '../lib/usePlayerPhotoUrl';
import { STAT_KEYS } from '../types';
import type { Player, Position, Team } from '../types';
import { Monogram } from './Monogram';
import { PlayerDetailModal } from './PlayerDetailModal';
import { RadarChart } from './RadarChart';
import { StatBlocks } from './StatBlocks';

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
   * Hides the overall rating, the stat bars, and the inspect icon (which would otherwise leak
   * those same stats via the detail modal). Used for the stats-voting subject card, so a voter
   * is never anchored by the very numbers they're about to secretly vote on. The position badge
   * stays — voters are told the position, just not the rating.
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

  const [showRadar, setShowRadar] = useState(false);
  const [showModal, setShowModal] = useState(false);

  function handleFlipClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowRadar((v) => !v);
  }

  function handleInspectClick(e: React.MouseEvent) {
    e.stopPropagation();
    setShowModal(true);
  }

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
      onClick={onClick}
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
          {!hideRatings && (
            <button
              type="button"
              className="sp-card__expand"
              onClick={handleInspectClick}
              aria-label={`View details for ${player.name}`}
              title="View details"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M12.7 12.7 L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
      {showModal && <PlayerDetailModal player={player} atPosition={position} onClose={() => setShowModal(false)} />}
    </article>
  );
}
