import { describe, expect, it } from 'vitest';
import { snapshotPlayer } from '../src/lib/history';
import { overall } from '../src/lib/rating';
import type { Player } from '../src/types';

function makeStriker(): Player {
  return {
    id: 'p1',
    name: 'Alex Striker',
    nickname: 'Sniper',
    position: 'ATT',
    stats: { pace: 5, stamina: 3, finishing: 5, defending: 1, passing: 2, goalkeeping: 1 },
    createdAt: 0,
  };
}

describe('snapshotPlayer', () => {
  it('freezes name, nickname, and captain flag as given', () => {
    const player = makeStriker();
    const snap = snapshotPlayer(player, 'ATT', true);
    expect(snap.id).toBe('p1');
    expect(snap.name).toBe('Alex Striker');
    expect(snap.nickname).toBe('Sniper');
    expect(snap.isCaptain).toBe(true);
  });

  it('computes overall at the given position, not the preferred one', () => {
    const player = makeStriker();
    const atPreferred = snapshotPlayer(player, 'ATT', false);
    const atGk = snapshotPlayer(player, 'GK', false);
    expect(atPreferred.overall).toBe(overall(player, 'ATT'));
    expect(atGk.overall).toBe(overall(player, 'GK'));
    expect(atGk.overall).not.toBe(atPreferred.overall);
    expect(atGk.position).toBe('GK');
    expect(atPreferred.position).toBe('ATT');
  });
});
