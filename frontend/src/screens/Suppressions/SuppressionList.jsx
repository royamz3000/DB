import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, CaretRight, DownloadSimple } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import DataTable from '../../components/DataTable';
import RiskBar from '../../components/RiskBar';
import EmailCell from '../../components/EmailCell';
import { useRole } from '../../context/RoleContext';
import { useLists } from '../../context/ListsContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { fetchSuppressions, unsuppressEntries, exportSuppressionsUrl, revalidateEntry } from '../../api/suppressions';
import { REASON_ORDER, statusLabel } from '../../lib/status';
import { useToast } from '../../context/ToastContext';
import AddressDetailDrawer from './AddressDetailDrawer';
import './SuppressionList.css';

export default function SuppressionList() {
  const { isOps } = useRole();
  const { selectedListId } = useLists();
  const navigate = useNavigate();
  const showToast = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [reasons, setReasons] = useState([]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0, pageSize: 50, reasonCounts: {} });
  const [selected, setSelected] = useState(new Set());
  const [drawerEntryId, setDrawerEntryId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetchSuppressions({ search: debouncedSearch, reasons, listId: selectedListId, page, pageSize: 50 }).then(setData);
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, reasons, selectedListId]);

  useEffect(() => {
    load();
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, reasons, selectedListId, page]);

  const totalMatchingList = useMemo(
    () => Object.values(data.reasonCounts || {}).reduce((a, b) => a + b, 0),
    [data.reasonCounts],
  );

  const toggleReason = (reason) => {
    setReasons((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]));
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === data.rows.length ? new Set() : new Set(data.rows.map((r) => r.id))));
  };

  const handleUnsuppress = async () => {
    setBusy(true);
    try {
      const { removedCount } = await unsuppressEntries([...selected]);
      showToast(`${removedCount} addresses removed from suppression`);
      setSelected(new Set());
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleRevalidateSelected = async () => {
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => revalidateEntry(id)));
      showToast(`Re-validated ${selected.size} addresses`);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(Math.ceil(data.total / data.pageSize), 1);
  const hasFilters = search || reasons.length > 0;

  const copy = isOps
    ? { title: 'Browse and search suppressions', subtitle: 'Filter by reason, find a single address, and remove entries that were suppressed by mistake.' }
    : { title: 'Is this address safe to contact?', subtitle: 'Read-only search across the suppression lists you can see. If something looks wrong, ask ops to remove it — you cannot un-suppress here.' };

  return (
    <>
      <PageHeader kicker="Suppression list" title={copy.title} subtitle={copy.subtitle} />

      <Card>
        <div className="filter-row">
          <span className="search-field">
            <MagnifyingGlass size={16} />
            <input className="input" placeholder="Search address or domain…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </span>
          <div className="chip-row">
            {REASON_ORDER.map((reason) => (
              <Chip
                key={reason}
                reason={reason}
                label={statusLabel(reason)}
                count={data.reasonCounts?.[reason] || 0}
                selected={reasons.includes(reason)}
                onClick={() => toggleReason(reason)}
              />
            ))}
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={() => { setSearch(''); setReasons([]); }}>
              Clear
            </Button>
          )}
        </div>

        <div className="action-row">
          <div className="action-row-left">
            <span>{data.total} of {totalMatchingList} addresses</span>
            {isOps && selected.size > 0 && (
              <>
                <span className="selected-count">{selected.size} selected</span>
                <Button variant="primary" dense onClick={handleUnsuppress} disabled={busy}>
                  Un-suppress
                </Button>
                <Button variant="secondary" dense onClick={handleRevalidateSelected} disabled={busy}>
                  Re-run validation
                </Button>
              </>
            )}
          </div>
          <div className="action-row-right">
            {isOps && (
              <Button
                variant="secondary"
                icon={<DownloadSimple size={14} />}
                onClick={() => window.open(exportSuppressionsUrl({ search: debouncedSearch, reasons, listId: selectedListId }), '_blank')}
              >
                Export suppressed
              </Button>
            )}
            <Button variant="primary" onClick={() => navigate('/check')}>
              Clean a list against this
            </Button>
          </div>
        </div>

        <DataTable
          emptyMessage="No addresses match those filters."
          rowKey={(r) => r.id}
          rows={data.rows}
          onRowClick={(r) => setDrawerEntryId(r.id)}
          columns={[
            ...(isOps
              ? [{
                  key: 'select',
                  width: '34px',
                  header: (
                    <input type="checkbox" className="checkbox" checked={selected.size > 0 && selected.size === data.rows.length} onChange={toggleAll} onClick={(e) => e.stopPropagation()} />
                  ),
                  render: (r) => (
                    <input type="checkbox" className="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)} onClick={(e) => e.stopPropagation()} />
                  ),
                }]
              : []),
            { key: 'address', header: 'Address', width: '1.5fr', render: (r) => <EmailCell email={r.email} reason={r.reason} /> },
            { key: 'reason', header: 'Reason', width: '1.1fr', render: (r) => statusLabel(r.reason) },
            { key: 'list', header: 'Source list', width: '1.4fr', render: (r) => r.list_name },
            { key: 'added', header: 'Added', width: '.95fr', render: (r) => new Date(r.created_at).toLocaleDateString() },
            { key: 'addedBy', header: 'Added by', width: '.8fr', render: (r) => r.added_by },
            { key: 'risk', header: 'Risk', width: '84px', render: (r) => <RiskBar score={r.risk_score} reason={r.reason} /> },
            { key: 'chevron', header: '', width: '34px', render: () => <CaretRight size={14} className="faint" /> },
          ]}
        />

        <div className="pagination-row">
          <Button variant="secondary" dense disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <span className="muted">Page {page} of {totalPages}</span>
          <Button variant="secondary" dense disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </Card>

      <AddressDetailDrawer entryId={drawerEntryId} onClose={() => setDrawerEntryId(null)} onChanged={load} />
    </>
  );
}
