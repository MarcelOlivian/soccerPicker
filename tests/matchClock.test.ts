import { describe, expect, it } from 'vitest';
import { computeElapsedMs, emptyClock, formatClock, isClockRunning } from '../src/lib/matchClock';

describe('emptyClock / isClockRunning', () => {
  it('a fresh clock is not running', () => {
    expect(isClockRunning(emptyClock())).toBe(false);
  });

  it('a started, unpaused clock is running', () => {
    expect(isClockRunning({ startedAt: 1000, pausedAt: null, pausedMs: 0 })).toBe(true);
  });

  it('a paused clock is not running', () => {
    expect(isClockRunning({ startedAt: 1000, pausedAt: 2000, pausedMs: 0 })).toBe(false);
  });
});

describe('computeElapsedMs', () => {
  it('never started -> 0', () => {
    expect(computeElapsedMs(emptyClock(), 5000)).toBe(0);
  });

  it('running accumulates with now', () => {
    const clock = { startedAt: 1000, pausedAt: null, pausedMs: 0 };
    expect(computeElapsedMs(clock, 4000)).toBe(3000);
  });

  it('paused freezes regardless of now', () => {
    const clock = { startedAt: 1000, pausedAt: 3000, pausedMs: 0 };
    expect(computeElapsedMs(clock, 10000)).toBe(2000);
    expect(computeElapsedMs(clock, 99999)).toBe(2000);
  });

  it('a start -> pause -> resume -> pause sequence accumulates pausedMs correctly', () => {
    // Started at 0, paused at 1000 (1s elapsed), resumed at 3000 (2s dead time
    // recorded as pausedMs), paused again at 5000 (2s more elapsed since resume).
    const resumed = { startedAt: 0, pausedAt: null, pausedMs: 3000 - 1000 };
    expect(computeElapsedMs(resumed, 5000)).toBe(3000); // 5000 - 0 - 2000
    const pausedAgain = { ...resumed, pausedAt: 5000 };
    expect(computeElapsedMs(pausedAgain, 99999)).toBe(3000);
  });
});

describe('formatClock', () => {
  it('formats sub-minute durations', () => {
    expect(formatClock(5000)).toBe('00:05');
  });

  it('formats minutes and seconds, zero-padded', () => {
    expect(formatClock(125000)).toBe('02:05');
  });

  it('floors partial seconds', () => {
    expect(formatClock(1999)).toBe('00:01');
  });
});
