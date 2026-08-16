import { describe, expect, it } from 'vitest';
import {
  buildEventFeed,
  describeEvent,
  formatMatchMinute,
  formatMatchSummaryForShare,
  tallyMatchStats,
  tallyTeamScore,
} from '../src/lib/matchEvents';
import type { MatchEvent } from '../src/types';

function goal(playerId: string, team: 'A' | 'B', isOwnGoal = false, id = `${playerId}-goal`, atMs = 0): MatchEvent {
  return { id, atMs, type: 'GOAL', playerId, team, isOwnGoal };
}

function assist(playerId: string, goalEventId: string, atMs = 0): MatchEvent {
  return { id: `${playerId}-assist`, atMs, type: 'ASSIST', playerId, goalEventId };
}

function foul(playerId: string, atMs = 0): MatchEvent {
  return { id: `${playerId}-foul-${Math.random()}`, atMs, type: 'FOUL', playerId };
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

describe('formatMatchMinute', () => {
  it('floors to whole elapsed minutes, 0-based, matching formatClock semantics', () => {
    expect(formatMatchMinute(0)).toBe("0'");
    expect(formatMatchMinute(59_000)).toBe("0'");
    expect(formatMatchMinute(60_000)).toBe("1'");
    expect(formatMatchMinute(14 * 60_000 + 32_000)).toBe("14'");
  });
});

describe('buildEventFeed', () => {
  it('folds a GOAL+ASSIST pair into one entry', () => {
    const g = goal('p1', 'A', false, 'g1', 14 * 60_000);
    const entries = buildEventFeed([g, assist('p2', 'g1', 14 * 60_000)], playerName, teamName);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe("14' GOAL — Marcus (Assist: Andrei)");
  });

  it('a goal with no assist has no "(Assist: ...)" suffix', () => {
    const entries = buildEventFeed([goal('p1', 'A', false, 'g1', 60_000)], playerName, teamName);
    expect(entries[0].text).toBe("1' GOAL — Marcus");
  });

  it('an own goal is credited to the team, with the scorer named alongside', () => {
    const entries = buildEventFeed([goal('p3', 'B', true, 'g1', 22 * 60_000)], playerName, teamName);
    expect(entries[0].text).toBe("22' GOAL (OG) — Team Sofia (Priya)");
  });

  it('formats a foul', () => {
    const entries = buildEventFeed([foul('p2', 19 * 60_000)], playerName, teamName);
    expect(entries[0].text).toBe("19' FOUL — Andrei");
  });

  it('stays chronological (oldest first) and does not double-count the assist as its own entry', () => {
    const g1 = goal('p1', 'A', false, 'g1', 12 * 60_000);
    const events = [g1, assist('p2', 'g1', 12 * 60_000), foul('p2', 19 * 60_000), goal('p3', 'B', true, 'g2', 22 * 60_000)];
    const entries = buildEventFeed(events, playerName, teamName);
    expect(entries.map((e) => e.text)).toEqual([
      "12' GOAL — Marcus (Assist: Andrei)",
      "19' FOUL — Andrei",
      "22' GOAL (OG) — Team Sofia (Priya)",
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
        { name: 'Marcus Webb', goals: 0, assists: 0, fouls: 1 },
        { name: 'Elena Popescu', goals: 2, assists: 1, fouls: 0 },
      ],
      'Sofia',
      1,
      [{ name: 'Sofia Reyes', goals: 0, assists: 0, fouls: 0 }],
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
        '- Sofia Reyes',
      ].join('\n'),
    );
  });

  it('omits the parenthetical entirely for a player with no goals/assists/fouls', () => {
    const text = formatMatchSummaryForShare('A', 0, [{ name: 'Bench Warmer', goals: 0, assists: 0, fouls: 0 }], 'B', 0, []);
    expect(text).toContain('- Bench Warmer\n');
  });
});
