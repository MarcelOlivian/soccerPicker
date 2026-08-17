import type { Player } from '../types';
import { emptyStats } from '../types';

/**
 * Compresses the roster (minus any uploaded photo blobs, which would make
 * the URL unwieldy) into a URL fragment so a friend can open a link and
 * instantly have your player database on their device — no server, no
 * account. Independent of live sync; this is the fallback path when going
 * live isn't available, and useful on its own besides.
 */

type ShareablePlayer = Omit<Player, 'photoKey'>;

interface ShareFilePayload {
  schemaVersion: 1;
  players: ShareablePlayer[];
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  // Cast: TS's DOM lib types the stream writer as wanting a plain-ArrayBuffer-
  // backed view, while Uint8Array is typed generically over ArrayBufferLike
  // (which also covers SharedArrayBuffer). These bytes always come from
  // TextEncoder/atob, never a SharedArrayBuffer, so this is safe at runtime.
  writer.write(bytes as Uint8Array<ArrayBuffer>);
  writer.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes as Uint8Array<ArrayBuffer>);
  writer.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

export interface ShareLinkResult {
  url: string;
  skippedPhotoCount: number;
}

/** Builds a shareable URL for the given base (defaults to the current page). Uploaded photos are dropped, URL photos kept. */
export async function buildShareLink(players: Player[], base = `${location.origin}${location.pathname}`): Promise<ShareLinkResult> {
  const skippedPhotoCount = players.filter((p) => p.photoKey).length;
  const shareable: ShareablePlayer[] = players.map(({ photoKey: _photoKey, ...rest }) => rest);
  const payload: ShareFilePayload = { schemaVersion: 1, players: shareable };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));

  let encoded: string;
  if (typeof CompressionStream !== 'undefined') {
    encoded = `d${bytesToBase64Url(await compress(bytes))}`;
  } else {
    // Older Safari without CompressionStream: fall back to plain base64, still functional, just a longer URL.
    encoded = `r${bytesToBase64Url(bytes)}`;
  }

  return { url: `${base}#roster=${encoded}`, skippedPhotoCount };
}

/** Parses a `#roster=...` fragment (as produced by buildShareLink) back into players, or null if not present/invalid. */
export async function parseShareLink(hash: string): Promise<Player[] | null> {
  const match = /#roster=([^&]+)/.exec(hash);
  if (!match) return null;

  try {
    const raw = match[1];
    const mode = raw[0];
    const bytes = base64UrlToBytes(raw.slice(1));
    let jsonBytes: Uint8Array;
    if (mode === 'd') {
      if (typeof DecompressionStream === 'undefined') return null;
      jsonBytes = await decompress(bytes);
    } else {
      jsonBytes = bytes;
    }
    const parsed = JSON.parse(new TextDecoder().decode(jsonBytes)) as Partial<ShareFilePayload>;
    if (!parsed || !Array.isArray(parsed.players)) return null;

    return parsed.players.map((p) => ({
      id: p.id ?? crypto.randomUUID(),
      name: p.name ?? 'Unknown',
      nickname: p.nickname,
      position: p.position ?? 'MID',
      stats: p.stats ?? emptyStats(),
      photoUrl: p.photoUrl,
      taunt: p.taunt,
      statsVerifiedBy: p.statsVerifiedBy,
      statsVerifiedAt: p.statsVerifiedAt,
      statHistory: p.statHistory,
      createdAt: p.createdAt ?? Date.now(),
    }));
  } catch {
    return null;
  }
}
