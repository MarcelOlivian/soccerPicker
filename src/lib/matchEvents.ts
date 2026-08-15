import type { MatchEvent } from '../types';

export function tallyTeamScore(events: MatchEvent[]): { scoreA: number; scoreB: number } {
  let scoreA = 0;
  let scoreB = 0;
  for (const e of events) {
    if (e.type !== 'GOAL') continue;
    if (e.team === 'A') scoreA++;
    else scoreB++;
  }
  return { scoreA, scoreB };
}

export interface PlayerTally {
  goals: number;
  assists: number;
  fouls: number;
}

/** Own goals are excluded from the scorer's personal tally (not an achievement) but still count toward the opposing team's scoreboard total via tallyTeamScore. */
export function tallyMatchStats(events: MatchEvent[]): Map<string, PlayerTally> {
  const tally = new Map<string, PlayerTally>();
  const bump = (id: string, field: keyof PlayerTally) => {
    const t = tally.get(id) ?? { goals: 0, assists: 0, fouls: 0 };
    t[field]++;
    tally.set(id, t);
  };
  for (const e of events) {
    if (e.type === 'GOAL' && !e.isOwnGoal) bump(e.playerId, 'goals');
    if (e.type === 'ASSIST') bump(e.playerId, 'assists');
    if (e.type === 'FOUL') bump(e.playerId, 'fouls');
  }
  return tally;
}

/** Human-readable label for the Undo button, e.g. "GOAL — Marcus", "OWN GOAL — Sofia", "FOUL — Ana". */
export function describeEvent(event: MatchEvent, playerName: string): string {
  switch (event.type) {
    case 'GOAL':
      return `${event.isOwnGoal ? 'OWN GOAL' : 'GOAL'} — ${playerName}`;
    case 'ASSIST':
      return `ASSIST — ${playerName}`;
    case 'FOUL':
      return `FOUL — ${playerName}`;
    default:
      return event.type;
  }
}
