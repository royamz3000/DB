import { cx } from '../lib/cx';

export default function RadioCard({ selected, onSelect, label, name }) {
  return (
    <label className={cx('radio-card', selected && 'is-selected')}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} />
      <span className="radio-dot" />
      <span>{label}</span>
    </label>
  );
}
