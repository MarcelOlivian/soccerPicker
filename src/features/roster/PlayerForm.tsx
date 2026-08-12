import { useState } from 'react';
import type { FormEvent } from 'react';
import { PhotoInput } from '../../components/PhotoInput';
import { StatStepper } from '../../components/StatStepper';
import type { Player, PlayerStats, Position, StatKey, StatValue } from '../../types';
import { POSITIONS, STAT_KEYS, emptyStats } from '../../types';

const TAUNT_MAX_LENGTH = 140;

interface PlayerFormProps {
  initial?: Player;
  onSave: (player: Player) => void;
  onCancel: () => void;
}

export function PlayerForm({ initial, onSave, onCancel }: PlayerFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [position, setPosition] = useState<Position>(initial?.position ?? 'MID');
  const [stats, setStats] = useState<PlayerStats>(initial?.stats ?? emptyStats());
  const [taunt, setTaunt] = useState(initial?.taunt ?? '');
  const [photo, setPhoto] = useState<{ photoUrl?: string; photoKey?: string }>({
    photoUrl: initial?.photoUrl,
    photoKey: initial?.photoKey,
  });

  const canSave = name.trim().length > 0;

  function updateStat(key: StatKey, value: StatValue) {
    setStats((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const player: Player = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      position,
      stats,
      photoUrl: photo.photoUrl,
      photoKey: photo.photoKey,
      taunt: taunt.trim() || undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    };
    onSave(player);
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
        </div>
        <div className="sp-player-form__stats">
          {STAT_KEYS.map((key) => (
            <StatStepper key={key} statKey={key} value={stats[key]} onChange={(v) => updateStat(key, v)} />
          ))}
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
        <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
