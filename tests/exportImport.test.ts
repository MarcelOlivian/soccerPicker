import { describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import type { MatchHistoryEntry, Player } from '../src/types';

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
    stats: { pace: 4, shooting: 5, passing: 3, dribbling: 3, defending: 1, physicality: 3 },
    createdAt: 1700000000000,
    ...overrides,
  };
}

function makeHistoryEntry(id: string): MatchHistoryEntry {
  return {
    id,
    date: 1700000000000,
    formation: '6',
    teamAName: 'Marcus',
    teamBName: 'Sofia',
    teamAPlayers: [],
    teamBPlayers: [],
    strengthA: 100,
    strengthB: 95,
  };
}

describe('exportImport', () => {
  it('exportFileName includes an ISO date and the app prefix', () => {
    const name = exportFileName(new Date('2026-03-05T12:00:00Z'));
    expect(name).toBe('squadref-roster-2026-03-05.json');
  });

  it('buildExportFile passes through URL-photo players unchanged', async () => {
    const players = [makePlayer('p1', { photoUrl: 'https://example.com/a.jpg' })];
    const file = await buildExportFile(players, []);
    expect(file.players[0].photoUrl).toBe('https://example.com/a.jpg');
    expect(file.players[0]).not.toHaveProperty('photoKey');
    expect(file.players[0]).not.toHaveProperty('photoDataUrl');
  });

  it('buildExportFile inlines an uploaded photo as a data URL', async () => {
    const key = await putImage(stubBlob);
    const players = [makePlayer('p1', { photoKey: key })];
    const file = await buildExportFile(players, []);
    expect(file.players[0].photoDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(file.players[0]).not.toHaveProperty('photoKey');
  });

  it('round-trips a roster through export and import, rehydrating the photo into a new IndexedDB key', async () => {
    const key = await putImage(stubBlob);
    const statHistory = [{ at: 1000, stats: makePlayer('p1').stats, source: 'manual' as const }];
    const players = [
      makePlayer('p1', { photoKey: key, taunt: 'Nothing gets past me.', statHistory }),
      makePlayer('p2', { photoUrl: 'https://example.com/b.jpg', nickname: 'Tank' }),
    ];
    const file = await buildExportFile(players, []);
    const imported = await parseRosterImportFile(JSON.stringify(file));

    expect(imported.players).toHaveLength(2);
    expect(imported.players[0].photoKey).toBeTruthy();
    expect(imported.players[0].photoKey).not.toBe(key); // a fresh key, not reusing the original
    expect(imported.players[0].taunt).toBe('Nothing gets past me.');
    expect(imported.players[0].statHistory).toEqual(statHistory);
    expect(imported.players[1].photoUrl).toBe('https://example.com/b.jpg');
    expect(imported.players[1].nickname).toBe('Tank');
    expect(imported.players[1].taunt).toBeUndefined();
    expect(imported.players[1].statHistory).toBeUndefined();
  });

  it('round-trips match history unchanged through export and import', async () => {
    const history = [makeHistoryEntry('h1'), makeHistoryEntry('h2')];
    const file = await buildExportFile([makePlayer('p1')], history);
    const imported = await parseRosterImportFile(JSON.stringify(file));

    expect(imported.history).toEqual(history);
  });

  it('parseRosterImportFile rejects a file that is not a roster export', async () => {
    await expect(parseRosterImportFile(JSON.stringify({ hello: 'world' }))).rejects.toThrow();
  });

  it('rejects a file with a valid history but missing/invalid players', async () => {
    await expect(
      parseRosterImportFile(JSON.stringify({ schemaVersion: 2, history: [makeHistoryEntry('h1')] })),
    ).rejects.toThrow();
  });

  it('an old schemaVersion:1 export (no history key at all) imports with an empty history array', async () => {
    const v1File = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      players: [{ ...makePlayer('p1') }],
    };
    const imported = await parseRosterImportFile(JSON.stringify(v1File));
    expect(imported.history).toEqual([]);
    expect(imported.players).toHaveLength(1);
  });

  it('a malformed history field (not an array) falls back to an empty history array', async () => {
    const file = await buildExportFile([makePlayer('p1')], []);
    const malformed = { ...file, history: 'oops' };
    const imported = await parseRosterImportFile(JSON.stringify(malformed));
    expect(imported.history).toEqual([]);
  });
});
