import { cx } from '../lib/cx';

export default function ProgressBar({ percent, thin }) {
  return (
    <div className={cx('progress-track', thin && 'progress-track-thin')}>
      <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}
