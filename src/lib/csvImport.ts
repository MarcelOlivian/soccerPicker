import { POSITIONS, STAT_KEYS } from '../types';
import type { Player, PlayerStats, Position, StatKey, StatValue } from '../types';

/**
 * Import for the group's WhatsApp-organized pickup-soccer stats sheet,
 * exported from Google Sheets as CSV. Distinct from exportImport.ts's JSON
 * roster+history export — this is a one-way, stats-only intake: no photos,
 * no match history, and no id/verification state carried over (those are
 * established afterward through the app's existing mechanisms). "OVR" is
 * never stored — it's always computed live by lib/rating.ts — and
 * "Observations" is dropped entirely by design; neither has a home on
 * Player.
 */

// Mirrors PlayerForm.tsx's taunt textarea maxLength (kept local rather than
// exported from a component file — lib/ shouldn't depend on src/features).
const TAUNT_MAX_LENGTH = 140;

/** Canonical (lowercase) CSV column name for each stat. */
const STAT_COLUMNS: Record<StatKey, string> = {
  pace: 'pac',
  shooting: 'sho',
  passing: 'pas',
  dribbling: 'dri',
  defending: 'def',
  physicality: 'phy',
};

/**
 * The header row this importer expects, spelled out for the UI hint and
 * for the error thrown when a file doesn't match. Comma-space separated
 * (rather than the bare comma-separated literal header) so it wraps
 * naturally inside a narrow hint panel.
 */
export const EXPECTED_CSV_HEADER =
  'Name, Nickname, Preferred Position, Tagline, PAC, SHO, PAS, DRI, DEF, PHY, OVR, Observations';

/**
 * Hand-rolled RFC4180-ish CSV parser: quoted fields, embedded commas,
 * embedded newlines inside quoted fields, a doubled `""` decoding to a
 * literal `"`, and both `\r\n` and `\n` line endings. A leading UTF-8 BOM
 * (common on Excel/Sheets exports) is stripped first. A line that decodes
 * to a single empty field — an empty line, including the one implied by a
 * trailing newline at end of file — is dropped, so it never produces a
 * spurious empty row.
 */
export function parseCsvRows(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = input.length;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < len) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ',') {
      pushField();
      i += 1;
    } else if (ch === '\r') {
      pushRow();
      i += input[i + 1] === '\n' ? 2 : 1;
    } else if (ch === '\n') {
      pushRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  // Final row, for a file that doesn't end with a line break.
  if (field !== '' || row.length > 0) pushRow();

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function isPosition(value: string): value is Position {
  return POSITIONS.some((p) => p === value);
}

function clampStat(n: number): StatValue {
  return Math.min(5, Math.max(1, n)) as StatValue;
}

/**
 * Blank/unparseable -> 3 (neutral default). A present-but-out-of-range
 * number (e.g. "9" or "0") clamps into 1-5 rather than being treated as
 * missing — only a genuinely empty/unparseable cell gets the default.
 */
function parseStatCell(raw: string): StatValue {
  const trimmed = raw.trim();
  if (trimmed === '') return 3;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 3;
  return clampStat(Math.round(n));
}

function cellAt(row: string[], idx: number): string {
  return idx >= 0 ? (row[idx] ?? '') : '';
}

export interface CsvImportRow {
  /** Stable React key for one row within a single import session — not a Player id. */
  key: string;
  name: string;
  nickname?: string;
  position: Position;
  stats: PlayerStats;
  taunt?: string;
  /** The current roster player this row matches by name (case-insensitive, trimmed) — undefined for a new player. */
  existingPlayer?: Player;
}

/**
 * Parses the group's stats-sheet CSV export into review rows, matched
 * against `existingPlayers` by name (case-insensitive, trimmed — the same
 * normalization MERGE_PLAYERS already uses), so an already-rostered player
 * can be updated in place instead of duplicated. Columns are matched by
 * header name, not position, so a reordered header still works, and an
 * individually renamed/missing column just makes that one field default
 * instead of invalidating the whole file. Throws only for structural
 * problems — an empty/unparseable file, or no "Name" column in the header;
 * a bad value in a single cell never throws, it falls back to a default.
 */
export function parseCsvImportRows(csvText: string, existingPlayers: Player[]): CsvImportRow[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    throw new Error(`That file doesn't look like a SquadRef stats CSV. Expected header: ${EXPECTED_CSV_HEADER}`);
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  if (nameIdx === -1) {
    throw new Error(`That CSV is missing a "Name" column. Expected header: ${EXPECTED_CSV_HEADER}`);
  }
  const nicknameIdx = header.indexOf('nickname');
  const positionIdx = header.indexOf('preferred position');
  const taglineIdx = header.indexOf('tagline');
  // "ovr" and "observations" are intentionally never looked up: OVR is
  // always computed live (lib/rating.ts), and Observations is dropped by
  // design — neither is stored on Player.
  const statIdx = {} as Record<StatKey, number>;
  for (const key of STAT_KEYS) statIdx[key] = header.indexOf(STAT_COLUMNS[key]);

  const byName = new Map(existingPlayers.map((p) => [p.name.trim().toLowerCase(), p]));

  const importRows: CsvImportRow[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim() === '')) continue; // fully blank data row

    const name = cellAt(row, nameIdx).trim();
    const nickname = cellAt(row, nicknameIdx).trim() || undefined;
    const positionRaw = cellAt(row, positionIdx).trim().toUpperCase();
    const position: Position = isPosition(positionRaw) ? positionRaw : 'MID';
    const taunt = cellAt(row, taglineIdx).trim().slice(0, TAUNT_MAX_LENGTH) || undefined;

    const stats = {} as PlayerStats;
    for (const key of STAT_KEYS) stats[key] = parseStatCell(cellAt(row, statIdx[key]));

    importRows.push({
      key: crypto.randomUUID(),
      name,
      nickname,
      position,
      stats,
      taunt,
      existingPlayer: byName.get(name.trim().toLowerCase()),
    });
  }

  return importRows;
}

/**
 * Builds the Player to dispatch for one accepted review row. A matched row
 * preserves everything the CSV doesn't carry (id, createdAt, photoUrl,
 * photoKey, statsVerifiedBy, statsVerifiedAt, statHistory) and overwrites
 * only the fields the sheet actually supplies. A new row builds a fresh
 * Player exactly like the old CSV import always did.
 */
export function buildPlayerFromCsvRow(row: CsvImportRow): Player {
  if (row.existingPlayer) {
    return {
      ...row.existingPlayer,
      name: row.name,
      nickname: row.nickname,
      position: row.position,
      stats: row.stats,
      taunt: row.taunt,
    };
  }
  return {
    id: crypto.randomUUID(),
    name: row.name,
    nickname: row.nickname,
    position: row.position,
    stats: row.stats,
    taunt: row.taunt,
    createdAt: Date.now(),
  };
}
