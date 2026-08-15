import type { Player } from '../types';

/** True when a player's current stats came straight from a vote reveal (and haven't been hand-edited since). */
export function isStatsVerified(player: Pick<Player, 'statsVerifiedBy'>): boolean {
  return !!player.statsVerifiedBy?.length;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** e.g. 1755255720000 -> "15/08/2026 @ 11:02" (DD/MM/YYYY @ HH:MM, local time). */
export function formatStatsVerifiedAt(ts: number): string {
  const d = new Date(ts);
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date} @ ${time}`;
}
