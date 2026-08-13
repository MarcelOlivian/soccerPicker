import { overall } from './rating';
import type { SlotDef } from './formations';
import type { Player } from '../types';

/**
 * Optimal (maximum total assigned-position `overall()`) assignment of some
 * players to some slots, for one team. Position fit is a real assignment
 * problem — greedily filling, say, DEF slots first with the best available
 * defenders can strand a good all-rounder with nowhere good left — so this
 * is an exact DP rather than a greedy pass. Slot counts are tiny (≤7, even
 * at 7-a-side), so it's cheap: `dp[i][mask]` is the best total value
 * achievable using the first `i` players with the slots in `mask` filled;
 * each player either sits out or fills one open slot.
 *
 * Only ever call this with *unplaced* players and *empty* slots — it never
 * touches anything outside its own input, so a caller that pre-filters
 * already-placed players/slots gets "fill in the rest" for free.
 *
 * `overall()` is always positive (45-95), so the DP naturally prefers
 * filling more slots over fewer — no special-casing needed to avoid
 * leaving a slot empty "to protect the score." Extra players beyond the
 * slot count are simply left unassigned.
 */
export function autoFillSlots(players: Player[], slots: SlotDef[]): Record<string, string> {
  const slotCount = slots.length;
  if (slotCount === 0 || players.length === 0) return {};

  const fullMask = (1 << slotCount) - 1;
  // dp[i][mask]: best total value using the first i players, slots in
  // `mask` filled. dp[0] is all zeros (no players considered yet).
  const dp: number[][] = [Array.from({ length: fullMask + 1 }, () => 0)];

  for (let i = 0; i < players.length; i++) {
    const prev = dp[i];
    const cur = prev.slice();
    for (let mask = 0; mask <= fullMask; mask++) {
      for (let s = 0; s < slotCount; s++) {
        if (mask & (1 << s)) continue; // slot s already filled in this mask
        const newMask = mask | (1 << s);
        const value = prev[mask] + overall(players[i], slots[s].position);
        if (value > cur[newMask]) cur[newMask] = value;
      }
    }
    dp.push(cur);
  }

  const last = dp[players.length];
  let bestMask = 0;
  for (let mask = 0; mask <= fullMask; mask++) {
    if (last[mask] > last[bestMask]) bestMask = mask;
  }

  // Backtrack from (players.length, bestMask) to reconstruct the assignment.
  const result: Record<string, string> = {};
  let mask = bestMask;
  for (let i = players.length - 1; i >= 0; i--) {
    if (dp[i][mask] === dp[i + 1][mask]) continue; // player i wasn't used to reach this mask
    for (let s = 0; s < slotCount; s++) {
      if (!(mask & (1 << s))) continue;
      const prevMask = mask & ~(1 << s);
      if (dp[i][prevMask] + overall(players[i], slots[s].position) === dp[i + 1][mask]) {
        result[slots[s].id] = players[i].id;
        mask = prevMask;
        break;
      }
    }
  }

  return result;
}
