import { useState } from 'react';
import type { FormEvent } from 'react';
import { PhotoInput } from '../../components/PhotoInput';
import { StatStepper } from '../../components/StatStepper';
import { formatStatsVerifiedAt } from '../../lib/statsVerified';
import { useVoting } from '../../state/VotingContext';
import type { Player, PlayerStats, Position, StatKey, StatValue } from '../../types';
import { POSITIONS, STAT_KEYS, emptyStats } from '../../types';
import { VoteHostPanel } from '../voting/VoteHostPanel';

const TAUNT_MAX_LENGTH = 140;

interface PlayerFormProps {
  initial?: Player;
  onSave: (player: Player) => void;
  onCancel: () => void;
}

export function PlayerForm({ initial, onSave, onCancel }: PlayerFormProps) {
  // Computed once (not inline at submit time) so a stats vote started
  // before the first save uses the exact same id the player is eventually
  // saved under — the vote subject and the saved Player must be the same
  // record, not two different ones that happen to share a name.
  const [playerId] = useState(initial?.id ?? crypto.randomUUID());
  const [name, setName] = useState(initial?.name ?? '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [position, setPosition] = useState<Position>(initial?.position ?? 'MID');
  const [stats, setStats] = useState<PlayerStats>(initial?.stats ?? emptyStats());
  const [statsVerifiedBy, setStatsVerifiedBy] = useState<string[] | undefined>(initial?.statsVerifiedBy);
  const [statsVerifiedAt, setStatsVerifiedAt] = useState<number | undefined>(initial?.statsVerifiedAt);
  const [taunt, setTaunt] = useState(initial?.taunt ?? '');
  const [photo, setPhoto] = useState<{ photoUrl?: string; photoKey?: string }>({
    photoUrl: initial?.photoUrl,
    photoKey: initial?.photoKey,
  });
  const [hostDisplayName, setHostDisplayName] = useState('');
  const voting = useVoting();

  const canSave = name.trim().length > 0;
  const votingForThisPlayer = voting.role === 'host' && voting.subject?.playerId === playerId;

  function updateStat(key: StatKey, value: StatValue) {
    setStats((prev) => ({ ...prev, [key]: value }));
    // A hand edit means the saved stats no longer exactly match what the
    // group voted for, so the "verified" record no longer applies — even a
    // single-stat tweak right after a reveal clears it. Re-voting is the
    // only way to get it back.
    setStatsVerifiedBy(undefined);
    setStatsVerifiedAt(undefined);
  }

  function handleApplyVoteStats(newStats: PlayerStats, votedBy: string[]) {
    setStats(newStats);
    setStatsVerifiedBy(votedBy);
    setStatsVerifiedAt(Date.now());
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const player: Player = {
      id: playerId,
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      position,
      stats,
      photoUrl: photo.photoUrl,
      photoKey: photo.photoKey,
      taunt: taunt.trim() || undefined,
      statsVerifiedBy,
      statsVerifiedAt,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    onSave(player);
  }

  function handleStartVote() {
    voting.startVote(
      {
        playerId,
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        position,
        photoUrl: photo.photoUrl,
        photoKey: photo.photoKey,
      },
      hostDisplayName.trim() || undefined,
    );
  }

  if (votingForThisPlayer) {
    return (
      <div className="sp-panel sp-player-form">
        <h3>{initial ? 'Edit player' : 'New player'} — stats vote</h3>
        <VoteHostPanel onApplyStats={handleApplyVoteStats} />
        <div className="sp-player-form__actions">
          <button
            type="button"
            className="sp-btn sp-btn--ghost"
            onClick={() => {
              voting.endVote();
              onCancel();
            }}
          >
            Close form
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="sp-panel sp-player-form" onSubmit={handleSubmit}>
      <h3>{initial ? 'Edit player' : 'New player'}</h3>
      <div className="sp-player-form__grid">
        <div className="sp-player-form__col">
          <div className="sp-field">
            <label htmlFor="p-name">Name</label>
            <input
              id="p-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="sp-field">
            <label htmlFor="p-nick">Nickname (optional)</label>
            <input id="p-nick" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div className="sp-field">
            <label htmlFor="p-pos">Preferred position</label>
            <select id="p-pos" value={position} onChange={(e) => setPosition(e.target.value as Position)}>
              {POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>
          <PhotoInput value={photo} onChange={setPhoto} />
          <div className="sp-field">
            <label htmlFor="p-host-name">Your name (shown to voters, optional)</label>
            <input
              id="p-host-name"
              type="text"
              value={hostDisplayName}
              onChange={(e) => setHostDisplayName(e.target.value)}
              placeholder="Used if you start a stats vote"
            />
          </div>
        </div>
        <div className="sp-player-form__stats">
          {STAT_KEYS.map((key) => (
            <StatStepper key={key} statKey={key} value={stats[key]} onChange={(v) => updateStat(key, v)} />
          ))}
          {statsVerifiedBy && statsVerifiedAt && (
            <p className="sp-hint">
              Stats voted by {statsVerifiedBy.join(', ')} on {formatStatsVerifiedAt(statsVerifiedAt)}.
            </p>
          )}
          <div className="sp-field sp-field--taunt">
            <label htmlFor="p-taunt">Signature line (optional)</label>
            <textarea
              id="p-taunt"
              value={taunt}
              onChange={(e) => setTaunt(e.target.value)}
              maxLength={TAUNT_MAX_LENGTH}
              rows={4}
              placeholder="A quote, taunt, or thing they always say…"
            />
            <span className="sp-hint">
              {taunt.length}/{TAUNT_MAX_LENGTH}
            </span>
          </div>
        </div>
      </div>
      <div className="sp-player-form__actions">
        <button type="submit" className="sp-btn sp-btn--primary" disabled={!canSave}>
          Save player
        </button>
        <button type="button" className="sp-btn sp-btn--ghost" disabled={!canSave} onClick={handleStartVote}>
          Start stats vote
        </button>
        <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        {voting.errorMessage && (
          <span className="sp-hint" role="alert">
            {voting.errorMessage}
          </span>
        )}
      </div>
    </form>
  );
}
