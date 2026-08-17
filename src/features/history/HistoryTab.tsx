import { useState } from 'react';
import { FORMATION_LABELS } from '../../lib/formations';
import { buildEventFeed, formatEventFeedForShare, formatMatchSummaryForShare } from '../../lib/matchEvents';
import type { SummaryPlayerLine } from '../../lib/matchEvents';
import { useAppState } from '../../state/AppContext';
import type { HistoryPlayerSnapshot, MatchHistoryEntry, Team } from '../../types';
import { EventFeed } from '../match/EventFeed';

export function HistoryTab() {
  const { state, dispatch } = useAppState();
  const { history } = state;

  if (history.length === 0) {
    return (
      <div className="sp-panel">
        <p className="sp-hint">No saved matches yet — arrange a lineup on the Field tab and save it here.</p>
      </div>
    );
  }

  return (
    <div className="sp-stage">
      {history.map((entry) => (
        <HistoryEntryPanel
          key={entry.id}
          entry={entry}
          onDelete={() => {
            if (confirm('Delete this saved match? This cannot be undone.')) {
              dispatch({ type: 'DELETE_HISTORY_ENTRY', id: entry.id });
            }
          }}
          onSaveScore={(scoreA, scoreB) => dispatch({ type: 'SET_HISTORY_SCORE', id: entry.id, scoreA, scoreB })}
        />
      ))}
    </div>
  );
}

function HistoryEntryPanel({
  entry,
  onDelete,
  onSaveScore,
}: {
  entry: MatchHistoryEntry;
  onDelete: () => void;
  onSaveScore: (scoreA?: number, scoreB?: number) => void;
}) {
  const dateLabel = new Date(entry.date).toISOString().slice(0, 10);
  const hasScore = entry.scoreA !== undefined && entry.scoreB !== undefined;
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'info' | 'danger'>('info');

  // entry.events is optional — absent on any match saved before this field
  // existed, so this must fall back to [] rather than crash.
  const nameLookup = new Map([...entry.teamAPlayers, ...entry.teamBPlayers].map((p) => [p.id, p.name]));
  const eventFeed = buildEventFeed(
    entry.events ?? [],
    (id) => nameLookup.get(id) ?? 'Unknown',
    (team) => (team === 'A' ? entry.teamAName : entry.teamBName),
  );

  function toSummaryLine(p: HistoryPlayerSnapshot): SummaryPlayerLine {
    return {
      name: p.name,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
      fouls: p.fouls ?? 0,
      saves: p.saves ?? 0,
      concedes: p.concedes ?? 0,
    };
  }

  async function handleCopySummary() {
    if (!hasScore) return;
    const text = formatMatchSummaryForShare(
      entry.teamAName,
      entry.scoreA!,
      entry.teamAPlayers.map(toSummaryLine),
      entry.teamBName,
      entry.scoreB!,
      entry.teamBPlayers.map(toSummaryLine),
    );
    try {
      await navigator.clipboard.writeText(text);
      setNoticeKind('info');
      setNotice('Match summary copied to clipboard.');
    } catch {
      setNoticeKind('danger');
      setNotice('Could not access the clipboard.');
    }
  }

  async function handleCopyEventLog() {
    try {
      await navigator.clipboard.writeText(formatEventFeedForShare(eventFeed));
      setNoticeKind('info');
      setNotice('Event log copied to clipboard.');
    } catch {
      setNoticeKind('danger');
      setNotice('Could not access the clipboard.');
    }
  }

  function handleSaveScore() {
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) return;
    onSaveScore(a, b);
  }

  return (
    <div className="sp-panel">
      <div className="sp-history-entry__header">
        <div>
          <strong>{dateLabel}</strong>
          <span className="sp-hint"> · {FORMATION_LABELS[entry.formation]}</span>
        </div>
        <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={onDelete}>
          Delete
        </button>
      </div>

      {hasScore ? (
        <p className="sp-history-entry__score">
          Team {entry.teamAName} {entry.scoreA} – {entry.scoreB} Team {entry.teamBName}
        </p>
      ) : (
        <div className="sp-history-entry__score-form">
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={`Team ${entry.teamAName} score`}
            placeholder={`${entry.teamAName}`}
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value)}
          />
          <span>–</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            aria-label={`Team ${entry.teamBName} score`}
            placeholder={`${entry.teamBName}`}
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value)}
          />
          <button
            type="button"
            className="sp-btn sp-btn--sm"
            disabled={scoreA === '' || scoreB === ''}
            onClick={handleSaveScore}
          >
            Save score
          </button>
        </div>
      )}

      <div className="sp-history-entry__teams">
        <HistoryTeamColumn team="A" name={entry.teamAName} players={entry.teamAPlayers} />
        <HistoryTeamColumn team="B" name={entry.teamBName} players={entry.teamBPlayers} />
      </div>
      <EventFeed entries={eventFeed} />
      <div className="sp-history-entry__actions">
        <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" disabled={!hasScore} onClick={handleCopySummary}>
          Copy summary
        </button>
        <button
          type="button"
          className="sp-btn sp-btn--ghost sp-btn--sm"
          disabled={eventFeed.length === 0}
          onClick={handleCopyEventLog}
        >
          Copy event log
        </button>
        {notice && (
          <span className={`sp-header-notice ${noticeKind === 'danger' ? 'sp-header-notice--danger' : ''}`}>
            {notice}
            <button type="button" className="sp-header-notice__close" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function HistoryTeamColumn({ team, name, players }: { team: Team; name: string; players: HistoryPlayerSnapshot[] }) {
  return (
    <div className="sp-draft-column" data-team={team}>
      <h4>Team {name}</h4>
      <div className="sp-draft-column__list">
        {players.map((p) => (
          <div key={p.id} className="sp-draft-column__row">
            <span className="sp-roster-row__name">
              {p.name}
              {p.nickname && <span className="sp-card__nickname"> ({p.nickname})</span>}
            </span>
            <span className="sp-roster-row__meta">
              <span className="sp-badge">{p.position}</span>
              <span className="sp-hint">{p.overall}</span>
              {(p.goals || p.assists || p.fouls || p.saves || p.concedes) && (
                <span className="sp-hint">
                  {p.goals ? `${p.goals}G ` : ''}
                  {p.assists ? `${p.assists}A ` : ''}
                  {p.fouls ? `${p.fouls}F ` : ''}
                  {p.saves ? `${p.saves}SV ` : ''}
                  {p.concedes ? `${p.concedes}CN` : ''}
                </span>
              )}
              {p.isCaptain && <span className="sp-badge">CAPTAIN</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
