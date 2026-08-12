import type { BalanceResult } from '../lib/balance';

interface BalanceMeterProps {
  result: BalanceResult;
}

const VERDICT_TEXT: Record<BalanceResult['verdict'], (leader: string | null) => string> = {
  EVEN: () => 'EVEN',
  SLIGHT_EDGE: (leader) => `SLIGHT EDGE · TEAM ${leader}`,
  EDGE: (leader) => `EDGE · TEAM ${leader}`,
};

/** Live team-strength bar shown during the draft and on the pitch board. */
export function BalanceMeter({ result }: BalanceMeterProps) {
  const { strengthA, strengthB, verdict, leader } = result;
  const total = strengthA + strengthB || 1;
  const pctA = Math.round((strengthA / total) * 100);

  return (
    <div className="sp-balance-meter">
      <div className="sp-balance-meter__row">
        <span className="sp-balance-meter__label" data-team="A">
          TEAM A · {strengthA}
        </span>
        <span className={`sp-badge sp-balance-meter__verdict sp-balance-meter__verdict--${verdict.toLowerCase()}`}>
          {VERDICT_TEXT[verdict](leader)}
        </span>
        <span className="sp-balance-meter__label" data-team="B">
          TEAM B · {strengthB}
        </span>
      </div>
      <div className="sp-balance-meter__bar">
        <div className="sp-balance-meter__fill sp-balance-meter__fill--a" style={{ width: `${pctA}%` }} />
        <div className="sp-balance-meter__fill sp-balance-meter__fill--b" style={{ width: `${100 - pctA}%` }} />
      </div>
    </div>
  );
}
