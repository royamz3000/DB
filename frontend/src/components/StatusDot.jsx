import { cx } from '../lib/cx';
import { statusColor } from '../lib/status';

export default function StatusDot({ reason = 'clean', size = 'md', className, style }) {
  const sizeClass = size === 'lg' ? 'status-dot-lg' : size === 'sm' ? 'status-dot-sm' : '';
  return (
    <span
      className={cx('status-dot', sizeClass, className)}
      style={{ background: statusColor(reason), ...style }}
    />
  );
}
