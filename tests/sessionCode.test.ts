import { describe, expect, it } from 'vitest';
import { generateSessionCode } from '../src/lib/sessionCode';

describe('generateSessionCode', () => {
  it('prefixes the code with the given namespace', () => {
    expect(generateSessionCode('SOCCER')).toMatch(/^SOCCER-[A-Z0-9]{4}$/);
    expect(generateSessionCode('VOTE')).toMatch(/^VOTE-[A-Z0-9]{4}$/);
  });

  it('never produces look-alike characters (0/O, 1/I) in the generated portion', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateSessionCode('X');
      const generated = code.slice('X-'.length);
      expect(generated).not.toMatch(/[01OI]/);
    }
  });

  it('SOCCER and VOTE codes can never collide, since the prefixes differ', () => {
    for (let i = 0; i < 20; i++) {
      const draft = generateSessionCode('SOCCER');
      const vote = generateSessionCode('VOTE');
      expect(draft).not.toBe(vote);
      expect(draft.startsWith('SOCCER-')).toBe(true);
      expect(vote.startsWith('VOTE-')).toBe(true);
    }
  });
});
