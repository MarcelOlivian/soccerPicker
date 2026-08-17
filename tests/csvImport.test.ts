import { describe, expect, it } from 'vitest';
import { parseCsvRows, parsePlayerCsv } from '../src/lib/csvImport';

describe('parseCsvRows', () => {
  it('parses a simple 2-column/2-row CSV', () => {
    expect(parseCsvRows('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles a quoted field containing a comma', () => {
    expect(parseCsvRows('a,"b,c"\nd,e')).toEqual([
      ['a', 'b,c'],
      ['d', 'e'],
    ]);
  });

  it('handles a quoted field containing an embedded newline', () => {
    expect(parseCsvRows('a,"line one\nline two"\nc,d')).toEqual([
      ['a', 'line one\nline two'],
      ['c', 'd'],
    ]);
  });

  it('decodes a doubled "" inside a quoted field to a literal "', () => {
    expect(parseCsvRows('a,"she said ""hi"""')).toEqual([['a', 'she said "hi"']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsvRows('a,b\r\nc,d\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('drops a trailing blank line without producing a spurious empty row', () => {
    expect(parseCsvRows('a,b\nc,d\n\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseCsvRows('')).toEqual([]);
  });

  it('parses a quoted field at the very start and end of the file with no surrounding rows', () => {
    expect(parseCsvRows('"only field"')).toEqual([['only field']]);
  });

  it('strips a leading UTF-8 BOM before parsing', () => {
    expect(parseCsvRows('﻿a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

const SAMPLE_CSV = `Name,Nickname,Preferred Position,Tagline,PAC,SHO,PAS,DRI,DEF,PHY,OVR,Observations
Maradona,Hand of God,ATT,El pelota no se mancha,5,5,5,5,3,4,87,"Niste exemple de stats. Stats preluate de aici: https://fifaindex.com/players/190042-diego-armando-maradona/fc26
Cum noi avem doat 5 levels pentru simplificare, daca maradona are de ex peste 80 orice state e full 5/5. La defending avand 44, este 3/5
Practic 0-20 = 1/5, 21-40 = 2/5, 41-60 = 3/5, 61-80 = 4/5, 81 - 100 = 5/5
"
Haaland,Terminator,ATT,There Will Be Goals,4,5,4,4,3,5,79,Baseline-ul de scor va fi grupul nostru. Jucatorii de aici sunt doar exemplu de completare
Neves,Motorzinho,MID,I gave my life for Benfica,4,4,5,5,5,5,91,"Se poate observa ca unii jucatori mai putin vedeta totusi au scor mai mare din cauza ca e un calcul simplificat: average de valori 1-5 care se mapeaza pe interval 1-100 la OVR. Pentru noi o sa fie suficient sa fie mai simplu asa (cam greu sa votezi ""ah, Doru are skill de shutat 67 din 100)."
Andrei,REF,MID,Cine citeste pl beleste,5,2,4,3,4,5,71,
Cioara,CR,MID,Forza Juve,4,4,5,5,2,5,79,
Antoniu,Toni,ATT,-,4,4,4,4,3,5,75,
`;

describe('parsePlayerCsv', () => {
  it('parses all 6 players from the real sample sheet, with OVR/Observations dropped', () => {
    const players = parsePlayerCsv(SAMPLE_CSV);
    expect(players).toHaveLength(6);
    expect(players.map((p) => p.name)).toEqual(['Maradona', 'Haaland', 'Neves', 'Andrei', 'Cioara', 'Antoniu']);
    for (const p of players) {
      expect(p).not.toHaveProperty('ovr');
      expect(p).not.toHaveProperty('observations');
      expect(p.photoUrl).toBeUndefined();
      expect(p.photoKey).toBeUndefined();
    }
  });

  it('parses the multi-line-Observations Maradona row correctly on every other column', () => {
    const [maradona] = parsePlayerCsv(SAMPLE_CSV);
    expect(maradona.nickname).toBe('Hand of God');
    expect(maradona.position).toBe('ATT');
    expect(maradona.taunt).toBe('El pelota no se mancha');
    expect(maradona.stats).toEqual({ pace: 5, shooting: 5, passing: 5, dribbling: 5, defending: 3, physicality: 4 });
  });

  it('parses the escaped-quote Neves row correctly on every other column', () => {
    const players = parsePlayerCsv(SAMPLE_CSV);
    const neves = players.find((p) => p.name === 'Neves')!;
    expect(neves.nickname).toBe('Motorzinho');
    expect(neves.position).toBe('MID');
    expect(neves.taunt).toBe('I gave my life for Benfica');
    expect(neves.stats).toEqual({ pace: 4, shooting: 4, passing: 5, dribbling: 5, defending: 5, physicality: 5 });
  });

  it('parses the remaining rows (Haaland, Andrei, Cioara, Antoniu) correctly', () => {
    const players = parsePlayerCsv(SAMPLE_CSV);
    const byName = new Map(players.map((p) => [p.name, p]));

    expect(byName.get('Haaland')).toMatchObject({
      nickname: 'Terminator',
      position: 'ATT',
      taunt: 'There Will Be Goals',
      stats: { pace: 4, shooting: 5, passing: 4, dribbling: 4, defending: 3, physicality: 5 },
    });
    expect(byName.get('Andrei')).toMatchObject({
      nickname: 'REF',
      position: 'MID',
      taunt: 'Cine citeste pl beleste',
      stats: { pace: 5, shooting: 2, passing: 4, dribbling: 3, defending: 4, physicality: 5 },
    });
    expect(byName.get('Cioara')).toMatchObject({
      nickname: 'CR',
      position: 'MID',
      taunt: 'Forza Juve',
      stats: { pace: 4, shooting: 4, passing: 5, dribbling: 5, defending: 2, physicality: 5 },
    });
    expect(byName.get('Antoniu')).toMatchObject({
      nickname: 'Toni',
      position: 'ATT',
      taunt: '-',
      stats: { pace: 4, shooting: 4, passing: 4, dribbling: 4, defending: 3, physicality: 5 },
    });
  });

  it('throws when the "Name" column is missing entirely', () => {
    expect(() => parsePlayerCsv('Nickname,Preferred Position\nBob,MID')).toThrow(/Name/);
  });

  it('throws on a fully empty file', () => {
    expect(() => parsePlayerCsv('')).toThrow();
  });

  it('throws on garbage content with no recognizable header', () => {
    expect(() => parsePlayerCsv('just some random text\nwith no name column at all')).toThrow();
  });

  it('defaults a blank stat cell to 3', () => {
    const csv = 'Name,PAC,SHO,PAS,DRI,DEF,PHY\nBob,,4,4,4,4,4';
    const [bob] = parsePlayerCsv(csv);
    expect(bob.stats.pace).toBe(3);
  });

  it('clamps an out-of-range stat (e.g. "9") to 5 rather than defaulting it', () => {
    const csv = 'Name,PAC,SHO,PAS,DRI,DEF,PHY\nBob,9,4,4,4,4,4';
    const [bob] = parsePlayerCsv(csv);
    expect(bob.stats.pace).toBe(5);
  });

  it('clamps a negative/zero stat to 1', () => {
    const csv = 'Name,PAC,SHO,PAS,DRI,DEF,PHY\nBob,0,4,4,4,4,4';
    const [bob] = parsePlayerCsv(csv);
    expect(bob.stats.pace).toBe(1);
  });

  it('defaults an unrecognized position string to MID', () => {
    const csv = 'Name,Preferred Position\nBob,STRIKER';
    const [bob] = parsePlayerCsv(csv);
    expect(bob.position).toBe('MID');
  });

  it('does not produce a ghost player from a trailing blank line', () => {
    const csv = 'Name,PAC\nBob,4\n\n\n';
    expect(parsePlayerCsv(csv)).toHaveLength(1);
  });

  it('skips a data row that is entirely blank', () => {
    const csv = 'Name,PAC\nBob,4\n,\nAlice,3';
    const players = parsePlayerCsv(csv);
    expect(players.map((p) => p.name)).toEqual(['Bob', 'Alice']);
  });

  it('still creates a player when only the Name cell is blank but other cells have values', () => {
    const csv = 'Name,PAC\n,4';
    const players = parsePlayerCsv(csv);
    expect(players).toHaveLength(1);
    expect(players[0].name).toBe('');
    expect(players[0].stats.pace).toBe(4);
  });

  it('works with a reordered header, since column lookup is by name', () => {
    const csv = 'PAC,Name,Preferred Position\n5,Bob,DEF';
    const [bob] = parsePlayerCsv(csv);
    expect(bob.name).toBe('Bob');
    expect(bob.position).toBe('DEF');
    expect(bob.stats.pace).toBe(5);
  });

  it('is case-insensitive and trims whitespace on header column names', () => {
    const csv = ' name , PAC \nBob,4';
    const [bob] = parsePlayerCsv(csv);
    expect(bob.name).toBe('Bob');
    expect(bob.stats.pace).toBe(4);
  });

  it('leaves nickname and taunt undefined (not empty string) when blank', () => {
    const csv = 'Name,Nickname,Tagline\nBob,,';
    const [bob] = parsePlayerCsv(csv);
    expect(bob.nickname).toBeUndefined();
    expect(bob.taunt).toBeUndefined();
  });

  it('truncates a tagline longer than 140 characters', () => {
    const long = 'x'.repeat(200);
    const csv = `Name,Tagline\nBob,${long}`;
    const [bob] = parsePlayerCsv(csv);
    expect(bob.taunt).toHaveLength(140);
  });
});
