import { describe, expect, it } from 'vitest';
import { computeBalance, teamStrength } from '../src/lib/balance';
import type { Player, PlayerStats } from '../src/types';

function makePlayer(id: string, position: Player['position'], value = 3): Player {
  const stats: PlayerStats = {
    pace: value as PlayerStats['pace'],
    stamina: value as PlayerStats['stamina'],
    finishing: value as PlayerStats['finishing'],
    defending: value as PlayerStats['defending'],
    passing: value as PlayerStats['passing'],
    goalkeeping: value as PlayerStats['goalkeeping'],
  };
  return { id, name: id, position, stats, createdAt: 0 };
}

describe('balance', () => {
  it('reports EVEN for two identical teams', () => {
    const teamA = [makePlayer('a1', 'ATT'), makePlayer('a2', 'DEF')];
    const teamB = [makePlayer('b1', 'ATT'), makePlayer('b2', 'DEF')];
    const strengthA = teamStrength(teamA.map((player) => ({ player, position: player.position })));
    const strengthB = teamStrength(teamB.map((player) => ({ player, position: player.position })));
    const result = computeBalance(strengthA, strengthB);
    expect(result.verdict).toBe('EVEN');
    expect(result.leader).toBeNull();
  });

  it('reports an EDGE when one team is stacked with maxed players', () => {
    const stacked = [makePlayer('a1', 'ATT', 5), makePlayer('a2', 'DEF', 5), makePlayer('a3', 'MID', 5)];
    const weak = [makePlayer('b1', 'ATT', 1), makePlayer('b2', 'DEF', 1), makePlayer('b3', 'MID', 1)];
    const strengthA = teamStrength(stacked.map((player) => ({ player, position: player.position })));
    const strengthB = teamStrength(weak.map((player) => ({ player, position: player.position })));
    const result = computeBalance(strengthA, strengthB);
    expect(result.verdict).toBe('EDGE');
    expect(result.leader).toBe('A');
  });

  it('scales with team size: a fixed per-player gap gives the same verdict at 5-, 6-, and 7-a-side', () => {
    function buildTeams(size: number) {
      const strongTeam = Array.from({ length: size }, (_, i) => makePlayer(`s${i}`, 'MID', 4));
      const weakTeam = Array.from({ length: size }, (_, i) => makePlayer(`w${i}`, 'MID', 3));
      const strengthStrong = teamStrength(strongTeam.map((player) => ({ player, position: player.position })));
      const strengthWeak = teamStrength(weakTeam.map((player) => ({ player, position: player.position })));
      return computeBalance(strengthStrong, strengthWeak).verdict;
    }
    const v5 = buildTeams(5);
    const v6 = buildTeams(6);
    const v7 = buildTeams(7);
    expect(v5).toBe(v6);
    expect(v6).toBe(v7);
  });

  it('placing a player out of position lowers their contribution to team strength', () => {
    const striker: Player = {
      id: 's1',
      name: 'Striker',
      position: 'ATT',
      stats: { pace: 5, stamina: 4, finishing: 5, defending: 1, passing: 3, goalkeeping: 1 },
      createdAt: 0,
    };
    const asAttacker = teamStrength([{ player: striker, position: 'ATT' }]);
    const asGoalkeeper = teamStrength([{ player: striker, position: 'GK' }]);
    expect(asGoalkeeper).toBeLessThan(asAttacker);
  });
});
