import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListChecks, ChartLineDown, MagnifyingGlass, Stack, FileCsv, ArrowRight,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card, { PanelHead } from '../../components/Card';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusDot from '../../components/StatusDot';
import { fetchOverviewStats } from '../../api/stats';
import { fetchRecentJobs } from '../../api/jobs';
import { quickCheck } from '../../api/checks';
import { REASON_ORDER, statusColor, statusLabel } from '../../lib/status';
import AddressDetailDrawer from '../Suppressions/AddressDetailDrawer';
import './Overview.css';

const JOB_STATUS_COLOR = {
  complete: 'oklch(0.66 0.125 155)',
  processing: 'var(--accent)',
  failed: 'oklch(0.66 0.125 25)',
};

export default function Overview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState({ rows: [] });
  const [quickEmail, setQuickEmail] = useState('');
  const [quickResult, setQuickResult] = useState(null);
  const [drawerEntryId, setDrawerEntryId] = useState(null);

  useEffect(() => {
    fetchOverviewStats().then(setStats);
    fetchRecentJobs({ pageSize: 5 }).then(setJobs);
  }, []);

  const runQuickCheck = async (e) => {
    e.preventDefault();
    if (!quickEmail.trim()) return;
    const result = await quickCheck(quickEmail.trim());
    setQuickResult(result);
  };

  const maxReason = Math.max(1, ...Object.values(stats?.reasonCounts || {}));

  return (
    <>
      <PageHeader
        kicker="Overview"
        title="Deliverability at a glance"
        subtitle="Suppression health across every list, and the last few imports. Numbers refresh as your ESP posts bounce events."
      />

      {stats && (
        <div className="stat-grid">
          <StatCard icon={ListChecks} label="Total suppressed" value={stats.totalSuppressed.toLocaleString()} delta={`+${stats.addedThisWeek.toLocaleString()} this week`} />
          <StatCard icon={ChartLineDown} label="Bounce rate (30d)" value={`${stats.bounceRate30d}%`} delta="of everything checked in the last 30 days" positive />
          <StatCard icon={MagnifyingGlass} label="Lookups today" value={stats.lookupsToday.toLocaleString()} delta="via the portal" />
          <StatCard icon={Stack} label="Lists cleaned" value={stats.listsCleaned.toLocaleString()} delta={`${stats.jobsRunning} job${stats.jobsRunning === 1 ? '' : 's'} running now`} accent={stats.jobsRunning > 0} />
        </div>
      )}

      <div className="overview-body">
        <Card>
          <PanelHead title="Recent imports" actions={<Button variant="ghost" onClick={() => navigate('/upload')}>New import</Button>} />
          <DataTable
            emptyMessage="No imports yet."
            rowKey={(r) => r.id}
            rows={jobs.rows}
            columns={[
              { key: 'file', header: 'File', width: '1.6fr', render: (r) => (
                <span className="file-cell">
                  <FileCsv size={16} style={{ color: 'var(--accent)', marginTop: 2 }} />
                  <span className="file-cell-text">
                    <span className="text-table">{r.filename}</span>
                    <span className="text-caption faint" style={{ paddingLeft: 2 }}>{new Date(r.started_at).toLocaleString()} · {r.list_name}</span>
                  </span>
                </span>
              ) },
              { key: 'rows', header: 'Rows', width: '.8fr', render: (r) => (r.total_rows ? r.total_rows.toLocaleString() : '—') },
              { key: 'suppressed', header: 'Suppressed', width: '.7fr', render: (r) => (r.status === 'failed' ? '—' : r.suppressed_count.toLocaleString()) },
              { key: 'status', header: 'Status', width: '.9fr', render: (r) => (
                <span className="status-cell" style={{ color: JOB_STATUS_COLOR[r.status] }}>
                  <StatusDot style={{ background: JOB_STATUS_COLOR[r.status] }} />
                  {r.status === 'failed' ? `Failed — ${r.error_message?.slice(0, 24) || 'error'}` : r.status === 'processing' ? `Processing ${r.percent ?? Math.round((r.processed_rows / r.total_rows) * 100)}%` : 'Complete'}
                </span>
              ) },
            ]}
          />
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card>
            <h2 className="text-section">Quick check</h2>
            <p className="text-caption muted" style={{ margin: '4px 0 12px' }}>One address, instant verdict.</p>
            <form className="quick-check-row" onSubmit={runQuickCheck}>
              <input className="input" placeholder="name@company.com" value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} style={{ minHeight: 38 }} />
              <Button variant="primary" type="submit">Check</Button>
            </form>
            {quickResult && (
              <div className="quick-result-card" onClick={() => quickResult.entryId && setDrawerEntryId(quickResult.entryId)}>
                <StatusDot reason={quickResult.reason} />
                <span className="mono text-table" style={{ flex: 1 }}>{quickResult.email}</span>
                <span className="text-caption muted">
                  {quickResult.verdict === 'deliverable' ? 'Deliverable' : statusLabel(quickResult.reason)}
                </span>
                <ArrowRight size={14} className="faint" />
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-section" style={{ marginBottom: 14 }}>Suppressions by reason</h2>
            {REASON_ORDER.map((reason) => {
              const count = stats?.reasonCounts?.[reason] || 0;
              return (
                <div key={reason} className="reason-row">
                  <div className="reason-row-label">
                    <span className="reason-row-label-left">
                      <StatusDot reason={reason} size="sm" />
                      {statusLabel(reason)}
                    </span>
                    <span>{count.toLocaleString()}</span>
                  </div>
                  <div className="progress-track progress-track-thin">
                    <div className="progress-fill" style={{ width: `${(count / maxReason) * 100}%`, background: statusColor(reason), opacity: 0.85 }} />
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      <AddressDetailDrawer entryId={drawerEntryId} onClose={() => setDrawerEntryId(null)} onChanged={() => {}} />
    </>
  );
}

function StatCard({ icon: Icon, label, value, delta, positive, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-card-label">
        <Icon size={15} />
        {label}
      </div>
      <div className="stat-card-value">{value}</div>
      <div className={`stat-card-delta${positive ? ' is-positive' : ''}${accent ? ' is-accent' : ''}`}>{delta}</div>
    </div>
  );
}
