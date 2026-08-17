import { appearancesAtPosition, matchResult, matchesForPlayer } from './playerMatchLog';
import type { PlayerMatchAppearance } from './playerMatchLog';
import type { MatchHistoryEntry, Player, Position, StatKey, StatValue } from '../types';

const WINDOW = 5;
const MIN_SAMPLE = 3;

export interface SuggestedChange {
  statKey: StatKey;
  direction: 'up' | 'down';
  newValue: StatValue;
  reasonText: string;
  sampleSize: number;
  positionEvidence: Position;
}

/** Internal only — carries the tie-break margin, stripped before returning. */
interface Candidate extends SuggestedChange {
  margin: number;
}

interface Metrics {
  games: number;
  avgGoals: number;
  avgAssists: number;
  avgFouls: number;
  avgSaves: number;
  avgConcedes: number;
  /** null when no match in the window had a score entered — never treated as a loss. */
  winRate: number | null;
}

function computeMetrics(appearances: PlayerMatchAppearance[]): Metrics {
  const games = appearances.length;
  let goals = 0;
  let assists = 0;
  let fouls = 0;
  let saves = 0;
  let concedes = 0;
  let wins = 0;
  let decided = 0;
  for (const a of appearances) {
    goals += a.snapshot.goals ?? 0;
    assists += a.snapshot.assists ?? 0;
    fouls += a.snapshot.fouls ?? 0;
    saves += a.snapshot.saves ?? 0;
    concedes += a.snapshot.concedes ?? 0;
    const result = matchResult(a.entry, a.team);
    if (result !== 'unknown') {
      decided++;
      if (result === 'win') wins++;
    }
  }
  return {
    games,
    avgGoals: games ? goals / games : 0,
    avgAssists: games ? assists / games : 0,
    avgFouls: games ? fouls / games : 0,
    avgSaves: games ? saves / games : 0,
    avgConcedes: games ? concedes / games : 0,
    winRate: decided ? wins / decided : null,
  };
}

function clampStat(n: number): StatValue {
  return Math.min(5, Math.max(1, n)) as StatValue;
}

function fmt(n: number): string {
  return n.toFixed(1);
}

function evalAtt(appearances: PlayerMatchAppearance[], shooting: StatValue): Candidate | null {
  const m = computeMetrics(appearances);
  if (m.games < MIN_SAMPLE) return null;
  if (shooting < 5 && m.avgGoals >= 1.5) {
    return {
      statKey: 'shooting',
      direction: 'up',
      newValue: clampStat(shooting + 1),
      reasonText: `averaging ${fmt(m.avgGoals)} goals/match over the last ${m.games} games as ATT.`,
      sampleSize: m.games,
      positionEvidence: 'ATT',
      margin: m.avgGoals - 1.5,
    };
  }
  if (shooting >= 3 && m.avgGoals < 0.4) {
    return {
      statKey: 'shooting',
      direction: 'down',
      newValue: clampStat(shooting - 1),
      reasonText: `averaging only ${fmt(m.avgGoals)} goals/match over the last ${m.games} games as ATT.`,
      sampleSize: m.games,
      positionEvidence: 'ATT',
      margin: 0.4 - m.avgGoals,
    };
  }
  return null;
}

function evalMid(appearances: PlayerMatchAppearance[], passing: StatValue): Candidate | null {
  const m = computeMetrics(appearances);
  if (m.games < MIN_SAMPLE) return null;
  if (passing < 5 && m.avgAssists >= 1.0) {
    return {
      statKey: 'passing',
      direction: 'up',
      newValue: clampStat(passing + 1),
      reasonText: `averaging ${fmt(m.avgAssists)} assists/match over the last ${m.games} games as MID.`,
      sampleSize: m.games,
      positionEvidence: 'MID',
      margin: m.avgAssists - 1.0,
    };
  }
  if (passing >= 3 && m.avgAssists < 0.3) {
    return {
      statKey: 'passing',
      direction: 'down',
      newValue: clampStat(passing - 1),
      reasonText: `averaging only ${fmt(m.avgAssists)} assists/match over the last ${m.games} games as MID.`,
      sampleSize: m.games,
      positionEvidence: 'MID',
      margin: 0.3 - m.avgAssists,
    };
  }
  return null;
}

function evalDef(appearances: PlayerMatchAppearance[], defending: StatValue): Candidate | null {
  const m = computeMetrics(appearances);
  if (m.games < MIN_SAMPLE) return null;
  if (defending < 5 && m.avgFouls <= 0.3 && m.winRate !== null && m.winRate >= 0.6) {
    return {
      statKey: 'defending',
      direction: 'up',
      newValue: clampStat(defending + 1),
      reasonText: `only ${fmt(m.avgFouls)} fouls/match and a ${Math.round(m.winRate * 100)}% win rate over the last ${m.games} games as DEF.`,
      sampleSize: m.games,
      positionEvidence: 'DEF',
      margin: Math.min(0.3 - m.avgFouls, m.winRate - 0.6),
    };
  }
  if (defending >= 3 && (m.avgFouls >= 1.0 || (m.winRate !== null && m.winRate <= 0.35))) {
    return {
      statKey: 'defending',
      direction: 'down',
      newValue: clampStat(defending - 1),
      reasonText: `${fmt(m.avgFouls)} fouls/match${m.winRate !== null ? ` and a ${Math.round(m.winRate * 100)}% win rate` : ''} over the last ${m.games} games as DEF.`,
      sampleSize: m.games,
      positionEvidence: 'DEF',
      margin: Math.max(m.avgFouls - 1.0, m.winRate !== null ? 0.35 - m.winRate : -Infinity),
    };
  }
  return null;
}

function evalGk(appearances: PlayerMatchAppearance[], defending: StatValue): Candidate | null {
  const m = computeMetrics(appearances);
  if (m.games < MIN_SAMPLE) return null;
  if (defending < 5 && m.avgSaves >= 2 && m.avgConcedes <= 1) {
    return {
      statKey: 'defending',
      direction: 'up',
      newValue: clampStat(defending + 1),
      reasonText: `averaging ${fmt(m.avgSaves)} saves and only ${fmt(m.avgConcedes)} conceded/match over the last ${m.games} games as GK.`,
      sampleSize: m.games,
      positionEvidence: 'GK',
      margin: Math.min(m.avgSaves - 2, 1 - m.avgConcedes),
    };
  }
  if (defending >= 3 && m.avgConcedes >= 2 && m.avgSaves < 1) {
    return {
      statKey: 'defending',
      direction: 'down',
      newValue: clampStat(defending - 1),
      reasonText: `averaging ${fmt(m.avgConcedes)} conceded and only ${fmt(m.avgSaves)} saves/match over the last ${m.games} games as GK.`,
      sampleSize: m.games,
      positionEvidence: 'GK',
      margin: Math.min(m.avgConcedes - 2, 1 - m.avgSaves),
    };
  }
  return null;
}

/**
 * At most one suggestion per player. When multiple positions qualify, ranks
 * by sampleSize (number of qualifying appearances) first, then by how far
 * past its threshold the qualifying signal is. `reasonText` is a lowercase
 * fragment ("averaging 1.6 goals/match...") — prepend a subject ("Marcus is
 * ") at render time; kept out of this pure function so it stays name-free.
 */
export function suggestStatChange(player: Player, history: MatchHistoryEntry[]): SuggestedChange | null {
  const appearances = matchesForPlayer(history, player.id);
  const byPos = (pos: Position) => appearancesAtPosition(appearances, pos, WINDOW);

  const candidates = [
    evalAtt(byPos('ATT'), player.stats.shooting),
    evalMid(byPos('MID'), player.stats.passing),
    evalDef(byPos('DEF'), player.stats.defending),
    evalGk(byPos('GK'), player.stats.defending),
  ].filter((c): c is Candidate => c !== null);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.sampleSize - a.sampleSize || b.margin - a.margin);
  const { margin: _margin, ...suggestion } = candidates[0];
  return suggestion;
}
