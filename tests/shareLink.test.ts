import { describe, expect, it } from 'vitest';
import { buildShareLink, parseShareLink } from '../src/lib/shareLink';
import type { Player } from '../src/types';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    position: 'MID',
    stats: { pace: 3, shooting: 2, passing: 5, dribbling: 3, defending: 3, physicality: 4 },
    createdAt: 1700000000000,
    ...overrides,
  };
}

describe('shareLink', () => {
  it('round-trips a roster through build and parse', async () => {
    const players = [
      makePlayer('p1', { taunt: 'One touch, one goal.' }),
      makePlayer('p2', { nickname: 'Sniper', photoUrl: 'https://example.com/a.jpg' }),
    ];
    const { url, skippedPhotoCount } = await buildShareLink(players, 'https://app.example/');
    expect(skippedPhotoCount).toBe(0);
    expect(url).toContain('#roster=');

    const hash = url.slice(url.indexOf('#'));
    const parsed = await parseShareLink(hash);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(2);
    expect(parsed?.[0].name).toBe('Player p1');
    expect(parsed?.[0].taunt).toBe('One touch, one goal.');
    expect(parsed?.[1].nickname).toBe('Sniper');
    expect(parsed?.[1].photoUrl).toBe('https://example.com/a.jpg');
    expect(parsed?.[1].taunt).toBeUndefined();
  });

  it('counts uploaded photos as skipped and drops photoKey from the link', async () => {
    const players = [makePlayer('p1', { photoKey: 'some-indexeddb-key' })];
    const { url, skippedPhotoCount } = await buildShareLink(players, 'https://app.example/');
    expect(skippedPhotoCount).toBe(1);

    const hash = url.slice(url.indexOf('#'));
    const parsed = await parseShareLink(hash);
    expect(parsed?.[0]).not.toHaveProperty('photoKey');
  });

  it('produces a URL-safe fragment with no raw base64 padding or slashes issues', async () => {
    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3')];
    const { url } = await buildShareLink(players, 'https://app.example/');
    const fragment = url.slice(url.indexOf('#roster=') + '#roster='.length);
    expect(fragment).not.toMatch(/[+/=]/);
  });

  it('parseShareLink returns null when there is no #roster= fragment', async () => {
    expect(await parseShareLink('')).toBeNull();
    expect(await parseShareLink('#somethingElse=1')).toBeNull();
  });

  it('parseShareLink returns null for a corrupt fragment instead of throwing', async () => {
    await expect(parseShareLink('#roster=dNOT-VALID-BASE64!!!')).resolves.toBeNull();
  });

  it('generates a shorter fragment for a larger roster than an uncompressed baseline would need', async () => {
    // Not a strict assertion on exact size (compression ratio varies), just
    // a sanity check that compression is actually engaged (the 'd' prefix)
    // rather than silently falling back to raw encoding.
    const players = Array.from({ length: 20 }, (_, i) => makePlayer(`p${i}`));
    const { url } = await buildShareLink(players, 'https://app.example/');
    const fragment = url.slice(url.indexOf('#roster=') + '#roster='.length);
    expect(fragment[0]).toBe('d');
  });
});
