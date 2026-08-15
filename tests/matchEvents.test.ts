import { describe, expect, it } from 'vitest';
import { describeEvent, tallyMatchStats, tallyTeamScore } from '../src/lib/matchEvents';
import type { MatchEvent } from '../src/types';

function goal(playerId: string, team: 'A' | 'B', isOwnGoal = false, id = `${playerId}-goal`): MatchEvent {
  return { id, atMs: 0, type: 'GOAL', playerId, team, isOwnGoal };
}

function assist(playerId: string, goalEventId: string): MatchEvent {
  return { id: `${playerId}-assist`, atMs: 0, type: 'ASSIST', playerId, goalEventId };
}

function foul(playerId: string): MatchEvent {
  return { id: `${playerId}-foul-${Math.random()}`, atMs: 0, type: 'FOUL', playerId };
}

describe('tallyTeamScore', () => {
  it('counts GOAL events by team', () => {
    const events = [goal('p1', 'A'), goal('p2', 'B'), goal('p3', 'A')];
    expect(tallyTeamScore(events)).toEqual({ scoreA: 2, scoreB: 1 });
  });

  it('an own goal credits the team the scorer conceded to, not their own', () => {
    // p1 is on team A but scores an own goal, so it's recorded with team: 'B'.
    const events = [goal('p1', 'B', true)];
    expect(tallyTeamScore(events)).toEqual({ scoreA: 0, scoreB: 1 });
  });

  it('ignores non-GOAL events', () => {
    const events = [assist('p2', 'g1'), foul('p3')];
    expect(tallyTeamScore(events)).toEqual({ scoreA: 0, scoreB: 0 });
  });
});

describe('tallyMatchStats', () => {
  it('tallies a GOAL+ASSIST pair', () => {
    const g = goal('scorer', 'A', false, 'g1');
    const events = [g, assist('passer', 'g1')];
    const tally = tallyMatchStats(events);
    expect(tally.get('scorer')).toEqual({ goals: 1, assists: 0, fouls: 0 });
    expect(tally.get('passer')).toEqual({ goals: 0, assists: 1, fouls: 0 });
  });

  it('an own goal does not count toward the scorer personal tally', () => {
    const tally = tallyMatchStats([goal('p1', 'B', true)]);
    expect(tally.get('p1')).toBeUndefined();
  });

  it('a FOUL bumps only fouls', () => {
    const tally = tallyMatchStats([foul('p1'), foul('p1')]);
    expect(tally.get('p1')).toEqual({ goals: 0, assists: 0, fouls: 2 });
  });

  it('untallied event types (e.g. SAVE_GK) are ignored', () => {
    const events: MatchEvent[] = [{ id: 'e1', atMs: 0, type: 'SAVE_GK', playerId: 'p1' }];
    expect(tallyMatchStats(events).size).toBe(0);
  });
});

describe('describeEvent', () => {
  it('describes a goal', () => {
    expect(describeEvent(goal('p1', 'A', false), 'Marcus')).toBe('GOAL — Marcus');
  });

  it('describes an own goal distinctly', () => {
    expect(describeEvent(goal('p1', 'B', true), 'Sofia')).toBe('OWN GOAL — Sofia');
  });

  it('describes an assist', () => {
    expect(describeEvent(assist('p1', 'g1'), 'Ana')).toBe('ASSIST — Ana');
  });

  it('describes a foul', () => {
    expect(describeEvent(foul('p1'), 'Bonte')).toBe('FOUL — Bonte');
  });
});
