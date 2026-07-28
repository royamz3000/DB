import { cx } from '../lib/cx';
import StatusDot from './StatusDot';

export default function Chip({ selected, reason, label, count, onClick }) {
  return (
    <button type="button" className={cx('chip', selected && 'is-selected')} onClick={onClick}>
      {reason && <StatusDot reason={reason} size="sm" />}
      <span>{label}</span>
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  );
}
