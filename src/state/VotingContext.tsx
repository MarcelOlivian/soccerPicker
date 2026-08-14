import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { blobToDataUrl, getImageBlob } from '../lib/imageStore';
import { PEERJS_SERVER_CONFIG } from '../lib/peerjsConfig';
import { generateSessionCode } from '../lib/sessionCode';
import { tallyVotes } from '../lib/voteTally';
import type { SyncMessage } from '../sync/protocol';
import type { PeerHub } from '../sync/peerHub';
import { hostPeerHub } from '../sync/peerHub';
import type { PeerJsServerConfig } from '../sync/peerjsTransport';
import { PeerJsTransport } from '../sync/peerjsTransport';
import type { ConnectionStatus } from '../sync/transport';
import type { VotingHostSession } from '../sync/votingHostSession';
import { createVotingHostSession, HOST_VOTER_ID } from '../sync/votingHostSession';
import type {
  RevealedBallot,
  VoteClientMessage,
  VoteHostMessage,
  VotePhase,
  VoteSubject,
  VoterSummary,
} from '../sync/votingProtocol';
import type { PlayerStats, Position } from '../types';
import { claimSession, releaseSession, SessionConflictError } from './sessionLock';

export type VotingRole = 'off' | 'host' | 'voter';
export type VotingStatus = ConnectionStatus | 'idle';

export interface StartVoteInput {
  playerId: string;
  name: string;
  nickname?: string;
  position: Position;
  photoUrl?: string;
  photoKey?: string;
}

interface VotingContextValue {
  role: VotingRole;
  status: VotingStatus;
  phase: VotePhase;
  sessionCode: string | null;
  errorMessage: string | null;
  subject: VoteSubject | null;
  voters: VoterSummary[];
  /** This device's own peer id in the voter roster — HOST_VOTER_ID while hosting. */
  myVoterId: string | null;
  myVote: PlayerStats | null;
  hasSubmitted: boolean;
  revealedBallots: RevealedBallot[] | null;
  /** Rounded average across revealedBallots, or null before reveal. */
  tally: PlayerStats | null;
  startVote: (input: StartVoteInput, hostDisplayName?: string) => void;
  joinVote: (code: string, displayName?: string) => void;
  castVote: (stats: PlayerStats) => void;
  /** Host-only. Reveals whatever ballots have been cast so far — safe to call before everyone has voted. */
  reveal: () => void;
  /** Host-only. Starts a fresh round for the same subject. */
  resetRound: () => void;
  endVote: () => void;
}

const VotingContext = createContext<VotingContextValue | null>(null);

/**
 * A voter only ever talks to one host, so the underlying connection reuses
 * `PeerJsTransport` verbatim (it's payload-shape-agnostic at the WebRTC
 * layer). This thin wrapper is the typing seam: `PeerJsTransport` is typed
 * against the draft protocol's `SyncMessage`, not voting's — the cast pair
 * here is the entire blast radius of that mismatch.
 */
function joinVoteSession(
  code: string,
  onFatalError: (err: Error) => void,
  serverConfig?: PeerJsServerConfig,
) {
  const inner = PeerJsTransport.join(code, onFatalError, serverConfig);
  return {
    send: (msg: VoteClientMessage) => inner.send(msg as unknown as SyncMessage),
    onMessage: (cb: (msg: VoteHostMessage) => void) => inner.onMessage((m) => cb(m as unknown as VoteHostMessage)),
    onStatus: (cb: (status: ConnectionStatus) => void) => inner.onStatus(cb),
    close: () => inner.close(),
  };
}
type VoteVoterTransport = ReturnType<typeof joinVoteSession>;

export function VotingProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<VotingRole>('off');
  const [status, setStatus] = useState<VotingStatus>('idle');
  const [phase, setPhase] = useState<VotePhase>('collecting');
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [subject, setSubject] = useState<VoteSubject | null>(null);
  const [voters, setVoters] = useState<VoterSummary[]>([]);
  const [myVoterId, setMyVoterId] = useState<string | null>(null);
  const [myVote, setMyVote] = useState<PlayerStats | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [revealedBallots, setRevealedBallots] = useState<RevealedBallot[] | null>(null);

  const hubRef = useRef<PeerHub | null>(null);
  const hostSessionRef = useRef<VotingHostSession | null>(null);
  const voterTransportRef = useRef<VoteVoterTransport | null>(null);
  // getSubject() is called fresh on every VOTE_JOIN, so a photo resolved
  // asynchronously after the session already started still reaches
  // late-joining voters correctly.
  const subjectRef = useRef<VoteSubject | null>(null);

  const teardown = useCallback(() => {
    hostSessionRef.current?.dispose();
    hostSessionRef.current = null;
    hubRef.current?.close();
    hubRef.current = null;
    voterTransportRef.current?.close();
    voterTransportRef.current = null;
  }, []);

  const resetLocalState = useCallback(() => {
    setPhase('collecting');
    setSubject(null);
    setVoters([]);
    setMyVoterId(null);
    setMyVote(null);
    setHasSubmitted(false);
    setRevealedBallots(null);
  }, []);

  const startVote = useCallback(
    (input: StartVoteInput, hostDisplayName?: string) => {
      try {
        claimSession('voting');
      } catch (err) {
        if (err instanceof SessionConflictError) {
          setErrorMessage(err.message);
          return;
        }
        throw err;
      }
      teardown();
      resetLocalState();
      setErrorMessage(null);

      const initialSubject: VoteSubject = {
        playerId: input.playerId,
        name: input.name,
        nickname: input.nickname,
        position: input.position,
        // An external URL is already directly usable by a voter's browser.
        photoDataUrl: input.photoUrl,
      };
      subjectRef.current = initialSubject;
      setSubject(initialSubject);

      // A photoKey points into this device's own IndexedDB — meaningless
      // off-host, so resolve it to a portable data URL before anyone joins.
      if (!input.photoUrl && input.photoKey) {
        const photoKey = input.photoKey;
        void (async () => {
          const blob = await getImageBlob(photoKey);
          if (!blob) return;
          const photoDataUrl = await blobToDataUrl(blob);
          const resolved = { ...initialSubject, photoDataUrl };
          subjectRef.current = resolved;
          setSubject(resolved);
        })();
      }

      const code = generateSessionCode('VOTE');
      setSessionCode(code);
      setRole('host');
      setMyVoterId(HOST_VOTER_ID);
      setStatus('connecting');

      const hub = hostPeerHub(
        code,
        (err) => {
          setErrorMessage(err.message);
          setStatus('error');
        },
        PEERJS_SERVER_CONFIG,
      );
      hubRef.current = hub;
      hub.onStatus(setStatus);

      const session = createVotingHostSession({
        hub,
        getSubject: () => subjectRef.current ?? initialSubject,
        hostDisplayName,
        onVotersChange: setVoters,
      });
      hostSessionRef.current = session;
      setVoters(session.getVoters());
    },
    [teardown, resetLocalState],
  );

  const joinVote = useCallback(
    (code: string, displayName?: string) => {
      try {
        claimSession('voting');
      } catch (err) {
        if (err instanceof SessionConflictError) {
          setErrorMessage(err.message);
          return;
        }
        throw err;
      }
      teardown();
      resetLocalState();
      setErrorMessage(null);

      const normalized = code.trim().toUpperCase();
      setSessionCode(normalized);
      setRole('voter');
      setStatus('connecting');

      const transport = joinVoteSession(
        normalized,
        (err) => {
          setErrorMessage(err.message);
          setStatus('error');
        },
        PEERJS_SERVER_CONFIG,
      );
      voterTransportRef.current = transport;

      transport.onMessage((message) => {
        switch (message.type) {
          case 'VOTE_HELLO':
            setMyVoterId(message.youAre);
            setSubject(message.subject);
            setVoters(message.voters);
            setPhase(message.phase);
            break;
          case 'VOTE_ROSTER':
            setVoters(message.voters);
            break;
          case 'VOTE_REVEAL':
            setPhase('revealed');
            setRevealedBallots(message.ballots);
            break;
          case 'VOTE_RESET':
            setPhase('collecting');
            setRevealedBallots(null);
            setMyVote(null);
            setHasSubmitted(false);
            break;
          case 'VOTE_CLOSED':
            setErrorMessage(message.reason);
            teardown();
            releaseSession('voting');
            setRole('off');
            setStatus('idle');
            setSessionCode(null);
            break;
        }
      });

      let hasJoinedThisConnection = false;
      transport.onStatus((s) => {
        setStatus(s);
        if (s === 'open' && !hasJoinedThisConnection) {
          hasJoinedThisConnection = true;
          transport.send({ type: 'VOTE_JOIN', displayName });
        }
        if (s !== 'open') hasJoinedThisConnection = false; // a reconnect gets a fresh JOIN → fresh HELLO
      });
    },
    [teardown, resetLocalState],
  );

  const castVote = useCallback(
    (stats: PlayerStats) => {
      setMyVote(stats);
      setHasSubmitted(true);
      if (role === 'host') {
        hostSessionRef.current?.castHostVote(stats);
      } else if (role === 'voter') {
        voterTransportRef.current?.send({ type: 'VOTE_CAST', stats });
      }
    },
    [role],
  );

  const reveal = useCallback(() => {
    const ballots = hostSessionRef.current?.reveal();
    if (ballots) {
      setPhase('revealed');
      setRevealedBallots(ballots);
    }
  }, []);

  const resetRound = useCallback(() => {
    hostSessionRef.current?.reset();
    setPhase('collecting');
    setRevealedBallots(null);
    setMyVote(null);
    setHasSubmitted(false);
  }, []);

  const endVote = useCallback(() => {
    if (role === 'host') {
      hubRef.current?.broadcast({ type: 'VOTE_CLOSED', reason: 'The host ended this vote.' });
    }
    teardown();
    releaseSession('voting');
    setRole('off');
    setStatus('idle');
    setSessionCode(null);
    setErrorMessage(null);
    resetLocalState();
  }, [role, teardown, resetLocalState]);

  useEffect(
    () => () => {
      teardown();
      releaseSession('voting');
    },
    [teardown],
  );

  const tally = revealedBallots ? tallyVotes(revealedBallots.map((b) => b.stats)) : null;

  const value: VotingContextValue = {
    role,
    status,
    phase,
    sessionCode,
    errorMessage,
    subject,
    voters,
    myVoterId,
    myVote,
    hasSubmitted,
    revealedBallots,
    tally,
    startVote,
    joinVote,
    castVote,
    reveal,
    resetRound,
    endVote,
  };

  return <VotingContext.Provider value={value}>{children}</VotingContext.Provider>;
}

export function useVoting(): VotingContextValue {
  const ctx = useContext(VotingContext);
  if (!ctx) throw new Error('useVoting must be used within a VotingProvider');
  return ctx;
}
