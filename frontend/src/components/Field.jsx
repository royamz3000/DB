import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import { cx } from '../lib/cx';

export function TextField({ label, className, ...rest }) {
  return (
    <label className={cx('field', className)}>
      {label && <span className="field-label">{label}</span>}
      <input className="input" {...rest} />
    </label>
  );
}

export function SearchField({ className, ...rest }) {
  return (
    <span className={cx('search-field', className)}>
      <MagnifyingGlass size={16} weight="regular" />
      <input className="input" {...rest} />
    </span>
  );
}

export function SelectField({ label, className, children, ...rest }) {
  return (
    <label className={cx('field', className)}>
      {label && <span className="field-label">{label}</span>}
      <span className="select-wrap">
        <select className="select" {...rest}>
          {children}
        </select>
        <CaretDown size={13} weight="bold" />
      </span>
    </label>
  );
}
