import { cx } from '../lib/cx';

export default function Card({ solid, className, children, ...rest }) {
  return (
    <div className={cx('card', solid && 'card-solid', className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHead({ title, meta, actions }) {
  return (
    <div className="panel-head">
      <div className="panel-head-title">
        <h2 className="text-section">{title}</h2>
        {meta && <span className="text-secondary muted">{meta}</span>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
