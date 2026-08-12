import type { Player } from '../types';
import { blobToDataUrl, getImageBlob, putImage } from './imageStore';

/**
 * JSON export/import with uploaded photos inlined as base64, so the file is
 * fully self-contained and shareable (e.g. by email) without depending on
 * this device's IndexedDB. This is the lossless path; the roster handoff
 * link (shareLink.ts) is the lighter, lossy-on-photos alternative.
 */

interface ExportedPlayer extends Omit<Player, 'photoKey'> {
  photoDataUrl?: string;
}

interface ExportFile {
  schemaVersion: 1;
  exportedAt: string;
  players: ExportedPlayer[];
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = /data:(.*);base64/.exec(header)?.[1] ?? 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function buildExportFile(players: Player[]): Promise<ExportFile> {
  const exported: ExportedPlayer[] = [];
  for (const player of players) {
    const { photoKey, ...rest } = player;
    if (photoKey) {
      const blob = await getImageBlob(photoKey);
      exported.push({ ...rest, photoDataUrl: blob ? await blobToDataUrl(blob) : undefined });
    } else {
      exported.push(rest);
    }
  }
  return { schemaVersion: 1, exportedAt: new Date().toISOString(), players: exported };
}

export function exportFileName(date = new Date()): string {
  return `soccerpicker-roster-${date.toISOString().slice(0, 10)}.json`;
}

/** Triggers a browser download of the full roster, including inlined photos. */
export async function downloadRosterExport(players: Player[]): Promise<void> {
  const file = await buildExportFile(players);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ImportMode = 'merge' | 'replace';

/** Parses an exported roster JSON string, rehydrating any inlined photos back into IndexedDB. */
export async function parseRosterImportFile(jsonText: string): Promise<Player[]> {
  const parsed = JSON.parse(jsonText) as Partial<ExportFile>;
  if (!parsed || !Array.isArray(parsed.players)) {
    throw new Error('This file does not look like a soccerPicker roster export.');
  }

  const players: Player[] = [];
  for (const p of parsed.players) {
    const { photoDataUrl, ...rest } = p;
    let photoKey: string | undefined;
    if (photoDataUrl) {
      try {
        photoKey = await putImage(dataUrlToBlob(photoDataUrl));
      } catch {
        photoKey = undefined;
      }
    }
    players.push({
      id: rest.id ?? crypto.randomUUID(),
      name: rest.name ?? 'Unknown',
      nickname: rest.nickname,
      position: rest.position ?? 'MID',
      stats: rest.stats,
      photoUrl: rest.photoUrl,
      photoKey,
      createdAt: rest.createdAt ?? Date.now(),
    });
  }
  return players;
}
