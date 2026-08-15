import { describe, expect, it } from 'vitest';
import { formatStatsVerifiedAt, isStatsVerified } from '../src/lib/statsVerified';

describe('isStatsVerified', () => {
  it('is false when statsVerifiedBy is undefined', () => {
    expect(isStatsVerified({ statsVerifiedBy: undefined })).toBe(false);
  });

  it('is false when statsVerifiedBy is an empty array', () => {
    expect(isStatsVerified({ statsVerifiedBy: [] })).toBe(false);
  });

  it('is true when statsVerifiedBy has at least one name', () => {
    expect(isStatsVerified({ statsVerifiedBy: ['Alex'] })).toBe(true);
  });
});

describe('formatStatsVerifiedAt', () => {
  it('zero-pads single-digit day, month, hour, and minute', () => {
    // Local-time constructor, compared against the same local values, so
    // this doesn't depend on the test runner's timezone.
    const d = new Date(2026, 0, 5, 9, 3); // 5 Jan 2026, 09:03
    expect(formatStatsVerifiedAt(d.getTime())).toBe('05/01/2026 @ 09:03');
  });

  it('does not pad double-digit values', () => {
    const d = new Date(2026, 7, 15, 11, 2); // 15 Aug 2026, 11:02
    expect(formatStatsVerifiedAt(d.getTime())).toBe('15/08/2026 @ 11:02');
  });

  it('pads midnight correctly', () => {
    const d = new Date(2026, 11, 31, 0, 0); // 31 Dec 2026, 00:00
    expect(formatStatsVerifiedAt(d.getTime())).toBe('31/12/2026 @ 00:00');
  });
});
