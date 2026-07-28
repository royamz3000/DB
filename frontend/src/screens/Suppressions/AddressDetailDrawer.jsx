import { useEffect, useState } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import Drawer from '../../components/Drawer';
import Button from '../../components/Button';
import StatusDot from '../../components/StatusDot';
import { statusColor, statusLabel } from '../../lib/status';
import { eventLabel, formatTimestamp } from '../../lib/events';
import { fetchEntry, unsuppressEntries, addEntryNote, askOpsToReview, revalidateEntry } from '../../api/suppressions';
import { useRole } from '../../context/RoleContext';
import { useToast } from '../../context/ToastContext';

export default function AddressDetailDrawer({ entryId, onClose, onChanged }) {
  const { isOps } = useRole();
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entryId) {
      setData(null);
      return;
    }
    fetchEntry(entryId).then(setData).catch(() => setData(null));
  }, [entryId]);

  if (!entryId) return null;

  const entry = data?.entry;
  const events = data?.events || [];
  const domain = entry?.email?.split('@')[1] || '';

  const handleUnsuppress = async () => {
    setBusy(true);
    try {
      await unsuppressEntries([entryId]);
      showToast('1 address removed from suppression');
      onChanged?.();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleRevalidate = async () => {
    setBusy(true);
    try {
      await revalidateEntry(entryId);
      showToast('Re-validation complete');
      const fresh = await fetchEntry(entryId);
      setData(fresh);
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setBusy(true);
    try {
      await addEntryNote(entryId, noteText.trim());
      setNoteText('');
      setAddingNote(false);
      const fresh = await fetchEntry(entryId);
      setData(fresh);
    } finally {
      setBusy(false);
    }
  };

  const handleAskReview = async () => {
    setBusy(true);
    try {
      await askOpsToReview(entryId);
      showToast('Ops has been asked to review this entry');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={Boolean(entryId)} onClose={onClose} kicker="Address detail" title={entry?.email || ''}>
      {entry && (
        <>
          <div
            className="card"
            style={{ background: 'rgba(22,24,38,.7)', boxShadow: '0 0 0 1px rgba(233,233,237,.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusDot reason={entry.reason} size="lg" />
              <div>
                <div className="text-panel">{statusLabel(entry.reason)}</div>
                <div className="text-secondary muted">{statusLabel(entry.reason)} · risk {entry.risk_score}/100</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-label-sm">Risk</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: statusColor(entry.reason) }}>{entry.risk_score}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Fact label="Reason" value={statusLabel(entry.reason)} />
            <Fact label="Source list" value={entry.list_name} />
            <Fact label="Date added" value={new Date(entry.created_at).toLocaleDateString()} />
            <Fact label="Added by" value={entry.added_by} />
            <Fact label="Risk score" value={`${entry.risk_score} / 100`} />
            <Fact label="Domain" value={domain} mono />
            <Fact label="Company" value={entry.company_name || '—'} />
            <Fact label="Lead / Contact ID" value={entry.lead_id || '—'} mono />
            <Fact label="Phone" value={entry.phone || '—'} />
            <Fact label="CRM owner" value={entry.crm_owner || '—'} />
            {entry.crm_record_url && (
              <Fact
                label="CRM record"
                value={
                  <a href={entry.crm_record_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    Open in CRM ↗
                  </a>
                }
              />
            )}
          </div>

          <div>
            <div className="text-section" style={{ marginBottom: 10 }}>Event history</div>
            <div>
              {events.map((ev, i) => (
                <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 0, paddingBottom: 18, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span
                      className="status-dot"
                      style={{ background: i === 0 ? statusColor(entry.reason) : `rgba(233,233,237,${0.35 - i * 0.05})`, marginTop: 3 }}
                    />
                    {i < events.length - 1 && <span style={{ flex: 1, width: 1, background: 'var(--row-rule)', marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingLeft: 12 }}>
                    <div className="text-table">{eventLabel(ev.type)}</div>
                    {ev.detail && <div className="text-caption muted">{ev.detail}</div>}
                    <div className="text-caption faint">{formatTimestamp(ev.occurred_at)} · {ev.actor}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isOps ? (
              <>
                <Button variant="primary" onClick={handleUnsuppress} disabled={busy || entry.reason === 'global_blocklist'}>
                  Remove from suppression list
                </Button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button variant="secondary" onClick={handleRevalidate} disabled={busy} style={{ flex: 1 }}>
                    Re-validate
                  </Button>
                  <Button variant="secondary" onClick={() => setAddingNote((v) => !v)} disabled={busy} style={{ flex: 1 }}>
                    Add note
                  </Button>
                </div>
                {addingNote && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note…" />
                    <Button variant="primary" dense onClick={handleAddNote} disabled={busy}>
                      Save
                    </Button>
                  </div>
                )}
                <p className="text-caption faint">
                  Removing an address only affects lists in this workspace. Global blocklist entries cannot be removed.
                </p>
              </>
            ) : (
              <>
                <Button variant="primary" icon={<PaperPlaneTilt size={16} />} onClick={handleAskReview} disabled={busy}>
                  Ask ops to review this entry
                </Button>
                <p className="text-caption faint">
                  Reps can&rsquo;t un-suppress. Ops reviews requests daily — you&rsquo;ll get a note either way.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}

function Fact({ label, value, mono }) {
  return (
    <div>
      <div className="text-label-sm">{label}</div>
      <div className={mono ? 'mono text-table' : 'text-table'}>{value}</div>
    </div>
  );
}
