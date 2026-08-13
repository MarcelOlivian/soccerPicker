import type { FormationId, Position, Team } from '../types';

export interface SlotDef {
  id: string;
  position: Position;
  team: Team;
  /** Normalized pitch coordinates, 0..1. x=0 is Team A's goal line, x=1 is Team B's. */
  x: number;
  y: number;
}

interface RelSlot {
  position: Position;
  x: number;
  y: number;
}

// Coordinates are for Team A (left half); Team B is the mirror image (x -> 1 - x).
const LAYOUTS: Record<FormationId, RelSlot[]> = {
  '5': [
    { position: 'GK', x: 0.06, y: 0.5 },
    { position: 'DEF', x: 0.2, y: 0.32 },
    { position: 'DEF', x: 0.2, y: 0.68 },
    { position: 'MID', x: 0.34, y: 0.5 },
    { position: 'ATT', x: 0.46, y: 0.5 },
  ],
  '6': [
    { position: 'GK', x: 0.06, y: 0.5 },
    { position: 'DEF', x: 0.2, y: 0.3 },
    { position: 'DEF', x: 0.2, y: 0.7 },
    { position: 'MID', x: 0.34, y: 0.32 },
    { position: 'MID', x: 0.34, y: 0.68 },
    { position: 'ATT', x: 0.44, y: 0.5 },
  ],
  '7': [
    { position: 'GK', x: 0.06, y: 0.5 },
    { position: 'DEF', x: 0.18, y: 0.28 },
    { position: 'DEF', x: 0.18, y: 0.72 },
    { position: 'MID', x: 0.32, y: 0.2 },
    { position: 'MID', x: 0.32, y: 0.5 },
    { position: 'MID', x: 0.32, y: 0.8 },
    { position: 'ATT', x: 0.46, y: 0.5 },
  ],
};

export const FORMATION_IDS: FormationId[] = ['5', '6', '7'];

export const FORMATION_LABELS: Record<FormationId, string> = {
  '5': '5-a-side',
  '6': '6-a-side',
  '7': '7-a-side',
};

export function playersPerTeam(formationId: FormationId): number {
  return LAYOUTS[formationId].length;
}

export function totalPlayers(formationId: FormationId): number {
  return playersPerTeam(formationId) * 2;
}

export function formationSlots(formationId: FormationId): SlotDef[] {
  const layout = LAYOUTS[formationId];
  const teamA: SlotDef[] = layout.map((s, i) => ({
    id: `A-${s.position}-${i}`,
    position: s.position,
    team: 'A',
    x: s.x,
    y: s.y,
  }));
  const teamB: SlotDef[] = layout.map((s, i) => ({
    id: `B-${s.position}-${i}`,
    position: s.position,
    team: 'B',
    x: 1 - s.x,
    y: s.y,
  }));
  return [...teamA, ...teamB];
}

export function slotsForTeam(formationId: FormationId, team: Team): SlotDef[] {
  return formationSlots(formationId).filter((s) => s.team === team);
}

/**
 * Where a slot sits inside the pitch box, as CSS percentages.
 *
 * Landscape is the authored orientation: x runs from Team A's goal line to
 * Team B's, y runs top to bottom. Portrait (used on phones, where a wide
 * pitch leaves the slots overlapping) rotates the whole pitch a quarter turn
 * clockwise so Team A defends the top edge: (x, y) -> (1 - y, x). The pitch
 * SVG applies the equivalent transform, so lines and slots stay aligned.
 */
export function slotCoords(slot: Pick<SlotDef, 'x' | 'y'>, portrait: boolean): { left: string; top: string } {
  const [x, y] = portrait ? [1 - slot.y, slot.x] : [slot.x, slot.y];
  return { left: `${x * 100}%`, top: `${y * 100}%` };
}
