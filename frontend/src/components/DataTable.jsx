import { cx } from '../lib/cx';

export default function DataTable({ columns, rows, rowKey, onRowClick, emptyMessage = 'No results.' }) {
  const template = columns.map((c) => c.width || '1fr').join(' ');

  return (
    <div className="data-table">
      <div className="data-table-head data-table-row" style={{ gridTemplateColumns: template }}>
        {columns.map((col) => (
          <span key={col.key} className="data-table-cell">
            {col.header}
          </span>
        ))}
      </div>
      <div className="data-table-body">
        {rows.length === 0 && <div className="data-table-empty">{emptyMessage}</div>}
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className={cx('data-table-row', 'text-table', onRowClick && 'is-clickable')}
            style={{ gridTemplateColumns: template, padding: '13px 22px' }}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <span key={col.key} className="data-table-cell">
                {col.render(row)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
