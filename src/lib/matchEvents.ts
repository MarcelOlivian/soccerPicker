import type { MatchEvent, Team } from '../types';

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

/** Whole elapsed minutes as a football-style marker, e.g. 14' — same 0-based, floor()'d semantics as formatClock, so the two never disagree about "when" something happened. */
export function formatMatchMinute(atMs: number): string {
  return `${Math.floor(atMs / 60000)}'`;
}

export interface EventFeedEntry {
  /** The id of the GOAL/FOUL event this entry represents (an ASSIST is folded into its GOAL's entry, never its own). */
  id: string;
  atMs: number;
  text: string;
}

/**
 * Turns the raw event log into one display-ready line per goal/foul,
 * chronological (oldest first, matching the array itself). An ASSIST is
 * always dispatched immediately after its GOAL (see BoardStage's
 * handleRecordGoal), so it's folded into that GOAL's line rather than
 * shown as its own entry — "GOAL — Marcus (Assist: Andrei)". An own goal
 * is attributed to the team it's credited to, with the scorer named
 * alongside for dispute resolution — "GOAL (OG) — Team B (Priya)".
 */
export function buildEventFeed(
  events: MatchEvent[],
  playerName: (playerId: string) => string,
  teamName: (team: Team) => string,
): EventFeedEntry[] {
  const entries: EventFeedEntry[] = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === 'GOAL') {
      const next = events[i + 1];
      const assist = next && next.type === 'ASSIST' && next.goalEventId === event.id ? next : undefined;
      const minute = formatMatchMinute(event.atMs);
      const text = event.isOwnGoal
        ? `${minute} GOAL (OG) — ${teamName(event.team)} (${playerName(event.playerId)})`
        : `${minute} GOAL — ${playerName(event.playerId)}${assist ? ` (Assist: ${playerName(assist.playerId)})` : ''}`;
      entries.push({ id: event.id, atMs: event.atMs, text });
      if (assist) i++; // consumed alongside its goal
    } else if (event.type === 'FOUL') {
      entries.push({ id: event.id, atMs: event.atMs, text: `${formatMatchMinute(event.atMs)} FOUL — ${playerName(event.playerId)}` });
    }
    // A standalone ASSIST (its GOAL undone out from under it) or any
    // not-yet-UI'd event type (SAVE_GK, SUB_IN/OUT, CORNER_A/B) has no
    // line of its own — nothing else in this round produces those states.
  }
  return entries;
}

export interface SummaryPlayerLine {
  name: string;
  goals: number;
  assists: number;
  fouls: number;
}

/** Plain-text final score + per-player tallies, e.g. for pasting into a chat — mirrors lib/draft.ts's formatTeamsList. */
export function formatMatchSummaryForShare(
  teamAName: string,
  scoreA: number,
  teamAPlayers: SummaryPlayerLine[],
  teamBName: string,
  scoreB: number,
  teamBPlayers: SummaryPlayerLine[],
): string {
  const formatLine = (p: SummaryPlayerLine) => {
    const tally = [p.goals && `${p.goals}G`, p.assists && `${p.assists}A`, p.fouls && `${p.fouls}F`].filter(Boolean);
    return `- ${p.name}${tally.length ? ` (${tally.join(' ')})` : ''}`;
  };
  return [
    `Team ${teamAName} ${scoreA} – ${scoreB} Team ${teamBName}`,
    '',
    `Team ${teamAName}`,
    ...teamAPlayers.map(formatLine),
    '',
    `Team ${teamBName}`,
    ...teamBPlayers.map(formatLine),
  ].join('\n');
}
