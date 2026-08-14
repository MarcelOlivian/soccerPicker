import type { Player, PlayerStats, Position } from '../types';

interface DemoDef {
  name: string;
  nickname?: string;
  position: Position;
  stats: PlayerStats;
  taunt?: string;
  /** randomuser.me's static portrait CDN — a real photo for each demo player with no live API call. */
  photoUrl: string;
}

function portrait(gender: 'men' | 'women', index: number): string {
  return `https://randomuser.me/api/portraits/${gender}/${index}.jpg`;
}

const DEMO_DEFS: DemoDef[] = [
  {
    name: 'Marcus Webb',
    nickname: 'The Wall',
    position: 'GK',
    stats: { pace: 2, shooting: 1, passing: 2, dribbling: 1, defending: 5, physicality: 4 },
    taunt: 'Nothing gets past me.',
    photoUrl: portrait('men', 32),
  },
  {
    name: 'Sofia Reyes',
    nickname: 'Spider',
    position: 'GK',
    stats: { pace: 3, shooting: 1, passing: 3, dribbling: 2, defending: 4, physicality: 3 },
    taunt: 'I have eight hands, apparently.',
    photoUrl: portrait('women', 44),
  },
  {
    name: 'Jamie Chen',
    position: 'DEF',
    stats: { pace: 3, shooting: 2, passing: 3, dribbling: 2, defending: 5, physicality: 4 },
    photoUrl: portrait('men', 12),
  },
  {
    name: 'Diego Alvarez',
    position: 'DEF',
    stats: { pace: 2, shooting: 1, passing: 4, dribbling: 2, defending: 4, physicality: 4 },
    photoUrl: portrait('men', 45),
  },
  {
    name: 'Priya Kapoor',
    position: 'DEF',
    stats: { pace: 4, shooting: 2, passing: 3, dribbling: 3, defending: 4, physicality: 3 },
    photoUrl: portrait('women', 21),
  },
  {
    name: "Liam O'Connor",
    nickname: 'Tank',
    position: 'DEF',
    stats: { pace: 2, shooting: 1, passing: 2, dribbling: 1, defending: 5, physicality: 5 },
    taunt: "You'll feel that tackle tomorrow.",
    photoUrl: portrait('men', 78),
  },
  {
    name: 'Amara Okafor',
    position: 'MID',
    stats: { pace: 4, shooting: 3, passing: 5, dribbling: 4, defending: 3, physicality: 4 },
    photoUrl: portrait('women', 8),
  },
  {
    name: 'Noah Bergström',
    nickname: 'Engine',
    position: 'MID',
    stats: { pace: 3, shooting: 3, passing: 4, dribbling: 3, defending: 3, physicality: 5 },
    taunt: "I don't stop running. Ever.",
    photoUrl: portrait('men', 5),
  },
  {
    name: 'Yuki Tanaka',
    position: 'MID',
    stats: { pace: 4, shooting: 3, passing: 4, dribbling: 4, defending: 2, physicality: 4 },
    photoUrl: portrait('women', 55),
  },
  {
    name: 'Kwame Mensah',
    nickname: 'Metronome',
    position: 'MID',
    stats: { pace: 3, shooting: 3, passing: 5, dribbling: 4, defending: 2, physicality: 3 },
    taunt: "Give me the ball, I'll give you the game.",
    photoUrl: portrait('men', 90),
  },
  {
    name: 'Ines Duarte',
    nickname: 'Vision',
    position: 'MID',
    stats: { pace: 4, shooting: 3, passing: 4, dribbling: 3, defending: 3, physicality: 4 },
    taunt: 'I see the pass before you do.',
    photoUrl: portrait('women', 82),
  },
  {
    name: 'Elena Popescu',
    nickname: 'Sniper',
    position: 'ATT',
    stats: { pace: 4, shooting: 5, passing: 3, dribbling: 4, defending: 1, physicality: 3 },
    taunt: 'One touch, one goal.',
    photoUrl: portrait('women', 3),
  },
  {
    name: 'Tariq Hassan',
    position: 'ATT',
    stats: { pace: 5, shooting: 4, passing: 2, dribbling: 4, defending: 1, physicality: 3 },
    photoUrl: portrait('men', 61),
  },
  {
    name: 'Bianca Rossi',
    nickname: 'Hollywood',
    position: 'ATT',
    stats: { pace: 3, shooting: 5, passing: 4, dribbling: 5, defending: 1, physicality: 2 },
    taunt: "Save it for the highlight reel — that's where I live.",
    photoUrl: portrait('women', 67),
  },
];

/** A ready-made 14-player roster so the app is explorable with an empty setup tab. */
export function demoRoster(): Player[] {
  const now = Date.now();
  return DEMO_DEFS.map((def, i) => ({
    id: crypto.randomUUID(),
    name: def.name,
    nickname: def.nickname,
    position: def.position,
    stats: def.stats,
    taunt: def.taunt,
    photoUrl: def.photoUrl,
    createdAt: now - (DEMO_DEFS.length - i) * 1000,
  }));
}
