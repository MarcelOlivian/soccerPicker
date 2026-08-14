import { describe, expect, it } from 'vitest';
import { createFakeHub } from '../src/sync/fakeHub';
import { createVotingHostSession, HOST_VOTER_ID } from '../src/sync/votingHostSession';
import type { VoteHostMessage } from '../src/sync/votingProtocol';
import { emptyStats } from '../src/types';
import type { PlayerStats } from '../src/types';

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function subject() {
  return { playerId: 'p1', name: 'Alex Striker', position: 'ATT' as const };
}

function stats(overrides: Partial<PlayerStats>): PlayerStats {
  return { ...emptyStats(), ...overrides };
}

describe('votingHostSession', () => {
  it('a joining voter receives VOTE_HELLO and appears in everyone else\'s roster', async () => {
    const { hub, voters } = createFakeHub(2);
    const session = createVotingHostSession({ hub, getSubject: subject });

    const receivedByVoter0: VoteHostMessage[] = [];
    const receivedByVoter1: VoteHostMessage[] = [];
    voters[0].onMessage((m) => receivedByVoter0.push(m));
    voters[1].onMessage((m) => receivedByVoter1.push(m));

    voters[0].send({ type: 'VOTE_JOIN', displayName: 'Alex' });
    await flush();

    const hello = receivedByVoter0.find((m) => m.type === 'VOTE_HELLO');
    expect(hello).toBeDefined();
    if (hello?.type === 'VOTE_HELLO') {
      expect(hello.subject.name).toBe('Alex Striker');
      expect(hello.youAre).toBe('voter-0');
      // The host itself is always present in the roster, plus the joining voter.
      const names = hello.voters.map((v) => v.displayName);
      expect(names).toContain('Alex');
    }

    // voter-1 (not yet joined) should have seen the roster update via broadcast too.
    const rosterForVoter1 = receivedByVoter1.find((m) => m.type === 'VOTE_ROSTER');
    expect(rosterForVoter1).toBeDefined();
    session.dispose();
  });

  it('a blank display name gets an auto-generated handle', async () => {
    const { hub, voters } = createFakeHub(1);
    const session = createVotingHostSession({ hub, getSubject: subject });
    const received: VoteHostMessage[] = [];
    voters[0].onMessage((m) => received.push(m));

    voters[0].send({ type: 'VOTE_JOIN' });
    await flush();

    const hello = received.find((m) => m.type === 'VOTE_HELLO');
    if (hello?.type === 'VOTE_HELLO') {
      const me = hello.voters.find((v) => v.id === 'voter-0');
      expect(me?.displayName).toMatch(/^Voter \d+$/);
    }
    session.dispose();
  });

  it('casting a ballot flips only hasVoted — no stat values are ever broadcast before reveal', async () => {
    const { hub, voters } = createFakeHub(2);
    const session = createVotingHostSession({ hub, getSubject: subject });
    const received: VoteHostMessage[] = [];
    voters[0].onMessage((m) => received.push(m));
    voters[1].onMessage((m) => received.push(m));

    voters[0].send({ type: 'VOTE_JOIN', displayName: 'Alex' });
    voters[1].send({ type: 'VOTE_JOIN', displayName: 'Ben' });
    await flush();
    received.length = 0;

    voters[0].send({ type: 'VOTE_CAST', stats: stats({ pace: 5, shooting: 5, passing: 5, dribbling: 5, defending: 5, physicality: 5 }) });
    await flush();

    const rosterUpdates = received.filter((m) => m.type === 'VOTE_ROSTER');
    expect(rosterUpdates.length).toBeGreaterThan(0);
    const alex = rosterUpdates[rosterUpdates.length - 1];
    if (alex.type === 'VOTE_ROSTER') {
      const entry = alex.voters.find((v) => v.id === 'voter-0');
      expect(entry?.hasVoted).toBe(true);
    }
    // The critical security assertion: nothing in any pre-reveal message
    // contains a raw PlayerStats-shaped payload.
    const serialized = JSON.stringify(received);
    expect(serialized).not.toContain('"pace":5');
    session.dispose();
  });

  it('reveal() broadcasts every ballot, including the host\'s own', async () => {
    const { hub, voters } = createFakeHub(2);
    const session = createVotingHostSession({ hub, getSubject: subject, hostDisplayName: 'The Boss' });
    const received: VoteHostMessage[] = [];
    voters[0].onMessage((m) => received.push(m));

    voters[0].send({ type: 'VOTE_JOIN', displayName: 'Alex' });
    voters[1].send({ type: 'VOTE_JOIN', displayName: 'Ben' });
    await flush();

    voters[0].send({ type: 'VOTE_CAST', stats: stats({ pace: 4 }) });
    voters[1].send({ type: 'VOTE_CAST', stats: stats({ pace: 2 }) });
    session.castHostVote(stats({ pace: 3 }));
    await flush();

    const revealed = session.reveal();
    await flush();

    expect(revealed).toHaveLength(3);
    const byId = new Map(revealed.map((b) => [b.voterId, b]));
    expect(byId.get('voter-0')?.stats.pace).toBe(4);
    expect(byId.get('voter-1')?.stats.pace).toBe(2);
    expect(byId.get(HOST_VOTER_ID)?.stats.pace).toBe(3);
    expect(byId.get(HOST_VOTER_ID)?.displayName).toBe('The Boss');

    const broadcastReveal = received.find((m) => m.type === 'VOTE_REVEAL');
    expect(broadcastReveal).toBeDefined();
    session.dispose();
  });

  it('a disconnecting voter drops out of the roster and out of a subsequent reveal', async () => {
    const { hub, voters, disconnectVoter } = createFakeHub(2);
    const session = createVotingHostSession({ hub, getSubject: subject });

    voters[0].send({ type: 'VOTE_JOIN', displayName: 'Alex' });
    voters[1].send({ type: 'VOTE_JOIN', displayName: 'Ben' });
    await flush();
    voters[0].send({ type: 'VOTE_CAST', stats: stats({ pace: 5 }) });
    voters[1].send({ type: 'VOTE_CAST', stats: stats({ pace: 1 }) });
    await flush();

    expect(session.getVoters().map((v) => v.id)).toContain('voter-1');

    disconnectVoter('voter-1');
    await flush();

    const remaining = session.getVoters();
    expect(remaining.some((v) => v.id === 'voter-1')).toBe(false);

    const revealed = session.reveal();
    expect(revealed.some((b) => b.voterId === 'voter-1')).toBe(false);
    expect(revealed.some((b) => b.voterId === 'voter-0')).toBe(true);
    session.dispose();
  });

  it('reset() clears ballots but keeps the voter roster', async () => {
    const { hub, voters } = createFakeHub(1);
    const session = createVotingHostSession({ hub, getSubject: subject });
    voters[0].send({ type: 'VOTE_JOIN', displayName: 'Alex' });
    await flush();
    voters[0].send({ type: 'VOTE_CAST', stats: stats({ pace: 5 }) });
    await flush();

    expect(session.getVoters().find((v) => v.id === 'voter-0')?.hasVoted).toBe(true);

    session.reset();

    const voter = session.getVoters().find((v) => v.id === 'voter-0');
    expect(voter?.hasVoted).toBe(false);
    expect(voter?.displayName).toBe('Alex');
    session.dispose();
  });
});
