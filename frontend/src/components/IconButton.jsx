import { cx } from '../lib/cx';

export default function IconButton({ size = 30, className, children, ...rest }) {
  return (
    <button type="button" className={cx('icon-btn', `icon-btn-${size}`, className)} {...rest}>
      {children}
    </button>
  );
}
