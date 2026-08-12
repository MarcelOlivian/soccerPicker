import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { Player } from '../src/types';

// fake-indexeddb's structured-clone implementation doesn't preserve Blob
// instances on read-back (a known limitation of that package, not of real
// browser IndexedDB), so getImageBlob is mocked here to hand back a real
// Blob directly. putImage/deleteImage are real — fake-indexeddb handles
// writes fine, it's only the Blob round-trip on read that's lossy.
const stubBlob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' });
vi.mock('../src/lib/imageStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/imageStore')>();
  return { ...actual, getImageBlob: vi.fn().mockResolvedValue(stubBlob) };
});

const { buildExportFile, exportFileName, parseRosterImportFile } = await import('../src/lib/exportImport');
const { putImage } = await import('../src/lib/imageStore');

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    position: 'ATT',
    stats: { pace: 4, stamina: 3, finishing: 5, defending: 1, passing: 3, goalkeeping: 1 },
    createdAt: 1700000000000,
    ...overrides,
  };
}

describe('exportImport', () => {
  it('exportFileName includes an ISO date and the app prefix', () => {
    const name = exportFileName(new Date('2026-03-05T12:00:00Z'));
    expect(name).toBe('soccerpicker-roster-2026-03-05.json');
  });

  it('buildExportFile passes through URL-photo players unchanged', async () => {
    const players = [makePlayer('p1', { photoUrl: 'https://example.com/a.jpg' })];
    const file = await buildExportFile(players);
    expect(file.players[0].photoUrl).toBe('https://example.com/a.jpg');
    expect(file.players[0]).not.toHaveProperty('photoKey');
    expect(file.players[0]).not.toHaveProperty('photoDataUrl');
  });

  it('buildExportFile inlines an uploaded photo as a data URL', async () => {
    const key = await putImage(stubBlob);
    const players = [makePlayer('p1', { photoKey: key })];
    const file = await buildExportFile(players);
    expect(file.players[0].photoDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(file.players[0]).not.toHaveProperty('photoKey');
  });

  it('round-trips a roster through export and import, rehydrating the photo into a new IndexedDB key', async () => {
    const key = await putImage(stubBlob);
    const players = [
      makePlayer('p1', { photoKey: key }),
      makePlayer('p2', { photoUrl: 'https://example.com/b.jpg', nickname: 'Tank' }),
    ];
    const file = await buildExportFile(players);
    const imported = await parseRosterImportFile(JSON.stringify(file));

    expect(imported).toHaveLength(2);
    expect(imported[0].photoKey).toBeTruthy();
    expect(imported[0].photoKey).not.toBe(key); // a fresh key, not reusing the original
    expect(imported[1].photoUrl).toBe('https://example.com/b.jpg');
    expect(imported[1].nickname).toBe('Tank');
  });

  it('parseRosterImportFile rejects a file that is not a roster export', async () => {
    await expect(parseRosterImportFile(JSON.stringify({ hello: 'world' }))).rejects.toThrow();
  });
});
