import { overall } from './rating';
import type { HistoryPlayerSnapshot, Player, Position } from '../types';

/** Freezes a player's name/nickname and their overall at the given position, for a match history record. Never a live reference — editing or deleting the player later can't corrupt a past entry. */
export function snapshotPlayer(
  player: Player,
  atPosition: Position,
  isCaptain: boolean,
  goals = 0,
  assists = 0,
  fouls = 0,
): HistoryPlayerSnapshot {
  return {
    id: player.id,
    name: player.name,
    nickname: player.nickname,
    position: atPosition,
    overall: overall(player, atPosition),
    isCaptain,
    goals: goals || undefined,
    assists: assists || undefined,
    fouls: fouls || undefined,
  };
}
