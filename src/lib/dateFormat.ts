const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** e.g. 1755255720000 -> "Aug 12, 2026" (local time, no clock) — for scannable lists like the Evolution tab's match log and audit log, where a precise timestamp matters less than a quick date scan. */
export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** e.g. 1755255720000 -> "17/08" (local time, DD/MM, no year/clock) — compact enough to sit under every point on the (scrollable) trajectory chart without adjacent labels touching; formatShortDate's "Aug 17, 2026" is too wide for that. */
export function formatAxisDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}
