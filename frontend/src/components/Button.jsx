import { cx } from '../lib/cx';

export default function Button({ variant = 'primary', dense = false, icon, className, children, ...rest }) {
  return (
    <button className={cx('btn', `btn-${variant}`, dense && 'btn-dense', className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}
