import type { BalanceResult } from '../lib/balance';
import type { Team } from '../types';

interface BalanceMeterProps {
  result: BalanceResult;
  teamNames: Record<Team, string>;
}

const VERDICT_TEXT: Record<BalanceResult['verdict'], (leaderName: string | null) => string> = {
  EVEN: () => 'EVEN',
  SLIGHT_EDGE: (leaderName) => `SLIGHT EDGE · TEAM ${leaderName?.toUpperCase()}`,
  EDGE: (leaderName) => `EDGE · TEAM ${leaderName?.toUpperCase()}`,
};

/** Live team-strength bar shown during the draft and on the pitch board. */
export function BalanceMeter({ result, teamNames }: BalanceMeterProps) {
  const { strengthA, strengthB, verdict, leader } = result;
  const total = strengthA + strengthB || 1;
  const pctA = Math.round((strengthA / total) * 100);
  const leaderName = leader ? teamNames[leader] : null;

  return (
    <div className="sp-balance-meter">
      <div className="sp-balance-meter__row">
        <span className="sp-balance-meter__label" data-team="A">
          TEAM {teamNames.A.toUpperCase()} · {strengthA}
        </span>
        <span className={`sp-badge sp-balance-meter__verdict sp-balance-meter__verdict--${verdict.toLowerCase()}`}>
          {VERDICT_TEXT[verdict](leaderName)}
        </span>
        <span className="sp-balance-meter__label" data-team="B">
          TEAM {teamNames.B.toUpperCase()} · {strengthB}
        </span>
      </div>
      <div className="sp-balance-meter__bar">
        <div className="sp-balance-meter__fill sp-balance-meter__fill--a" style={{ width: `${pctA}%` }} />
        <div className="sp-balance-meter__fill sp-balance-meter__fill--b" style={{ width: `${100 - pctA}%` }} />
      </div>
    </div>
  );
}
