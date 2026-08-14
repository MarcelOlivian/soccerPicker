import { useState } from 'react';
import { BalanceMeter } from '../../components/BalanceMeter';
import { PlayerCard } from '../../components/PlayerCard';
import { computeBalance, teamStrength } from '../../lib/balance';
import {
  formatTeamsList,
  isComplete,
  nextTeam,
  picksForTeam,
  remaining,
  suggestBalanceSwap,
  teamShortName,
} from '../../lib/draft';
import { preferredOverall } from '../../lib/rating';
import { useAppState } from '../../state/AppContext';
import { useLive } from '../../state/LiveContext';
import type { DraftOrder, Player, Team } from '../../types';

interface DraftStageProps {
  onContinue: () => void;
}

export function DraftStage({ onContinue }: DraftStageProps) {
  const { state, dispatch } = useAppState();
  const live = useLive();
  const isClient = live.role === 'client';
  const { match, players } = state;
  const byId = new Map(players.map((p) => [p.id, p]));
  const attending = match.attendingIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'info' | 'danger'>('info');

  const captainsSet = !!match.draft.captainA && !!match.draft.captainB;

  if (!captainsSet) {
    if (isClient) {
      return (
        <div className="sp-panel">
          <p className="sp-hint">Waiting for the host to pick captains…</p>
        </div>
      );
    }
    return (
      <CaptainPicker
        attending={attending}
        onSet={(captainA, captainB) => dispatch({ type: 'SET_CAPTAINS', captainA, captainB })}
      />
    );
  }

  const remainingIds = remaining(match.attendingIds, match.draft.picks);
  const turnTeam = nextTeam(match.draft.picks, match.draft.order);
  const complete = isComplete(match.attendingIds, match.draft.picks);

  const teamAName = teamShortName(byId.get(match.draft.captainA!)?.name, 'A');
  const teamBName = teamShortName(byId.get(match.draft.captainB!)?.name, 'B');

  const teamAPlayers = picksForTeam(match.draft.picks, 'A')
    .map((p) => byId.get(p.playerId))
    .filter((p): p is Player => !!p);
  const teamBPlayers = picksForTeam(match.draft.picks, 'B')
    .map((p) => byId.get(p.playerId))
    .filter((p): p is Player => !!p);

  const strengthA = teamStrength(teamAPlayers.map((player) => ({ player, position: player.position })));
  const strengthB = teamStrength(teamBPlayers.map((player) => ({ player, position: player.position })));
  const balance = computeBalance(strengthA, strengthB);

  // In live mode a client is always Team B; locally (solo or host) either
  // side can be clicked, since one person is running the whole draft.
  const myTurn = !isClient || turnTeam === 'B';

  function pick(id: string) {
    live.applyPick(id);
  }

  function handleAutoDraft() {
    if (confirm(`Auto-draft the remaining ${remainingIds.length} player(s)? You can undo picks one at a time afterward.`)) {
      dispatch({ type: 'AUTO_DRAFT_REMAINING' });
    }
  }

  function handleSuggestSwap() {
    const suggestion = suggestBalanceSwap(teamAPlayers, match.draft.captainA, teamBPlayers, match.draft.captainB);
    if (!suggestion) {
      setNoticeKind('info');
      setNotice('Teams are already as balanced as a single swap can make them.');
      return;
    }
    const playerA = byId.get(suggestion.playerIdA);
    const playerB = byId.get(suggestion.playerIdB);
    const label = (p: Player | undefined) => (p ? `${p.name}${p.nickname ? ` (${p.nickname})` : ''}` : '?');
    if (
      confirm(
        `Swap ${label(playerA)} (Team ${teamAName}) and ${label(playerB)} (Team ${teamBName})? ` +
          `Balance gap would go from ${suggestion.currentDiff} to ${suggestion.newDiff}.`,
      )
    ) {
      dispatch({ type: 'SWAP_DRAFT_TEAMS', playerIdA: suggestion.playerIdA, playerIdB: suggestion.playerIdB });
    }
  }

  async function handlePrintTeamsList() {
    const text = formatTeamsList(
      teamAName,
      teamAPlayers,
      match.draft.captainA,
      teamBName,
      teamBPlayers,
      match.draft.captainB,
    );
    try {
      await navigator.clipboard.writeText(text);
      setNoticeKind('info');
      setNotice('Teams list copied to clipboard.');
    } catch {
      setNoticeKind('danger');
      setNotice('Could not access the clipboard.');
    }
  }

  return (
    <div className="sp-stage">
      <div className="sp-draft-header">
        <div className="sp-draft-header__turn">
          {complete
            ? 'DRAFT COMPLETE'
            : `TEAM ${(turnTeam === 'A' ? teamAName : teamBName).toUpperCase()} PICKS · ${match.draft.picks.length} OF ${match.attendingIds.length}`}
        </div>
        {!isClient && (
          <div className="sp-draft-header__controls">
            <select
              value={match.draft.order}
              onChange={(e) => dispatch({ type: 'SET_DRAFT_ORDER', order: e.target.value as DraftOrder })}
              aria-label="Draft order"
            >
              <option value="snake">Snake order</option>
              <option value="alternating">Alternating</option>
            </select>
            <button
              type="button"
              className="sp-btn sp-btn--sm"
              disabled={complete}
              onClick={handleAutoDraft}
            >
              Auto-draft teams
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--sm"
              disabled={teamAPlayers.length <= 1 || teamBPlayers.length <= 1}
              onClick={handleSuggestSwap}
            >
              Suggest a swap
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--sm"
              disabled={match.draft.picks.length <= 2}
              onClick={() => dispatch({ type: 'UNDO_PICK' })}
            >
              Undo last pick
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--sm sp-btn--ghost"
              onClick={() => {
                if (confirm('Restart the draft? Captains stay the same.')) {
                  dispatch({ type: 'SET_CAPTAINS', captainA: match.draft.captainA, captainB: match.draft.captainB });
                }
              }}
            >
              Restart draft
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--sm sp-btn--ghost"
              onClick={() => {
                if (confirm('Change captains? This resets the draft.')) {
                  dispatch({ type: 'SET_CAPTAINS', captainA: undefined, captainB: undefined });
                }
              }}
            >
              Change captains
            </button>
          </div>
        )}
      </div>

      <BalanceMeter result={balance} teamNames={{ A: teamAName, B: teamBName }} />

      <div className="sp-draft-columns">
        <DraftTeamColumn team="A" players={teamAPlayers} captainId={match.draft.captainA} />
        <div className="sp-draft-deck">
          <h4>Available ({remainingIds.length})</h4>
          {isClient && !myTurn && !complete && (
            <div className="sp-banner sp-banner--info">WAITING FOR TEAM {teamAName.toUpperCase()}</div>
          )}
          <div className="sp-player-grid sp-player-grid--compact">
            {remainingIds.map((id) => {
              const player = byId.get(id);
              if (!player) return null;
              const clickable = !complete && myTurn;
              return (
                <PlayerCard
                  key={id}
                  player={player}
                  compact
                  faded={!clickable}
                  onClick={clickable ? () => pick(id) : undefined}
                />
              );
            })}
          </div>
          {remainingIds.length === 0 && !complete && (
            <p className="sp-hint">Everyone's been picked.</p>
          )}
        </div>
        <DraftTeamColumn team="B" players={teamBPlayers} captainId={match.draft.captainB} />
      </div>

      {!isClient && (
        <div className="sp-stage__actions">
          {notice && (
            <span className={`sp-header-notice ${noticeKind === 'danger' ? 'sp-header-notice--danger' : ''}`}>
              {notice}
              <button
                type="button"
                className="sp-header-notice__close"
                onClick={() => setNotice(null)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </span>
          )}
          <button type="button" className="sp-btn sp-btn--ghost" onClick={handlePrintTeamsList}>
            Print teams list
          </button>
          <button
            type="button"
            className={`sp-btn sp-btn--ghost ${complete ? 'sp-btn--ready' : ''}`}
            onClick={onContinue}
          >
            Skip to Field →
          </button>
        </div>
      )}
    </div>
  );
}

function DraftTeamColumn({ team, players, captainId }: { team: Team; players: Player[]; captainId?: string }) {
  const captain = players.find((p) => p.id === captainId);
  return (
    <div className="sp-draft-column" data-team={team}>
      <h4>Team {teamShortName(captain?.name, team)}</h4>
      <div className="sp-draft-column__list">
        {players.map((p) => (
          <div key={p.id} className="sp-draft-column__row">
            <span>
              {p.name}
              {p.nickname && <span className="sp-card__nickname"> ({p.nickname})</span>}
            </span>
            <span className="sp-roster-row__meta">
              <span className="sp-badge">{p.position}</span>
              <span className="sp-hint">{preferredOverall(p)}</span>
              {p.id === captainId && <span className="sp-badge">CAPTAIN</span>}
            </span>
          </div>
        ))}
        {players.length === 0 && <p className="sp-hint">No picks yet.</p>}
      </div>
    </div>
  );
}

function CaptainPicker({
  attending,
  onSet,
}: {
  attending: Player[];
  onSet: (captainA: string, captainB: string) => void;
}) {
  const [captainA, setCaptainA] = useState('');
  const [captainB, setCaptainB] = useState('');

  return (
    <div className="sp-panel">
      <h3>Pick two captains</h3>
      {attending.length < 2 ? (
        <p className="sp-hint">Mark at least two players as attending before starting the draft.</p>
      ) : (
        <>
          <div className="sp-captain-picker">
            <div className="sp-field">
              <label htmlFor="captain-a">Captain A</label>
              <select id="captain-a" value={captainA} onChange={(e) => setCaptainA(e.target.value)}>
                <option value="">Choose…</option>
                {attending.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === captainB}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sp-field">
              <label htmlFor="captain-b">Captain B</label>
              <select id="captain-b" value={captainB} onChange={(e) => setCaptainB(e.target.value)}>
                <option value="">Choose…</option>
                {attending.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.id === captainA}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            className="sp-btn sp-btn--primary"
            disabled={!captainA || !captainB}
            onClick={() => onSet(captainA, captainB)}
          >
            Start draft →
          </button>
        </>
      )}
    </div>
  );
}
