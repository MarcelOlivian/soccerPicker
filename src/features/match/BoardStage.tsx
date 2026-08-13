import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { BalanceMeter } from '../../components/BalanceMeter';
import { Pitch } from '../../components/Pitch';
import { Slot } from '../../components/Slot';
import { TeamColumn } from '../../components/TeamColumn';
import type { TeamAssignment } from '../../lib/balance';
import { computeBalance, teamStrength } from '../../lib/balance';
import { picksForTeam, teamShortName } from '../../lib/draft';
import { formationSlots } from '../../lib/formations';
import { useCoarsePointer, usePortraitPitch } from '../../lib/useMediaQuery';
import { useAppState } from '../../state/AppContext';
import { useLive } from '../../state/LiveContext';
import type { Player, Position } from '../../types';

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

export function BoardStage() {
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
  const coarsePointer = useCoarsePointer();

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
  for (const slot of slots) {
    const occupant = match.placements[slot.id];
    if (occupant) slotPositionByPlayer.set(occupant, slot.position);
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
    place(slot.id, selectedPlayerId);
    setSelectedPlayerId(null);
  }

  function handleSelectPlayer(playerId: string) {
    setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
  }

  function handleDrop(e: DragEvent, slotId: string) {
    e.preventDefault();
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
    const fromSlotId = e.dataTransfer.getData('application/x-from-slot');
    if (fromSlotId) place(fromSlotId, null);
  }

  if (teamAPlayers.length === 0 && teamBPlayers.length === 0) {
    return (
      <div className="sp-panel">
        <p className="sp-hint">No teams drafted yet — run the draft, or attend the roster in Setup first.</p>
      </div>
    );
  }

  return (
    <div className="sp-stage">
      <BalanceMeter result={balance} teamNames={{ A: teamAName, B: teamBName }} />
      {coarsePointer && <p className="sp-hint">Tap a player, then tap a pitch spot to place them.</p>}
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
          coarsePointer={coarsePointer}
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
                coarsePointer={coarsePointer}
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
                onClear={() => place(slot.id, null)}
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
          coarsePointer={coarsePointer}
          onSelectPlayer={handleSelectPlayer}
          onDropUnassign={handleUnassignDrop}
        />
      </div>
      {!isClient && (
        <div className="sp-stage__actions">
          <button
            type="button"
            className="sp-btn sp-btn--ghost"
            onClick={() => {
              if (confirm('Clear all pitch placements?')) dispatch({ type: 'CLEAR_PLACEMENTS' });
            }}
          >
            Clear placements
          </button>
        </div>
      )}
    </div>
  );
}
