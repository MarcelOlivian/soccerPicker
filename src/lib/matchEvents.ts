import { formatMatchStartedAt } from './dateFormat';
import { formatClock } from './matchClock';
import type { FoulType, MatchEvent, RestartType, Team } from '../types';

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
  saves: number;
  concedes: number;
}

/** Own goals are excluded from the scorer's personal tally (not an achievement) but still count toward the opposing team's scoreboard total via tallyTeamScore. */
export function tallyMatchStats(events: MatchEvent[]): Map<string, PlayerTally> {
  const tally = new Map<string, PlayerTally>();
  const bump = (id: string, field: keyof PlayerTally) => {
    const t = tally.get(id) ?? { goals: 0, assists: 0, fouls: 0, saves: 0, concedes: 0 };
    t[field]++;
    tally.set(id, t);
  };
  for (const e of events) {
    if (e.type === 'GOAL' && !e.isOwnGoal) bump(e.playerId, 'goals');
    if (e.type === 'ASSIST') bump(e.playerId, 'assists');
    if (e.type === 'FOUL') bump(e.playerId, 'fouls');
    if (e.type === 'SAVE_GK') bump(e.playerId, 'saves');
    if (e.type === 'GK_CONCEDED') bump(e.playerId, 'concedes');
  }
  return tally;
}

const FOUL_TYPE_LABELS: Record<FoulType, string> = { HANDBALL: 'Handball', FOUL_PLAY: 'Foul Play' };
const RESTART_LABELS: Record<RestartType, string> = { FREE_KICK: 'Free Kick', PENALTY: 'Penalty' };

/** The event UNDO_LAST_EVENT will actually act on: the most recent entry that isn't a POSITION_CHANGE (those are permanent log history, never undoable). Single source of truth so the reducer's removal and the UI's button label/disabled-state never disagree about which event "last" means. */
export function findLastUndoableEvent(events: MatchEvent[]): MatchEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type !== 'POSITION_CHANGE') return events[i];
  }
  return undefined;
}

/** Human-readable label for the Undo button, e.g. "GOAL — Marcus", "OWN GOAL — Sofia", "FOUL (Handball) — Ana". */
export function describeEvent(
  event: MatchEvent,
  playerName: (playerId: string) => string,
  teamName: (team: Team) => string,
): string {
  switch (event.type) {
    case 'GOAL':
      return `${event.isOwnGoal ? 'OWN GOAL' : 'GOAL'} — ${playerName(event.playerId)}`;
    case 'ASSIST':
      return `ASSIST — ${playerName(event.playerId)}`;
    case 'FOUL':
      return `FOUL (${FOUL_TYPE_LABELS[event.foulType]}) — ${playerName(event.playerId)}`;
    case 'SAVE_GK':
      return `SAVE — ${playerName(event.playerId)}`;
    case 'GK_CONCEDED':
      return `CONCEDED — ${playerName(event.playerId)}`;
    case 'POSITION_CHANGE':
      return `${playerName(event.playerId)}: ${event.fromPosition} → ${event.toPosition}`;
    case 'CORNER':
      return `CORNER — ${teamName(event.team)}`;
    case 'THROW_IN':
      return `THROW-IN — ${teamName(event.team)}`;
    case 'SUB_IN':
      return `SUB IN — ${playerName(event.playerId)}`;
    case 'SUB_OUT':
      return `SUB OUT — ${playerName(event.playerId)}`;
    default:
      // Unreachable — the switch above is exhaustive over MatchEventType —
      // but kept as a defensive fallback for any future event type added to
      // the union without a case here.
      return (event as MatchEvent).type;
  }
}

export interface EventFeedEntry {
  /** The id of the primary event this entry represents (an ASSIST/GK_CONCEDED is folded into its GOAL's entry, a paired POSITION_CHANGE into its swap-mate's, never shown as its own entry). */
  id: string;
  atMs: number;
  text: string;
}

/**
 * Turns the raw event log into one display-ready line per goal/foul/save/
 * swap/team-event, chronological (oldest first, matching the array itself).
 * A GOAL optionally folds in an ASSIST and/or a GK_CONCEDED dispatched
 * immediately after it (see BoardStage's handleRecordGoal — at most one of
 * each, in either order), and a cross-position SWAP folds its two adjacent
 * POSITION_CHANGE entries into one line.
 *
 * `clockStartedAt`, when given (match.clock.startedAt — a real wall-clock
 * Date.now() value, not match-elapsed time), prepends a "Match started —
 * HH:MM DD.MM.YYYY" line so the log shows exactly when tracking began, even
 * before any goals/fouls are recorded.
 */
export function buildEventFeed(
  events: MatchEvent[],
  playerName: (playerId: string) => string,
  teamName: (team: Team) => string,
  clockStartedAt?: number | null,
): EventFeedEntry[] {
  const entries: EventFeedEntry[] = [];
  if (clockStartedAt) {
    entries.push({ id: 'match-start', atMs: 0, text: `Match started — ${formatMatchStartedAt(clockStartedAt)}` });
  }
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const minute = formatClock(event.atMs);

    if (event.type === 'GOAL') {
      let assist: Extract<MatchEvent, { type: 'ASSIST' }> | undefined;
      let conceded: Extract<MatchEvent, { type: 'GK_CONCEDED' }> | undefined;
      let j = i + 1;
      while (j < events.length && j <= i + 2) {
        const candidate = events[j];
        if (!assist && candidate.type === 'ASSIST' && candidate.goalEventId === event.id) {
          assist = candidate;
          j++;
        } else if (!conceded && candidate.type === 'GK_CONCEDED' && candidate.goalEventId === event.id) {
          conceded = candidate;
          j++;
        } else {
          break;
        }
      }
      const assistText = assist ? ` (Assist: ${playerName(assist.playerId)})` : '';
      const concededText = conceded ? ` (GK: ${playerName(conceded.playerId)})` : '';
      const text = event.isOwnGoal
        ? `${minute} GOAL (OG) — ${teamName(event.team)} (${playerName(event.playerId)})${assistText}${concededText}`
        : `${minute} GOAL — ${playerName(event.playerId)}${assistText}${concededText}`;
      entries.push({ id: event.id, atMs: event.atMs, text });
      i = j - 1; // consumed alongside its goal

    } else if (event.type === 'FOUL') {
      entries.push({
        id: event.id,
        atMs: event.atMs,
        text: `${minute} FOUL (${FOUL_TYPE_LABELS[event.foulType]}, ${RESTART_LABELS[event.restart]}) — ${playerName(event.playerId)}`,
      });

    } else if (event.type === 'SAVE_GK') {
      const shooter = event.shooterId ? ` (vs ${playerName(event.shooterId)})` : ' (unclear shot)';
      entries.push({ id: event.id, atMs: event.atMs, text: `${minute} SAVE — ${playerName(event.playerId)}${shooter}` });

    } else if (event.type === 'POSITION_CHANGE') {
      const next = events[i + 1];
      // The reducer always pushes a swap's two entries adjacently, same atMs.
      const pair = next && next.type === 'POSITION_CHANGE' && next.atMs === event.atMs ? next : undefined;
      const text = pair
        ? `${minute} SWAP — ${playerName(event.playerId)} (${event.fromPosition}→${event.toPosition}) / ${playerName(pair.playerId)} (${pair.fromPosition}→${pair.toPosition})`
        : `${minute} POSITION CHANGE — ${playerName(event.playerId)} (${event.fromPosition}→${event.toPosition})`;
      entries.push({ id: event.id, atMs: event.atMs, text });
      if (pair) i++;

    } else if (event.type === 'CORNER') {
      entries.push({ id: event.id, atMs: event.atMs, text: `${minute} CORNER — ${teamName(event.team)}` });
    } else if (event.type === 'THROW_IN') {
      entries.push({ id: event.id, atMs: event.atMs, text: `${minute} THROW-IN — ${teamName(event.team)}` });
    }
    // A standalone ASSIST/GK_CONCEDED (consumed above, or orphaned by an
    // undo) and SUB_IN/SUB_OUT (still unused this round) have no line of
    // their own.
  }
  return entries;
}

export interface SummaryPlayerLine {
  name: string;
  goals: number;
  assists: number;
  fouls: number;
  saves: number;
  concedes: number;
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
    const tally = [
      p.goals && `${p.goals}G`,
      p.assists && `${p.assists}A`,
      p.fouls && `${p.fouls}F`,
      p.saves && `${p.saves}SV`,
      p.concedes && `${p.concedes}CN`,
    ].filter(Boolean);
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

/** Plain-text raw event log, one line per EventFeedEntry, chronological — mirrors formatMatchSummaryForShare's plain-text convention for pasting into a chat. */
export function formatEventFeedForShare(entries: EventFeedEntry[]): string {
  if (entries.length === 0) return 'No events recorded.';
  return entries.map((e) => e.text).join('\n');
}
