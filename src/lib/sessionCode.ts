// No 0/O or 1/I — easy to read aloud, and unambiguous on a screenshot or a QR fallback string.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A short, human-readable session code — also used directly as the PeerJS
 * peer id, so it doubles as a namespace. Live draft sessions and stats-vote
 * sessions use different prefixes (SOCCER- / VOTE-) so the two features can
 * never collide in that shared id space, even though both go through the
 * same broker.
 */
export function generateSessionCode(prefix: string): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return `${prefix}-${code}`;
}
