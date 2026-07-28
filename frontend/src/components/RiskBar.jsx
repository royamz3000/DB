import { statusColor } from '../lib/status';

export default function RiskBar({ score, reason = 'clean' }) {
  const color = statusColor(reason);
  return (
    <span className="risk-bar">
      <span className="risk-track">
        <span className="risk-fill" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: color }} />
      </span>
      <span className="risk-value">{score}</span>
    </span>
  );
}
