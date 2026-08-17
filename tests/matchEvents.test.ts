import { describe, expect, it } from 'vitest';
import {
  buildEventFeed,
  describeEvent,
  findLastUndoableEvent,
  formatMatchSummaryForShare,
  tallyMatchStats,
  tallyTeamScore,
} from '../src/lib/matchEvents';
import type { FoulType, MatchEvent, Position, RestartType } from '../src/types';

function goal(playerId: string, team: 'A' | 'B', isOwnGoal = false, id = `${playerId}-goal`, atMs = 0): MatchEvent {
  return { id, atMs, type: 'GOAL', playerId, team, isOwnGoal };
}

function assist(playerId: string, goalEventId: string, atMs = 0): MatchEvent {
  return { id: `${playerId}-assist`, atMs, type: 'ASSIST', playerId, goalEventId };
}

function foul(playerId: string, foulType: FoulType = 'FOUL_PLAY', restart: RestartType = 'FREE_KICK', atMs = 0): MatchEvent {
  return { id: `${playerId}-foul-${Math.random()}`, atMs, type: 'FOUL', playerId, foulType, restart };
}

function saveGk(playerId: string, shooterId?: string, atMs = 0): MatchEvent {
  return { id: `${playerId}-save-${Math.random()}`, atMs, type: 'SAVE_GK', playerId, shooterId };
}

function gkConceded(playerId: string, goalEventId: string, atMs = 0): MatchEvent {
  return { id: `${playerId}-conceded`, atMs, type: 'GK_CONCEDED', playerId, goalEventId };
}

function positionChange(playerId: string, fromPosition: Position, toPosition: Position, atMs = 0): MatchEvent {
  return { id: `${playerId}-poschange-${Math.random()}`, atMs, type: 'POSITION_CHANGE', playerId, fromPosition, toPosition };
}

function corner(team: 'A' | 'B', atMs = 0): MatchEvent {
  return { id: `corner-${Math.random()}`, atMs, type: 'CORNER', team };
}

function throwIn(team: 'A' | 'B', atMs = 0): MatchEvent {
  return { id: `throwin-${Math.random()}`, atMs, type: 'THROW_IN', team };
}

const NAMES: Record<string, string> = { p1: 'Marcus', p2: 'Andrei', p3: 'Priya' };
const playerName = (id: string) => NAMES[id] ?? id;
const teamName = (team: 'A' | 'B') => (team === 'A' ? 'Team Marcus' : 'Team Sofia');

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
    expect(tally.get('scorer')).toEqual({ goals: 1, assists: 0, fouls: 0, saves: 0, concedes: 0 });
    expect(tally.get('passer')).toEqual({ goals: 0, assists: 1, fouls: 0, saves: 0, concedes: 0 });
  });

  it('an own goal does not count toward the scorer personal tally', () => {
    const tally = tallyMatchStats([goal('p1', 'B', true)]);
    expect(tally.get('p1')).toBeUndefined();
  });

  it('a FOUL bumps only fouls', () => {
    const tally = tallyMatchStats([foul('p1'), foul('p1')]);
    expect(tally.get('p1')).toEqual({ goals: 0, assists: 0, fouls: 2, saves: 0, concedes: 0 });
  });

  it('a SAVE_GK bumps only saves, and a GK_CONCEDED bumps only concedes', () => {
    const tally = tallyMatchStats([saveGk('gk1'), saveGk('gk1'), gkConceded('gk2', 'g1')]);
    expect(tally.get('gk1')).toEqual({ goals: 0, assists: 0, fouls: 0, saves: 2, concedes: 0 });
    expect(tally.get('gk2')).toEqual({ goals: 0, assists: 0, fouls: 0, saves: 0, concedes: 1 });
  });

  it('untallied event types (e.g. POSITION_CHANGE) are ignored', () => {
    const events = [positionChange('p1', 'DEF', 'GK')];
    expect(tallyMatchStats(events).size).toBe(0);
  });
});

describe('findLastUndoableEvent', () => {
  it('returns undefined for an empty log', () => {
    expect(findLastUndoableEvent([])).toBeUndefined();
  });

  it('returns undefined when the log is only POSITION_CHANGE entries', () => {
    const events = [positionChange('p1', 'DEF', 'GK'), positionChange('p2', 'GK', 'DEF')];
    expect(findLastUndoableEvent(events)).toBeUndefined();
  });

  it('skips trailing POSITION_CHANGE entries and returns the real event underneath', () => {
    const g = goal('p1', 'A', false, 'g1');
    const events = [g, positionChange('p2', 'DEF', 'GK'), positionChange('p3', 'GK', 'DEF')];
    expect(findLastUndoableEvent(events)).toBe(g);
  });

  it('returns the last event when it is not a POSITION_CHANGE', () => {
    const f = foul('p1');
    const events = [goal('p2', 'A'), f];
    expect(findLastUndoableEvent(events)).toBe(f);
  });
});

describe('describeEvent', () => {
  it('describes a goal', () => {
    expect(describeEvent(goal('p1', 'A', false), playerName, teamName)).toBe('GOAL — Marcus');
  });

  it('describes an own goal distinctly', () => {
    expect(describeEvent(goal('p1', 'B', true), playerName, teamName)).toBe('OWN GOAL — Marcus');
  });

  it('describes an assist', () => {
    expect(describeEvent(assist('p1', 'g1'), playerName, teamName)).toBe('ASSIST — Marcus');
  });

  it('describes a foul with its type', () => {
    expect(describeEvent(foul('p1', 'HANDBALL', 'PENALTY'), playerName, teamName)).toBe('FOUL (Handball) — Marcus');
    expect(describeEvent(foul('p2', 'FOUL_PLAY', 'FREE_KICK'), playerName, teamName)).toBe('FOUL (Foul Play) — Andrei');
  });

  it('describes a save', () => {
    expect(describeEvent(saveGk('p1'), playerName, teamName)).toBe('SAVE — Marcus');
  });

  it('describes a GK_CONCEDED', () => {
    expect(describeEvent(gkConceded('p1', 'g1'), playerName, teamName)).toBe('CONCEDED — Marcus');
  });

  it('describes a position change', () => {
    expect(describeEvent(positionChange('p1', 'DEF', 'GK'), playerName, teamName)).toBe('Marcus: DEF → GK');
  });

  it('describes a corner and a throw-in', () => {
    expect(describeEvent(corner('A'), playerName, teamName)).toBe('CORNER — Team Marcus');
    expect(describeEvent(throwIn('B'), playerName, teamName)).toBe('THROW-IN — Team Sofia');
  });
});

describe('buildEventFeed', () => {
  it('folds a GOAL+ASSIST pair into one entry', () => {
    const g = goal('p1', 'A', false, 'g1', 14 * 60_000);
    const entries = buildEventFeed([g, assist('p2', 'g1', 14 * 60_000)], playerName, teamName);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('14:00 GOAL — Marcus (Assist: Andrei)');
  });

  it('a goal with no assist has no "(Assist: ...)" suffix', () => {
    const entries = buildEventFeed([goal('p1', 'A', false, 'g1', 60_000)], playerName, teamName);
    expect(entries[0].text).toBe('01:00 GOAL — Marcus');
  });

  it('an own goal is credited to the team, with the scorer named alongside', () => {
    const entries = buildEventFeed([goal('p3', 'B', true, 'g1', 22 * 60_000)], playerName, teamName);
    expect(entries[0].text).toBe('22:00 GOAL (OG) — Team Sofia (Priya)');
  });

  it('folds a GOAL+GK_CONCEDED (no assist) into one entry', () => {
    const g = goal('p1', 'A', false, 'g1', 5 * 60_000);
    const entries = buildEventFeed([g, gkConceded('p3', 'g1', 5 * 60_000)], playerName, teamName);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('05:00 GOAL — Marcus (GK: Priya)');
  });

  it('folds GOAL+ASSIST+GK_CONCEDED together, in dispatch order', () => {
    const g = goal('p1', 'A', false, 'g1', 3 * 60_000);
    const entries = buildEventFeed(
      [g, assist('p2', 'g1', 3 * 60_000), gkConceded('p3', 'g1', 3 * 60_000)],
      playerName,
      teamName,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('03:00 GOAL — Marcus (Assist: Andrei) (GK: Priya)');
  });

  it('folds GOAL+GK_CONCEDED+ASSIST when dispatched in the opposite order', () => {
    const g = goal('p1', 'A', false, 'g1', 3 * 60_000);
    const entries = buildEventFeed(
      [g, gkConceded('p3', 'g1', 3 * 60_000), assist('p2', 'g1', 3 * 60_000)],
      playerName,
      teamName,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('03:00 GOAL — Marcus (Assist: Andrei) (GK: Priya)');
  });

  it('formats a foul with its type and restart', () => {
    const entries = buildEventFeed([foul('p2', 'HANDBALL', 'PENALTY', 19 * 60_000)], playerName, teamName);
    expect(entries[0].text).toBe('19:00 FOUL (Handball, Penalty) — Andrei');
  });

  it('formats a save with a named shooter', () => {
    const entries = buildEventFeed([saveGk('p1', 'p2', 10 * 60_000)], playerName, teamName);
    expect(entries[0].text).toBe('10:00 SAVE — Marcus (vs Andrei)');
  });

  it('formats a save with no shooter as unclear', () => {
    const entries = buildEventFeed([saveGk('p1', undefined, 10 * 60_000)], playerName, teamName);
    expect(entries[0].text).toBe('10:00 SAVE — Marcus (unclear shot)');
  });

  it('folds a cross-position swap pair into one SWAP entry', () => {
    const events = [positionChange('p1', 'DEF', 'GK', 7 * 60_000), positionChange('p3', 'GK', 'DEF', 7 * 60_000)];
    const entries = buildEventFeed(events, playerName, teamName);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('07:00 SWAP — Marcus (DEF→GK) / Priya (GK→DEF)');
  });

  it('a lone unpaired POSITION_CHANGE renders its own line', () => {
    const entries = buildEventFeed([positionChange('p1', 'DEF', 'MID', 7 * 60_000)], playerName, teamName);
    expect(entries[0].text).toBe('07:00 POSITION CHANGE — Marcus (DEF→MID)');
  });

  it('formats a corner and a throw-in', () => {
    const entries = buildEventFeed([corner('A', 60_000), throwIn('B', 90_000)], playerName, teamName);
    expect(entries.map((e) => e.text)).toEqual(['01:00 CORNER — Team Marcus', '01:30 THROW-IN — Team Sofia']);
  });

  it('stays chronological (oldest first) and does not double-count the assist as its own entry', () => {
    const g1 = goal('p1', 'A', false, 'g1', 12 * 60_000);
    const events = [
      g1,
      assist('p2', 'g1', 12 * 60_000),
      foul('p2', 'FOUL_PLAY', 'FREE_KICK', 19 * 60_000),
      goal('p3', 'B', true, 'g2', 22 * 60_000),
    ];
    const entries = buildEventFeed(events, playerName, teamName);
    expect(entries.map((e) => e.text)).toEqual([
      '12:00 GOAL — Marcus (Assist: Andrei)',
      '19:00 FOUL (Foul Play, Free Kick) — Andrei',
      '22:00 GOAL (OG) — Team Sofia (Priya)',
    ]);
  });

  it('a lone ASSIST left behind after its GOAL was undone renders nothing', () => {
    // Mirrors what the event log actually looks like after UNDO_LAST_EVENT
    // pops a goal but an unrelated assist for a *different*, already-undone
    // goal is (hypothetically) still present — defensive, not a real reachable state.
    const entries = buildEventFeed([assist('p2', 'missing-goal')], playerName, teamName);
    expect(entries).toEqual([]);
  });

  it('returns an empty feed for an empty event log', () => {
    expect(buildEventFeed([], playerName, teamName)).toEqual([]);
  });
});

describe('formatMatchSummaryForShare', () => {
  it('formats the score header and both team blocks with per-player tallies', () => {
    const text = formatMatchSummaryForShare(
      'Marcus',
      2,
      [
        { name: 'Marcus Webb', goals: 0, assists: 0, fouls: 1, saves: 0, concedes: 0 },
        { name: 'Elena Popescu', goals: 2, assists: 1, fouls: 0, saves: 0, concedes: 0 },
      ],
      'Sofia',
      1,
      [{ name: 'Sofia Reyes', goals: 0, assists: 0, fouls: 0, saves: 3, concedes: 1 }],
    );
    expect(text).toBe(
      [
        'Team Marcus 2 – 1 Team Sofia',
        '',
        'Team Marcus',
        '- Marcus Webb (1F)',
        '- Elena Popescu (2G 1A)',
        '',
        'Team Sofia',
        '- Sofia Reyes (3SV 1CN)',
      ].join('\n'),
    );
  });

  it('omits the parenthetical entirely for a player with no goals/assists/fouls/saves/concedes', () => {
    const text = formatMatchSummaryForShare(
      'A',
      0,
      [{ name: 'Bench Warmer', goals: 0, assists: 0, fouls: 0, saves: 0, concedes: 0 }],
      'B',
      0,
      [],
    );
    expect(text).toContain('- Bench Warmer\n');
  });
});
