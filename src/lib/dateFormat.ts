const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** e.g. 1755255720000 -> "Aug 12, 2026" (local time, no clock) — for scannable lists like the Evolution tab's match log and audit log, where a precise timestamp matters less than a quick date scan. */
export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
