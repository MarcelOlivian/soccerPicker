import { useEffect, useState } from 'react';
import { formatShortDate } from '../lib/dateFormat';
import { matchImpactBadges, matchesForPlayer } from '../lib/playerMatchLog';
import { overall, overallDelta } from '../lib/rating';
import { auditLogLines } from '../lib/statHistory';
import { formatStatsVerifiedAt, isStatsVerified } from '../lib/statsVerified';
import { usePlayerPhotoUrl } from '../lib/usePlayerPhotoUrl';
import { useAppState } from '../state/AppContext';
import { STAT_KEYS } from '../types';
import type { Player, Position } from '../types';
import { Modal } from './Modal';
import { Monogram } from './Monogram';
import { RadarChart } from './RadarChart';
import { StatBlocks } from './StatBlocks';

const MAX_MATCHES_SHOWN = 10;
const MAX_AUDIT_LINES_SHOWN = 8;

interface PlayerDetailModalProps {
  player: Player;
  /** Position to rate the card at — a pitch slot if placed there, else the player's own preferred position. */
  atPosition?: Position;
  onClose: () => void;
}

/**
 * Read-only, full-screen inspection view for one player — replaces the old anchored
 * hover/long-press `.sp-card__detail` popup with an explicit, keyboard/touch-friendly modal.
 * Pulls career appearances and the stat-change audit log from the same pure helpers the
 * Evolution tab already uses, rather than duplicating that logic.
 */
export function PlayerDetailModal({ player, atPosition, onClose }: PlayerDetailModalProps) {
  const { state } = useAppState();
  const photoUrl = usePlayerPhotoUrl(player);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [photoUrl]);
  const showPhoto = !!photoUrl && !photoFailed;

  const position = atPosition ?? player.position;
  const rating = overall(player, position);
  const delta = atPosition ? overallDelta(player, atPosition) : 0;
  const verified = isStatsVerified(player);

  const appearances = matchesForPlayer(state.history, player.id);
  const tallies = appearances.reduce(
    (acc, a) => ({
      goals: acc.goals + (a.snapshot.goals ?? 0),
      assists: acc.assists + (a.snapshot.assists ?? 0),
      fouls: acc.fouls + (a.snapshot.fouls ?? 0),
      saves: acc.saves + (a.snapshot.saves ?? 0),
      concedes: acc.concedes + (a.snapshot.concedes ?? 0),
    }),
    { goals: 0, assists: 0, fouls: 0, saves: 0, concedes: 0 },
  );
  const talliesLine = [
    `${tallies.goals}G`,
    `${tallies.assists}A`,
    `${tallies.fouls}F`,
    tallies.saves > 0 ? `${tallies.saves}SV` : null,
    tallies.concedes > 0 ? `${tallies.concedes}CN` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const shownMatches = appearances.slice(0, MAX_MATCHES_SHOWN);
  const hiddenMatchCount = appearances.length - shownMatches.length;

  const audit = auditLogLines(player);
  const shownAudit = audit.slice(0, MAX_AUDIT_LINES_SHOWN);
  const hiddenAuditCount = audit.length - shownAudit.length;

  return (
    <Modal onClose={onClose} ariaLabel={`Details for ${player.name}`} className="sp-modal-panel--wide">
      <div className="sp-player-detail">
        <div className="sp-player-detail__header">
          <div className="sp-player-detail__photo">
            {showPhoto ? (
              <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} />
            ) : (
              <Monogram name={player.name} />
            )}
          </div>
          <div className="sp-player-detail__identity">
            <h3 className="sp-player-detail__name">
              {player.name}
              {player.nickname && <span className="sp-card__nickname"> ({player.nickname})</span>}
            </h3>
            <div className="sp-player-detail__meta-row">
              <span className="sp-badge">{position}</span>
              <span className="sp-player-detail__overall">
                {rating}
                {delta !== 0 && (
                  <span className={`sp-card__delta ${delta < 0 ? 'sp-card__delta--down' : 'sp-card__delta--up'}`}>
                    {delta > 0 ? '+' : ''}
                    {delta}
                  </span>
                )}
              </span>
              {verified && <span className="sp-badge sp-badge--verified">✓ Verified by vote</span>}
            </div>
          </div>
          <button type="button" className="sp-player-detail__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {player.taunt && <p className="sp-card__taunt">&ldquo;{player.taunt}&rdquo;</p>}

        <div className="sp-player-detail__visuals">
          <RadarChart series={[{ label: player.name, color: 'var(--sp-accent)', values: player.stats }]} showAxisLabels />
          <div className="sp-card__stats">
            {STAT_KEYS.map((key) => (
              <StatBlocks key={key} statKey={key} value={player.stats[key]} />
            ))}
          </div>
        </div>

        {verified && player.statsVerifiedAt && (
          <p className="sp-hint">
            Stats voted by {player.statsVerifiedBy!.join(', ')} on {formatStatsVerifiedAt(player.statsVerifiedAt)}.
          </p>
        )}

        <section className="sp-player-detail__history">
          <h4>Career</h4>
          {appearances.length === 0 ? (
            <p className="sp-hint">No saved matches yet.</p>
          ) : (
            <>
              <p className="sp-hint">
                {appearances.length} appearance{appearances.length === 1 ? '' : 's'} · {talliesLine}
              </p>
              <ul>
                {shownMatches.map((a) => {
                  const badges = matchImpactBadges(a.entry, a.snapshot, a.team);
                  const score = a.entry.scoreA !== undefined && a.entry.scoreB !== undefined
                    ? `${a.entry.scoreA}–${a.entry.scoreB}`
                    : 'no score';
                  return (
                    <li key={a.entry.id}>
                      {formatShortDate(a.entry.date)} · {a.snapshot.position} · {score}
                      {badges.length > 0 ? ` · ${badges.join(', ')}` : ''}
                    </li>
                  );
                })}
              </ul>
              {hiddenMatchCount > 0 && <p className="sp-hint">+{hiddenMatchCount} earlier</p>}
            </>
          )}
        </section>

        {shownAudit.length > 0 && (
          <section className="sp-player-detail__audit">
            <h4>Stat history</h4>
            <ul>
              {shownAudit.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            {hiddenAuditCount > 0 && <p className="sp-hint">+{hiddenAuditCount} earlier</p>}
          </section>
        )}
      </div>
    </Modal>
  );
}
