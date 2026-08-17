import { useMemo, useState } from 'react';
import { PlayerCard } from '../../components/PlayerCard';
import { TrajectoryChart } from '../../components/TrajectoryChart';
import { formatShortDate } from '../../lib/dateFormat';
import { filterAndSortPlayers } from '../../lib/playerSearch';
import type { PlayerSortKey } from '../../lib/playerSearch';
import { matchImpactBadges, matchResult, matchesForPlayer } from '../../lib/playerMatchLog';
import { overall } from '../../lib/rating';
import { appendStatHistoryEntry, auditLogLines, effectiveStatHistory } from '../../lib/statHistory';
import { suggestStatChange } from '../../lib/statSuggestion';
import { usePhoneLayout } from '../../lib/useMediaQuery';
import { useAppState } from '../../state/AppContext';
import { STAT_LABELS } from '../../types';
import type { MatchHistoryEntry, Player } from '../../types';
import { PlayerForm } from '../roster/PlayerForm';

export function EvolutionTab() {
  const { state, dispatch } = useAppState();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<PlayerSortKey>('name');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'pick' | 'detail'>('pick');
  const isPhone = usePhoneLayout();

  const visible = useMemo(() => filterAndSortPlayers(state.players, query, sortKey), [state.players, query, sortKey]);
  const player = state.players.find((p) => p.id === selectedId) ?? null;

  function selectPlayer(id: string) {
    setSelectedId(id);
    if (isPhone) setMobileView('detail');
  }

  function handleSaveFromSuggestion(updated: Player, reasonText: string) {
    const previous = state.players.find((p) => p.id === updated.id);
    const enriched = appendStatHistoryEntry(previous, updated, 'suggestion', reasonText);
    dispatch({ type: 'UPDATE_PLAYER', player: enriched });
  }

  const list = (
    <div>
      <div className="sp-roster-toolbar">
        <input
          type="text"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search players"
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as PlayerSortKey)} aria-label="Sort players">
          <option value="name">Sort: Name</option>
          <option value="overall">Sort: Overall</option>
          <option value="position">Sort: Position</option>
        </select>
      </div>
      <div className="sp-player-grid">
        {visible.map((p) => (
          <PlayerCard key={p.id} player={p} selected={p.id === selectedId} onClick={() => selectPlayer(p.id)} />
        ))}
      </div>
      {visible.length === 0 && <p className="sp-hint">No players match "{query}".</p>}
    </div>
  );

  const detail = player ? (
    // Keyed by player id so switching the selected player resets this
    // component's local `reviewing`/`auditOpen` state, instead of leaking a
    // stale "reviewing a suggestion" or "audit log open" state across
    // unrelated players.
    <EvolutionDetail key={player.id} player={player} history={state.history} onSaveFromSuggestion={handleSaveFromSuggestion} />
  ) : (
    <p className="sp-hint">Select a player to see their evolution…</p>
  );

  if (isPhone) {
    if (mobileView === 'detail' && player) {
      return (
        <div className="sp-evolution-detail-view">
          {detail}
          <button type="button" className="sp-btn" onClick={() => setMobileView('pick')}>
            Modify selection
          </button>
        </div>
      );
    }
    return <div className="sp-evolution-pick">{list}</div>;
  }

  return (
    <div className="sp-evolution-layout">
      {list}
      <div className="sp-evolution-panel">{detail}</div>
    </div>
  );
}

function EvolutionDetail({
  player,
  history,
  onSaveFromSuggestion,
}: {
  player: Player;
  history: MatchHistoryEntry[];
  onSaveFromSuggestion: (updated: Player, reasonText: string) => void;
}) {
  const [reviewing, setReviewing] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const appearances = useMemo(() => matchesForPlayer(history, player.id), [history, player.id]);
  const suggestion = useMemo(() => suggestStatChange(player, history), [player, history]);

  const statPoints = effectiveStatHistory(player).map((e) => ({ at: e.at, ovr: overall({ stats: e.stats }, player.position) }));
  const matchPoints = appearances.map((a) => ({ at: a.entry.date, ovr: a.snapshot.overall }));

  if (reviewing && suggestion) {
    const seed: Player = {
      ...player,
      stats: { ...player.stats, [suggestion.statKey]: suggestion.newValue },
      statsVerifiedBy: undefined,
      statsVerifiedAt: undefined,
    };
    return (
      <PlayerForm
        initial={seed}
        onSave={(updated) => {
          onSaveFromSuggestion(updated, suggestion.reasonText);
          setReviewing(false);
        }}
        onCancel={() => setReviewing(false)}
      />
    );
  }

  return (
    <div className="sp-evolution-detail">
      <h3>{player.name}</h3>

      <TrajectoryChart statPoints={statPoints} matchPoints={matchPoints} />

      {suggestion && (
        <div className="sp-evolution-suggestion">
          <p>
            Suggested: {STAT_LABELS[suggestion.statKey]} {suggestion.direction === 'up' ? '↑' : '↓'} {suggestion.newValue}
          </p>
          <p className="sp-hint">
            {player.name} is {suggestion.reasonText}
          </p>
          <button type="button" className="sp-btn sp-btn--primary sp-btn--sm" onClick={() => setReviewing(true)}>
            Review {suggestion.direction === 'up' ? 'Upgrade' : 'Downgrade'}
          </button>
        </div>
      )}

      <h4>Match log</h4>
      <ul className="sp-evolution-log">
        {appearances.map(({ entry, snapshot, team }) => (
          <li key={entry.id}>
            <span>{formatShortDate(entry.date)}</span>
            <span className="sp-badge">{snapshot.position}</span>
            <span>{entry.scoreA !== undefined ? `${entry.scoreA}–${entry.scoreB}` : 'no score'}</span>
            <span>{matchResult(entry, team)}</span>
            {matchImpactBadges(entry, snapshot, team).map((b) => (
              <span key={b} className="sp-badge">
                {b}
              </span>
            ))}
          </li>
        ))}
        {appearances.length === 0 && <li className="sp-hint">No saved matches yet for this player.</li>}
      </ul>

      <button type="button" className="sp-btn sp-btn--ghost sp-btn--sm" onClick={() => setAuditOpen((v) => !v)}>
        {auditOpen ? 'Hide' : 'Show'} stat history
      </button>
      {auditOpen && (
        <ul className="sp-evolution-audit">
          {auditLogLines(player).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          {auditLogLines(player).length === 0 && <li className="sp-hint">No stat changes recorded yet.</li>}
        </ul>
      )}
    </div>
  );
}
