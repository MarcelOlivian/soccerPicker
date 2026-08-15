import { emptyClock } from '../types';
import type { MatchClock } from '../types';

export { emptyClock };

export function isClockRunning(clock: MatchClock): boolean {
  return clock.startedAt !== null && clock.pausedAt === null;
}

/** Elapsed match time in ms, frozen while paused. */
export function computeElapsedMs(clock: MatchClock, now: number = Date.now()): number {
  if (clock.startedAt === null) return 0;
  const end = clock.pausedAt ?? now;
  return Math.max(0, end - clock.startedAt - clock.pausedMs);
}

/** e.g. 125000 -> "02:05" */
export function formatClock(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
