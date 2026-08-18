import { describe, expect, it } from 'vitest';
import { formatMatchStartedAt } from '../src/lib/dateFormat';

describe('formatMatchStartedAt', () => {
  it('formats as HH:MM DD.MM.YYYY, zero-padded', () => {
    const ts = new Date(2026, 7, 18, 14, 32).getTime(); // 18 Aug 2026, 14:32
    expect(formatMatchStartedAt(ts)).toBe('14:32 18.08.2026');
  });

  it('zero-pads single-digit hour, minute, day, and month', () => {
    const ts = new Date(2026, 0, 5, 9, 3).getTime(); // 5 Jan 2026, 09:03
    expect(formatMatchStartedAt(ts)).toBe('09:03 05.01.2026');
  });
});
