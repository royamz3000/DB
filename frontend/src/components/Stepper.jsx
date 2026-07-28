import { Fragment } from 'react';
import { cx } from '../lib/cx';

export default function Stepper({ steps, currentIndex }) {
  return (
    <div className="stepper">
      {steps.map((label, i) => (
        <Fragment key={label}>
          <div className={cx('stepper-step', i === currentIndex && 'is-active', i < currentIndex && 'is-done')}>
            <span className="stepper-circle">{i + 1}</span>
            <span className="stepper-label">{label}</span>
          </div>
          {i < steps.length - 1 && <div className="stepper-rule" />}
        </Fragment>
      ))}
    </div>
  );
}
