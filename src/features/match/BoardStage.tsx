import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { BalanceMeter } from '../../components/BalanceMeter';
import { Pitch } from '../../components/Pitch';
import { Slot } from '../../components/Slot';
import { TeamColumn } from '../../components/TeamColumn';
import type { TeamAssignment } from '../../lib/balance';
import { computeBalance, teamStrength } from '../../lib/balance';
import { otherTeam, picksForTeam, teamShortName } from '../../lib/draft';
import { findSlot, formationSlots } from '../../lib/formations';
import { snapshotPlayer } from '../../lib/history';
import { computeElapsedMs, formatClock, isClockRunning } from '../../lib/matchClock';
import {
  buildEventFeed,
  describeEvent,
  findLastUndoableEvent,
  formatMatchSummaryForShare,
  tallyMatchStats,
  tallyTeamScore,
} from '../../lib/matchEvents';
import { useCoarsePointer, usePortraitPitch } from '../../lib/useMediaQuery';
import { useAppState } from '../../state/AppContext';
import { useLive } from '../../state/LiveContext';
import type { FoulType, MatchEvent, Player, Position, RestartType, Team } from '../../types';
import { EventFeed } from './EventFeed';
import { EventMenu } from './EventMenu';
import { TeamEventMenu } from './TeamEventMenu';

interface BoardStageProps {
  onStartNewMatch: () => void;
  onNavigateToHistory: () => void;
}

// Native browser autoscroll during HTML5 drag-and-drop is inconsistent
// across browsers, so this drives it manually while a card from this board
// is being dragged near the top/bottom edge of the viewport.
const AUTOSCROLL_EDGE_PX = 72;
const AUTOSCROLL_MAX_PX_PER_TICK = 18;
const AUTOSCROLL_INTERVAL_MS = 16;

function assignmentsFor(players: Player[], slotPositionByPlayer: Map<string, Position>): TeamAssignment[] {
  return players.map((player) => ({
    player,
    position: slotPositionByPlayer.get(player.id) ?? player.position,
  }));
}

export function BoardStage({ onStartNewMatch, onNavigateToHistory }: BoardStageProps) {
  const { state, dispatch } = useAppState();
  const live = useLive();
  const isClient = live.role === 'client';
  const { match, players } = state;
  const byId = new Map(players.map((p) => [p.id, p]));
  const slots = formationSlots(match.formation);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // Once the board stacks into one column the pitch turns a quarter turn, so
  // the slots get enough room to be tapped individually; wide layouts keep the
  // landscape pitch.
  const portrait = usePortraitPitch();
  // Touch input doesn't get native HTML5 drag — it competes with the OS's own
  // long-press handling — so touch falls back to tap-to-select-then-tap-slot.
  // Also forced true outside setup mode, so a mouse drag can't bypass the
  // event-menu flow either — see the coarsePointer prop passed below.
  const coarsePointer = useCoarsePointer();
  const [eventTarget, setEventTarget] = useState<{ playerId: string; team: Team } | null>(null);
  const [showTeamEventMenu, setShowTeamEventMenu] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'info' | 'danger'>('info');

  // Ticking re-render for the live clock display. Clock state itself lives
  // in match.clock, not component state, so it stays correct even if this
  // component unmounts (navigating to another stage) and remounts mid-match.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isClockRunning(match.clock)) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [match.clock.startedAt, match.clock.pausedAt]);

  // Autoscroll while dragging a card near the top/bottom edge of the window,
  // so a card below the fold can reach a pitch slot above it (or vice versa)
  // without letting go of the drag. Scoped to drags that originate from this
  // board (via the dragstart flag below) so it never reacts to an unrelated
  // drag — a file, a browser tab — passing over the page.
  const dragActive = useRef(false);
  const pointerY = useRef<number | null>(null);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function stopScrolling() {
      dragActive.current = false;
      pointerY.current = null;
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    function tick() {
      if (pointerY.current === null) return;
      const y = pointerY.current;
      const vh = window.innerHeight;
      let dy = 0;
      if (y < AUTOSCROLL_EDGE_PX) {
        dy = -AUTOSCROLL_MAX_PX_PER_TICK * (1 - y / AUTOSCROLL_EDGE_PX);
      } else if (y > vh - AUTOSCROLL_EDGE_PX) {
        dy = AUTOSCROLL_MAX_PX_PER_TICK * (1 - (vh - y) / AUTOSCROLL_EDGE_PX);
      }
      if (dy !== 0) window.scrollBy(0, dy);
    }

    function onWindowDragOver(e: globalThis.DragEvent) {
      if (!dragActive.current) return;
      pointerY.current = e.clientY;
      if (intervalId === null) intervalId = setInterval(tick, AUTOSCROLL_INTERVAL_MS);
    }

    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('dragend', stopScrolling);
    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('dragend', stopScrolling);
      stopScrolling();
    };
  }, []);

  const teamAPlayers = picksForTeam(match.draft.picks, 'A')
    .map((p) => byId.get(p.playerId))
    .filter((p): p is Player => !!p);
  const teamBPlayers = picksForTeam(match.draft.picks, 'B')
    .map((p) => byId.get(p.playerId))
    .filter((p): p is Player => !!p);

  const slotPositionByPlayer = new Map<string, Position>();
  const slotIdByPlayer = new Map<string, string>();
  for (const slot of slots) {
    const occupant = match.placements[slot.id];
    if (occupant) {
      slotPositionByPlayer.set(occupant, slot.position);
      slotIdByPlayer.set(occupant, slot.id);
    }
  }

  const teamAIds = new Set(teamAPlayers.map((p) => p.id));
  const teamBIds = new Set(teamBPlayers.map((p) => p.id));
  const selectedPlayerTeam = selectedPlayerId
    ? teamAIds.has(selectedPlayerId)
      ? 'A'
      : teamBIds.has(selectedPlayerId)
        ? 'B'
        : undefined
    : undefined;

  const strengthA = teamStrength(assignmentsFor(teamAPlayers, slotPositionByPlayer));
  const strengthB = teamStrength(assignmentsFor(teamBPlayers, slotPositionByPlayer));
  const balance = computeBalance(strengthA, strengthB);

  const teamAName = teamShortName(byId.get(match.draft.captainA ?? '')?.name, 'A');
  const teamBName = teamShortName(byId.get(match.draft.captainB ?? '')?.name, 'B');

  function place(slotId: string, playerId: string | null) {
    live.setPlacement(slotId, playerId);
  }

  function handleSlotClick(slot: (typeof slots)[number]) {
    const occupant = match.placements[slot.id];
    if (!isClient && match.boardMode === 'tracking') {
      if (occupant) setEventTarget({ playerId: occupant, team: slot.team });
      return;
    }
    if (match.boardMode !== 'setup') return; // finished, or a client's read-only view of tracking
    if (!selectedPlayerId) {
      if (occupant) setSelectedPlayerId(occupant);
      return;
    }
    if (selectedPlayerTeam && slot.team !== selectedPlayerTeam) {
      // Wrong half of the pitch for this player — ignore the click rather
      // than silently dropping the selection, so they can just click the
      // correct slot next.
      return;
    }
    if (occupant && occupant !== selectedPlayerId) {
      // The target slot already has someone else in it — if the selected
      // player has a slot of their own, trade places rather than bumping
      // the occupant back to the team column (matching drag-and-drop's
      // existing swap behavior in handleDrop below).
      const fromSlotId = slotIdByPlayer.get(selectedPlayerId);
      if (fromSlotId) {
        live.swapPlacements(fromSlotId, slot.id);
        setSelectedPlayerId(null);
        return;
      }
    }
    place(slot.id, selectedPlayerId);
    setSelectedPlayerId(null);
  }

  function handleSelectPlayer(playerId: string) {
    if (match.boardMode !== 'setup') return;
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  }

  function handleDrop(e: DragEvent, slotId: string) {
    e.preventDefault();
    if (match.boardMode !== 'setup') return;
    const playerId = e.dataTransfer.getData('application/x-player-id');
    const fromSlotId = e.dataTransfer.getData('application/x-from-slot');
    if (!playerId) return;
    if (fromSlotId && fromSlotId !== slotId) {
      const targetOccupant = match.placements[slotId];
      if (targetOccupant && targetOccupant !== playerId) {
        live.swapPlacements(fromSlotId, slotId);
        setSelectedPlayerId(null);
        return;
      }
    }
    place(slotId, playerId);
    setSelectedPlayerId(null);
  }

  function handleUnassignDrop(e: DragEvent) {
    e.preventDefault();
    if (match.boardMode !== 'setup') return;
    const fromSlotId = e.dataTransfer.getData('application/x-from-slot');
    if (fromSlotId) place(fromSlotId, null);
  }

  function handleAutoFill() {
    dispatch({ type: 'AUTO_FILL_PLACEMENTS' });
  }

  function gkOf(team: Team): string | undefined {
    const slot = findSlot(match.formation, team, 'GK');
    return slot ? match.placements[slot.id] ?? undefined : undefined;
  }

  function handleRecordGoal(isOwnGoal: boolean, assistPlayerId: string | null) {
    if (!eventTarget) return;
    const atMs = computeElapsedMs(match.clock);
    const goalEvent: MatchEvent = {
      id: crypto.randomUUID(),
      atMs,
      type: 'GOAL',
      playerId: eventTarget.playerId,
      team: isOwnGoal ? otherTeam(eventTarget.team) : eventTarget.team,
      isOwnGoal,
    };
    dispatch({ type: 'RECORD_EVENT', event: goalEvent });
    if (assistPlayerId) {
      dispatch({
        type: 'RECORD_EVENT',
        event: { id: crypto.randomUUID(), atMs, type: 'ASSIST', playerId: assistPlayerId, goalEventId: goalEvent.id },
      });
    }
    // Conceding team = whichever team is NOT credited on the scoreboard —
    // goalEvent.team already accounts for own goals, so this is uniform.
    const concedingGkId = gkOf(otherTeam(goalEvent.team));
    if (concedingGkId) {
      dispatch({
        type: 'RECORD_EVENT',
        event: { id: crypto.randomUUID(), atMs, type: 'GK_CONCEDED', playerId: concedingGkId, goalEventId: goalEvent.id },
      });
    }
    setEventTarget(null);
  }

  function handleRecordFoul(foulType: FoulType, restart: RestartType) {
    if (!eventTarget) return;
    dispatch({
      type: 'RECORD_EVENT',
      event: {
        id: crypto.randomUUID(),
        atMs: computeElapsedMs(match.clock),
        type: 'FOUL',
        playerId: eventTarget.playerId,
        foulType,
        restart,
      },
    });
    setEventTarget(null);
  }

  function handleRecordSave(shooterId: string | null) {
    if (!eventTarget) return;
    dispatch({
      type: 'RECORD_EVENT',
      event: {
        id: crypto.randomUUID(),
        atMs: computeElapsedMs(match.clock),
        type: 'SAVE_GK',
        playerId: eventTarget.playerId,
        shooterId: shooterId ?? undefined,
      },
    });
    setEventTarget(null);
  }

  function handleRecordTeamEvent(type: 'CORNER' | 'THROW_IN', team: Team) {
    dispatch({
      type: 'RECORD_EVENT',
      event: { id: crypto.randomUUID(), atMs: computeElapsedMs(match.clock), type, team },
    });
    setShowTeamEventMenu(false);
  }

  function handleSaveToHistory() {
    const { scoreA, scoreB } = tallyTeamScore(match.events);
    const tallies = tallyMatchStats(match.events);
    const entry = {
      id: crypto.randomUUID(),
      date: Date.now(),
      formation: match.formation,
      teamAName,
      teamBName,
      teamAPlayers: teamAPlayers.map((p) => {
        const t = tallies.get(p.id);
        return snapshotPlayer(
          p,
          slotPositionByPlayer.get(p.id) ?? p.position,
          p.id === match.draft.captainA,
          t?.goals,
          t?.assists,
          t?.fouls,
          t?.saves,
          t?.concedes,
        );
      }),
      teamBPlayers: teamBPlayers.map((p) => {
        const t = tallies.get(p.id);
        return snapshotPlayer(
          p,
          slotPositionByPlayer.get(p.id) ?? p.position,
          p.id === match.draft.captainB,
          t?.goals,
          t?.assists,
          t?.fouls,
          t?.saves,
          t?.concedes,
        );
      }),
      strengthA,
      strengthB,
      scoreA,
      scoreB,
      events: match.events,
    };
    dispatch({ type: 'SAVE_MATCH_TO_HISTORY', entry });
    onNavigateToHistory();
  }

  async function handleCopyForWhatsApp() {
    const { scoreA, scoreB } = tallyTeamScore(match.events);
    const tallies = tallyMatchStats(match.events);
    const summaryLine = (p: Player) => {
      const t = tallies.get(p.id);
      return {
        name: p.name,
        goals: t?.goals ?? 0,
        assists: t?.assists ?? 0,
        fouls: t?.fouls ?? 0,
        saves: t?.saves ?? 0,
        concedes: t?.concedes ?? 0,
      };
    };
    const text = formatMatchSummaryForShare(
      teamAName,
      scoreA,
      teamAPlayers.map(summaryLine),
      teamBName,
      scoreB,
      teamBPlayers.map(summaryLine),
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

  function handleStartNewMatch() {
    if (
      confirm(
        'Start a new match? This clears the current draft and pitch. Save to history first if you want to keep a record of this one.',
      )
    ) {
      dispatch({ type: 'RESET_MATCH' });
      onStartNewMatch();
    }
  }

  const unplacedCount = teamAPlayers.length + teamBPlayers.length - Object.values(match.placements).filter(Boolean).length;

  if (teamAPlayers.length === 0 && teamBPlayers.length === 0) {
    return (
      <div className="sp-panel">
        <p className="sp-hint">No teams drafted yet — run the draft, or attend the roster in Setup first.</p>
      </div>
    );
  }

  const { scoreA, scoreB } = tallyTeamScore(match.events);
  const eventTallies = tallyMatchStats(match.events);
  const lastEvent = findLastUndoableEvent(match.events);
  const lastEventLabel = lastEvent
    ? describeEvent(lastEvent, (id) => byId.get(id)?.name ?? 'Unknown', (team) => (team === 'A' ? teamAName : teamBName))
    : null;
  const eventFeed = buildEventFeed(
    match.events,
    (playerId) => byId.get(playerId)?.name ?? 'Unknown',
    (team) => (team === 'A' ? teamAName : teamBName),
  );

  return (
    <div className="sp-stage">
      <BalanceMeter result={balance} teamNames={{ A: teamAName, B: teamBName }} />
      {!isClient && match.boardMode !== 'finished' && (
        <div className="sp-mode-toggle">
          <button
            type="button"
            className={`sp-mode-toggle__btn ${match.boardMode === 'setup' ? 'sp-mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_BOARD_MODE', mode: 'setup' })}
          >
            Setup
          </button>
          <button
            type="button"
            className={`sp-mode-toggle__btn ${match.boardMode === 'tracking' ? 'sp-mode-toggle__btn--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_BOARD_MODE', mode: 'tracking' })}
          >
            Tracking
          </button>
        </div>
      )}
      {match.boardMode === 'tracking' && (
        <div className="sp-clock-bar">
          <span className="sp-clock-bar__score">
            {teamAName} {scoreA} – {scoreB} {teamBName}
          </span>
          <span className="sp-clock-bar__time">{formatClock(computeElapsedMs(match.clock))}</span>
          {!isClient && (
            <div className="sp-clock-bar__controls">
              <button
                type="button"
                className="sp-btn sp-btn--sm"
                onClick={() => dispatch({ type: isClockRunning(match.clock) ? 'PAUSE_CLOCK' : 'START_CLOCK' })}
              >
                {isClockRunning(match.clock) ? 'Pause' : 'Start'}
              </button>
              <button
                type="button"
                className="sp-btn sp-btn--sm sp-btn--ghost"
                onClick={() => {
                  if (confirm('Reset the clock to 00:00?')) dispatch({ type: 'RESET_CLOCK' });
                }}
              >
                Reset
              </button>
              <button
                type="button"
                className="sp-btn sp-btn--sm sp-btn--ghost"
                disabled={!lastEvent}
                onClick={() => dispatch({ type: 'UNDO_LAST_EVENT' })}
              >
                Undo last{lastEventLabel ? `: ${lastEventLabel}` : ''}
              </button>
              <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={() => setShowTeamEventMenu(true)}>
                + Team event
              </button>
              <button
                type="button"
                className="sp-btn sp-btn--sm sp-btn--danger"
                onClick={() => {
                  if (
                    confirm(
                      'Finish the match? This locks in the final score and stops tracking — you can still review and save to history afterward.',
                    )
                  ) {
                    dispatch({ type: 'FINISH_MATCH' });
                  }
                }}
              >
                Finish match
              </button>
            </div>
          )}
        </div>
      )}
      {match.boardMode !== 'setup' && <EventFeed entries={eventFeed} />}
      {match.boardMode === 'finished' && (
        <div className="sp-panel sp-match-summary">
          <p className="sp-match-summary__score">
            {teamAName} {scoreA} – {scoreB} {teamBName}
          </p>
          <div className="sp-match-summary__teams">
            {[
              { name: teamAName, players: teamAPlayers },
              { name: teamBName, players: teamBPlayers },
            ].map(({ name, players: teamPlayers }) => (
              <div className="sp-match-summary__team" key={name}>
                <h4>{name}</h4>
                <ul>
                  {teamPlayers.map((p) => {
                    const t = eventTallies.get(p.id);
                    return (
                      <li key={p.id}>
                        {p.name}
                        {t && (
                          <span className="sp-hint">
                            {' '}
                            {t.goals > 0 && `${t.goals}G `}
                            {t.assists > 0 && `${t.assists}A `}
                            {t.fouls > 0 && `${t.fouls}F `}
                            {t.saves > 0 && `${t.saves}SV `}
                            {t.concedes > 0 && `${t.concedes}CN`}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {!isClient && (
            <div className="sp-match-summary__actions">
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
              <button type="button" className="sp-btn sp-btn--ghost" onClick={handleCopyForWhatsApp}>
                Copy for WhatsApp
              </button>
            </div>
          )}
        </div>
      )}
      {coarsePointer && match.boardMode === 'setup' && (
        <p className="sp-hint">Tap a player, then tap a pitch spot to place them.</p>
      )}
      {match.boardMode === 'tracking' && <p className="sp-hint">Tap a placed player to record a goal or foul.</p>}
      {/*
        A single catch-all dragover handler on the whole board area. Per the
        HTML5 DnD spec, a drop is only allowed if the most recent dragover
        called preventDefault() — if the pointer passes over any element
        without a handler mid-drag (e.g. the grid gap between the pitch and
        a team column), the browser can silently cancel the whole drop, even
        for a real mouse user dragging slowly. This keeps every point inside
        the board a valid target; the specific Slot/TeamColumn onDrop
        handlers still decide what actually happens.
      */}
      <div
        className="sp-board-layout"
        onDragOver={(e) => e.preventDefault()}
        onDragStart={() => {
          dragActive.current = true;
        }}
      >
        <TeamColumn
          team="A"
          players={teamAPlayers}
          placements={match.placements}
          strength={strengthA}
          selectedPlayerId={selectedPlayerId}
          captainId={match.draft.captainA}
          coarsePointer={coarsePointer || match.boardMode !== 'setup'}
          onSelectPlayer={handleSelectPlayer}
          onDropUnassign={handleUnassignDrop}
        />
        <Pitch portrait={portrait}>
          {slots.map((slot) => {
            const occupant = match.placements[slot.id];
            return (
              <Slot
                key={slot.id}
                slot={slot}
                portrait={portrait}
                // coarsePointer already means "disable native HTML5 drag,
                // force tap-only" — forcing it true outside setup mode
                // reuses that exact mechanism to stop a mouse-drag from
                // bypassing the event-menu/finished-lock guards above.
                coarsePointer={coarsePointer || match.boardMode !== 'setup'}
                player={occupant ? byId.get(occupant) : undefined}
                isSelected={selectedPlayerId === occupant}
                isCaptain={!!occupant && (occupant === match.draft.captainA || occupant === match.draft.captainB)}
                isDropTarget={!!selectedPlayerId && (!selectedPlayerTeam || slot.team === selectedPlayerTeam)}
                onClick={() => handleSlotClick(slot)}
                onDrop={(e) => handleDrop(e, slot.id)}
                onCardDragStart={(e) => {
                  e.dataTransfer.setData('application/x-player-id', occupant ?? '');
                  e.dataTransfer.setData('application/x-from-slot', slot.id);
                }}
                onClear={() => {
                  if (match.boardMode !== 'setup') return;
                  place(slot.id, null);
                }}
              />
            );
          })}
        </Pitch>
        <TeamColumn
          team="B"
          players={teamBPlayers}
          placements={match.placements}
          strength={strengthB}
          selectedPlayerId={selectedPlayerId}
          captainId={match.draft.captainB}
          coarsePointer={coarsePointer || match.boardMode !== 'setup'}
          onSelectPlayer={handleSelectPlayer}
          onDropUnassign={handleUnassignDrop}
        />
      </div>
      {!isClient && (
        <div className="sp-stage__actions">
          {match.boardMode === 'setup' && (
            <>
              <button type="button" className="sp-btn sp-btn--ghost" disabled={unplacedCount === 0} onClick={handleAutoFill}>
                Auto-fill positions
              </button>
              <button
                type="button"
                className="sp-btn sp-btn--ghost"
                onClick={() => {
                  if (confirm('Clear all pitch placements?')) dispatch({ type: 'CLEAR_PLACEMENTS' });
                }}
              >
                Clear placements
              </button>
            </>
          )}
          <button
            type="button"
            className={`sp-btn sp-btn--ghost ${match.boardMode === 'finished' ? 'sp-btn--ready' : ''}`}
            onClick={handleSaveToHistory}
          >
            Save to history
          </button>
          <button type="button" className="sp-btn sp-btn--ghost" onClick={handleStartNewMatch}>
            Start new match
          </button>
        </div>
      )}
      {eventTarget && !isClient && byId.get(eventTarget.playerId) && (
        <EventMenu
          player={byId.get(eventTarget.playerId)!}
          teammates={(eventTarget.team === 'A' ? teamAPlayers : teamBPlayers).filter(
            (p) => p.id !== eventTarget.playerId && slotPositionByPlayer.has(p.id),
          )}
          isGoalkeeper={slotPositionByPlayer.get(eventTarget.playerId) === 'GK'}
          opposingOnPitch={(eventTarget.team === 'A' ? teamBPlayers : teamAPlayers).filter(
            (p) => slotPositionByPlayer.has(p.id) && slotPositionByPlayer.get(p.id) !== 'GK',
          )}
          onRecordGoal={handleRecordGoal}
          onRecordFoul={handleRecordFoul}
          onRecordSave={handleRecordSave}
          onCancel={() => setEventTarget(null)}
        />
      )}
      {showTeamEventMenu && !isClient && (
        <TeamEventMenu
          teamAName={teamAName}
          teamBName={teamBName}
          onRecord={handleRecordTeamEvent}
          onCancel={() => setShowTeamEventMenu(false)}
        />
      )}
    </div>
  );
}
