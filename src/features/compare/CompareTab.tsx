import { useEffect, useMemo, useState } from 'react';
import { Monogram } from '../../components/Monogram';
import { PlayerCard, usePlayerPhotoUrl } from '../../components/PlayerCard';
import { RadarChart } from '../../components/RadarChart';
import { filterAndSortPlayers } from '../../lib/playerSearch';
import type { PlayerSortKey } from '../../lib/playerSearch';
import { usePhoneLayout } from '../../lib/useMediaQuery';
import { useAppState } from '../../state/AppContext';
import type { Player } from '../../types';

const MAX_COMPARE = 4;
// First two selections reuse the existing team colors (this tab has no
// team concept of its own); 3rd/4th use two new tokens (theme.css).
// Assigned by selection order, not player identity, so colors stay
// stable/predictable as the roster list re-filters.
const COMPARE_COLORS = ['var(--sp-team-a)', 'var(--sp-team-b)', 'var(--sp-compare-3)', 'var(--sp-compare-4)'];

export function CompareTab() {
  const { state } = useAppState();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<PlayerSortKey>('name');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mobileView, setMobileView] = useState<'pick' | 'radar'>('pick');
  const isPhone = usePhoneLayout();

  const visible = useMemo(() => filterAndSortPlayers(state.players, query, sortKey), [state.players, query, sortKey]);
  const selectedPlayers = selectedIds
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p);
  const atCap = selectedIds.length >= MAX_COMPARE;

  function toggle(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_COMPARE ? prev : [...prev, id],
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  const series = selectedPlayers.map((p, i) => ({ label: p.name, color: COMPARE_COLORS[i], values: p.stats }));

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
        {visible.map((player) => {
          const isSelected = selectedIds.includes(player.id);
          const disabled = atCap && !isSelected;
          return (
            <PlayerCard
              key={player.id}
              player={player}
              selected={isSelected}
              faded={disabled}
              onClick={disabled ? undefined : () => toggle(player.id)}
              compareBadge
            />
          );
        })}
      </div>
      {visible.length === 0 && <p className="sp-hint">No players match “{query}”.</p>}
    </div>
  );

  const radarAndLegend = selectedPlayers.length === 0 ? (
    <p className="sp-hint">Select at least one player to compare…</p>
  ) : (
    <>
      <RadarChart series={series} />
      <ul className="sp-compare-legend">
        {series.map((s) => (
          <li key={s.label}>
            <span className="sp-compare-legend__swatch" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
    </>
  );

  if (isPhone) {
    if (mobileView === 'radar') {
      return (
        <div className="sp-compare-radar-view">
          {radarAndLegend}
          <div className="sp-compare-radar-view__actions">
            <button type="button" className="sp-btn" onClick={() => setMobileView('pick')}>
              Modify selection
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--ghost"
              onClick={() => {
                clearSelection();
                setMobileView('pick');
              }}
            >
              Close comparison
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="sp-compare-pick">
        {list}
        <div className="sp-compare-bar">
          <span className="sp-compare-bar__count">
            {selectedIds.length} / {MAX_COMPARE} selected
          </span>
          <div className="sp-compare-bar__thumbs">
            {selectedPlayers.map((p) => (
              <CompareThumb key={p.id} player={p} />
            ))}
          </div>
          <button
            type="button"
            className="sp-btn sp-btn--primary sp-btn--sm"
            disabled={selectedIds.length === 0}
            onClick={() => setMobileView('radar')}
          >
            Show radar compare
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-compare-layout">
      {list}
      <div className="sp-compare-panel">
        {radarAndLegend}
        {selectedPlayers.length > 0 && (
          <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={clearSelection}>
            Clear selection
          </button>
        )}
      </div>
    </div>
  );
}

function CompareThumb({ player }: { player: Player }) {
  const photoUrl = usePlayerPhotoUrl(player);
  // Mirrors PlayerCard's own dead/unreachable-photoUrl fallback: without
  // this, a network hiccup or expired link renders a broken-image icon
  // forever instead of the monogram.
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [photoUrl]);
  const showPhoto = !!photoUrl && !photoFailed;
  return (
    <div className="sp-compare-bar__thumb">
      {showPhoto ? <img src={photoUrl} alt="" onError={() => setPhotoFailed(true)} /> : <Monogram name={player.name} />}
    </div>
  );
}
