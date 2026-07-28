import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Paperclip, DownloadSimple, ArrowsClockwise, CaretRight } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card, { PanelHead } from '../../components/Card';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import EmailCell from '../../components/EmailCell';
import RiskBar from '../../components/RiskBar';
import CheckboxRow from '../../components/Checkbox';
import { useRole } from '../../context/RoleContext';
import { runCheckBatch, uploadCheckFile, cleanExportUrl } from '../../api/checks';
import { statusColor, statusLabel } from '../../lib/status';
import AddressDetailDrawer from '../Suppressions/AddressDetailDrawer';
import './CheckEmails.css';

export default function CheckEmails() {
  const { isOps } = useRole();
  const location = useLocation();
  const [text, setText] = useState('');
  const [deepCheck, setDeepCheck] = useState(true);
  const [batch, setBatch] = useState(location.state?.batch || null);
  const [loading, setLoading] = useState(false);
  const [drawerEntryId, setDrawerEntryId] = useState(null);
  const fileInputRef = useRef(null);

  const addressCount = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).length;

  const runCheck = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const result = await runCheckBatch({ text, deepCheck });
      setBatch(result);
    } finally {
      setLoading(false);
    }
  };

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLoading(true);
    try {
      const result = await uploadCheckFile(file, deepCheck);
      setBatch(result);
      setText('');
    } finally {
      setLoading(false);
    }
  };

  const results = batch?.results || [];
  const flagged = results.filter((r) => r.verdict === 'suppressed_or_invalid').length;
  const deliverable = results.length - flagged;

  const copy = isOps
    ? {
        title: 'Look up individual addresses',
        subtitle: 'Paste addresses or import a file to see whether each one is invalid or already suppressed, and why.',
      }
    : {
        title: 'Check a list before you send it',
        subtitle:
          'Paste the addresses from your sequencer, or import the file. Anything flagged here will bounce, has opted out, or is a spam trap — drop those rows before you import.',
      };

  return (
    <>
      <PageHeader kicker="Check emails" title={copy.title} subtitle={copy.subtitle} />

      <div className="check-grid">
        <Card>
          <h2 className="text-section">Paste addresses</h2>
          <p className="text-caption muted" style={{ margin: '4px 0 12px' }}>
            {addressCount} addresses · one per line, or comma separated
          </p>
          <textarea
            className="check-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'jane@example.com\njohn@example.com, another@example.com'}
          />
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-secondary btn-dense" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={14} /> Import file instead
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={onFileChosen} />
          </div>

          <div className="check-toolbar">
            <CheckboxRow checked={deepCheck} onChange={(e) => setDeepCheck(e.target.checked)} label="Deep check (SMTP + risk score)" />
            <div className="check-toolbar-actions">
              <Button variant="secondary" onClick={() => { setText(''); setBatch(null); }}>
                Clear
              </Button>
              <Button variant="primary" onClick={runCheck} disabled={loading || addressCount === 0}>
                {loading ? 'Checking…' : `Check ${addressCount} addresses`}
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-section" style={{ marginBottom: 12 }}>This batch</h2>
          <SummaryRow color={statusColor('hard_bounce')} label="Suppressed or invalid" value={flagged} />
          <SummaryRow color={statusColor('clean')} label="Deliverable" value={deliverable} />
          <SummaryRow color="rgba(233,233,237,.5)" label="Checked" value={results.length} />
          <hr className="rule" style={{ margin: '10px 0' }} />
          <p className="text-caption faint">
            Checks run against all lists you can see, plus the global blocklist and our invalid-domain index.
          </p>
        </Card>
      </div>

      {batch && (
        <Card style={{ marginTop: 24 }}>
          <PanelHead
            title="Results"
            meta={`${flagged} of ${results.length} suppressed or invalid`}
            actions={
              <>
                <Button
                  variant="secondary"
                  dense
                  icon={<DownloadSimple size={14} />}
                  onClick={() => window.open(cleanExportUrl(batch.batchId), '_blank')}
                >
                  Export clean
                </Button>
                <Button variant="secondary" dense icon={<ArrowsClockwise size={14} />} onClick={runCheck}>
                  Re-run validation
                </Button>
              </>
            }
          />
          <DataTable
            columns={[
              { key: 'address', header: 'Address', width: '1.5fr', render: (r) => <EmailCell email={r.email} reason={r.reason} /> },
              { key: 'verdict', header: 'Verdict', width: '.95fr', render: (r) => (
                <span className="verdict-cell" style={{ color: statusColor(r.reason) }}>
                  {r.verdict === 'deliverable' ? 'Deliverable' : statusLabel(r.reason)}
                </span>
              ) },
              { key: 'reason', header: 'Reason', width: '1.3fr', render: (r) => (r.verdict === 'deliverable' ? 'No records found' : statusLabel(r.reason)) },
              { key: 'list', header: 'Source list', width: '.9fr', render: (r) => r.listName || '—' },
              { key: 'risk', header: 'Risk', width: '90px', render: (r) => <RiskBar score={r.riskScore} reason={r.reason} /> },
              { key: 'chevron', header: '', width: '34px', render: () => <CaretRight size={14} className="faint" /> },
            ]}
            rows={results}
            rowKey={(r) => r.email}
            onRowClick={(r) => r.entryId && setDrawerEntryId(r.entryId)}
          />
        </Card>
      )}

      <AddressDetailDrawer entryId={drawerEntryId} onClose={() => setDrawerEntryId(null)} onChanged={() => {}} />
    </>
  );
}

function SummaryRow({ color, label, value }) {
  return (
    <div className="batch-summary-row">
      <span className="batch-summary-row-label">
        <span className="status-dot" style={{ background: color }} />
        {label}
      </span>
      <span className="batch-summary-value">{value}</span>
    </div>
  );
}
