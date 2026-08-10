import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Card, { PanelHead } from '../../components/Card';
import Button from '../../components/Button';
import { fetchTables, fetchTableRows, runSqlQuery, resetDatabase } from '../../api/database';
import { useToast } from '../../context/ToastContext';
import { cx } from '../../lib/cx';
import './Database.css';

function ResultTable({ columns, rows }) {
  if (rows.length === 0) return <p className="text-caption muted" style={{ marginTop: 12 }}>No rows.</p>;
  return (
    <div className="db-result-scroll">
      <table className="db-result-table">
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => {
                const value = row[c];
                return (
                  <td key={c} title={value == null ? 'NULL' : String(value)}>
                    {value == null ? <span className="db-null">NULL</span> : String(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Database() {
  const showToast = useToast();
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [page, setPage] = useState(1);

  const [sql, setSql] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState('');
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadTables = () => fetchTables().then((d) => setTables(d.tables));

  useEffect(() => {
    loadTables();
  }, []);

  const handleReset = async () => {
    const ok = window.confirm(
      'This permanently deletes ALL suppression entries, lists, import history, ' +
      'check history, and API keys, and cannot be undone.\n\n' +
      'Your login, teammates, settings, and Constant Contact connections are kept.\n\n' +
      'Continue?',
    );
    if (!ok) return;
    setResetting(true);
    try {
      await resetDatabase();
      setActiveTable(null);
      setTableData(null);
      setQueryResult(null);
      await loadTables();
      showToast('Database cleared — clean slate ready');
    } catch (err) {
      showToast(err.message);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    if (!activeTable) return;
    fetchTableRows(activeTable, page, 50).then(setTableData);
  }, [activeTable, page]);

  const openTable = (name) => {
    setActiveTable(name);
    setPage(1);
    setQueryResult(null);
    setQueryError('');
  };

  const runQuery = async () => {
    if (!sql.trim()) return;
    setRunning(true);
    setQueryError('');
    try {
      const result = await runSqlQuery(sql);
      setQueryResult(result);
      setActiveTable(null);
      loadTables(); // row counts may have changed
    } catch (err) {
      setQueryError(err.message);
      setQueryResult(null);
    } finally {
      setRunning(false);
    }
  };

  const totalPages = tableData ? Math.max(Math.ceil(tableData.total / tableData.pageSize), 1) : 1;

  return (
    <>
      <PageHeader
        kicker="Database"
        title="Database browser"
        subtitle="Browse every table and run raw SQL against the live database. Read queries return rows; INSERT/UPDATE/DELETE run for real — there is no undo, so be careful."
      />

      <div className="db-layout">
        <Card>
          <div className="text-label" style={{ marginBottom: 10 }}>Tables</div>
          <div className="db-table-list">
            {tables.map((t) => (
              <button
                key={t.name}
                className={cx('db-table-btn', activeTable === t.name && 'is-active')}
                onClick={() => openTable(t.name)}
              >
                <span>{t.name}</span>
                <span className="db-table-btn-count">{t.rowCount.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card>
            <PanelHead
              title="Run SQL"
              actions={<Button variant="primary" onClick={runQuery} disabled={running || !sql.trim()}>{running ? 'Running…' : 'Run query'}</Button>}
            />
            <textarea
              className="db-sql-textarea"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              placeholder="SELECT * FROM suppression_entries WHERE reason = 'hard_bounce' LIMIT 20;"
              spellCheck={false}
            />
            {queryError && <p className="text-caption" style={{ color: 'oklch(0.66 0.125 25)', marginTop: 10 }}>{queryError}</p>}
            {queryResult && queryResult.kind === 'rows' && (
              <>
                <p className="text-caption muted" style={{ marginTop: 12 }}>{queryResult.rowCount} row(s) returned.</p>
                <ResultTable columns={queryResult.columns} rows={queryResult.rows} />
              </>
            )}
            {queryResult && queryResult.kind === 'write' && (
              <p className="text-caption" style={{ color: 'oklch(0.66 0.125 155)', marginTop: 12 }}>
                Success — {queryResult.changes} row(s) affected{queryResult.lastInsertRowid ? ` · last insert id ${queryResult.lastInsertRowid}` : ''}.
              </p>
            )}
          </Card>

          {activeTable && tableData && (
            <Card>
              <PanelHead title={activeTable} meta={`${tableData.total.toLocaleString()} rows`} />
              <ResultTable columns={tableData.columns} rows={tableData.rows} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
                <Button variant="secondary" dense disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <span className="text-caption muted">Page {page} of {totalPages}</span>
                <Button variant="secondary" dense disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </Card>
          )}

          <Card style={{ boxShadow: '0 0 0 1px oklch(0.66 0.125 25 / 0.4)' }}>
            <h2 className="text-section" style={{ color: 'oklch(0.66 0.125 25)' }}>Danger zone</h2>
            <p className="text-caption muted" style={{ margin: '6px 0 14px', maxWidth: '60ch' }}>
              Clear all sample/demo data to start fresh with real data. This permanently deletes every
              suppression entry, list, import, check, and API key, then leaves two empty starter lists.
              Your login, teammates, settings, and Constant Contact connections are kept. No undo.
            </p>
            <Button variant="secondary" onClick={handleReset} disabled={resetting}>
              {resetting ? 'Clearing…' : 'Clear all data (start fresh)'}
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
