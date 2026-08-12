import type { Player, PlayerStats, Position } from '../types';

interface DemoDef {
  name: string;
  nickname?: string;
  position: Position;
  stats: PlayerStats;
}

const DEMO_DEFS: DemoDef[] = [
  {
    name: 'Marcus Webb',
    nickname: 'The Wall',
    position: 'GK',
    stats: { pace: 2, stamina: 3, finishing: 1, defending: 3, passing: 2, goalkeeping: 5 },
  },
  {
    name: 'Sofia Reyes',
    nickname: 'Spider',
    position: 'GK',
    stats: { pace: 3, stamina: 3, finishing: 1, defending: 2, passing: 3, goalkeeping: 4 },
  },
  {
    name: 'Jamie Chen',
    position: 'DEF',
    stats: { pace: 3, stamina: 4, finishing: 2, defending: 5, passing: 3, goalkeeping: 1 },
  },
  {
    name: 'Diego Alvarez',
    position: 'DEF',
    stats: { pace: 2, stamina: 4, finishing: 1, defending: 4, passing: 4, goalkeeping: 1 },
  },
  {
    name: 'Priya Kapoor',
    position: 'DEF',
    stats: { pace: 4, stamina: 3, finishing: 2, defending: 4, passing: 3, goalkeeping: 1 },
  },
  {
    name: "Liam O'Connor",
    nickname: 'Tank',
    position: 'DEF',
    stats: { pace: 2, stamina: 5, finishing: 1, defending: 5, passing: 2, goalkeeping: 1 },
  },
  {
    name: 'Amara Okafor',
    position: 'MID',
    stats: { pace: 4, stamina: 4, finishing: 3, defending: 3, passing: 5, goalkeeping: 1 },
  },
  {
    name: 'Noah Bergström',
    nickname: 'Engine',
    position: 'MID',
    stats: { pace: 3, stamina: 5, finishing: 3, defending: 3, passing: 4, goalkeeping: 1 },
  },
  {
    name: 'Yuki Tanaka',
    position: 'MID',
    stats: { pace: 4, stamina: 4, finishing: 3, defending: 2, passing: 4, goalkeeping: 1 },
  },
  {
    name: 'Elena Popescu',
    nickname: 'Sniper',
    position: 'ATT',
    stats: { pace: 4, stamina: 3, finishing: 5, defending: 1, passing: 3, goalkeeping: 1 },
  },
  {
    name: 'Tariq Hassan',
    position: 'ATT',
    stats: { pace: 5, stamina: 3, finishing: 4, defending: 1, passing: 2, goalkeeping: 1 },
  },
  {
    name: 'Bianca Rossi',
    nickname: 'Hollywood',
    position: 'ATT',
    stats: { pace: 3, stamina: 2, finishing: 5, defending: 1, passing: 4, goalkeeping: 1 },
  },
];

/** A ready-made 12-player roster so the app is explorable with an empty setup tab. */
export function demoRoster(): Player[] {
  const now = Date.now();
  return DEMO_DEFS.map((def, i) => ({
    id: crypto.randomUUID(),
    name: def.name,
    nickname: def.nickname,
    position: def.position,
    stats: def.stats,
    createdAt: now - (DEMO_DEFS.length - i) * 1000,
  }));
}
