import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, DownloadSimple, ArrowsClockwise } from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import { fetchRecentChecks, recheckBatch, cleanExportUrl } from '../../api/checks';
import { useToast } from '../../context/ToastContext';
import './MyRecentChecks.css';

export default function MyRecentChecks() {
  const [data, setData] = useState({ rows: [] });
  const navigate = useNavigate();
  const showToast = useToast();

  useEffect(() => {
    fetchRecentChecks({ pageSize: 30 }).then(setData);
  }, []);

  const handleRecheck = async (batch) => {
    showToast(`Re-running "${batch.name}" — 1 of 1 batches`);
    const result = await recheckBatch(batch.id);
    navigate('/check', { state: { batch: result } });
  };

  return (
    <>
      <PageHeader
        kicker="My recent checks"
        title="My recent checks"
        subtitle="Every batch you have checked in the last 30 days. Re-run one if the list has aged, or download the clean version again."
      />

      <Card>
        <DataTable
          emptyMessage="No checks yet."
          rowKey={(r) => r.id}
          rows={data.rows}
          columns={[
            { key: 'batch', header: 'Batch', width: '1.6fr', render: (r) => (
              <span className="checks-row-name">
                <span className="text-table">{r.name}</span>
                <span className="text-caption faint">{new Date(r.created_at).toLocaleString()}</span>
              </span>
            ) },
            { key: 'source', header: 'Source', width: '.9fr', render: (r) => (r.source === 'pasted' ? 'Pasted' : r.source) },
            { key: 'checked', header: 'Checked', width: '.7fr', render: (r) => r.total_count.toLocaleString() },
            { key: 'flagged', header: 'Flagged', width: '.8fr', render: (r) => (
              <span>
                <span style={{ color: 'oklch(0.66 0.125 25)' }}>{r.flagged_count.toLocaleString()}</span>{' '}
                <span className="text-caption faint">{r.total_count ? Math.round((r.flagged_count / r.total_count) * 100) : 0}%</span>
              </span>
            ) },
            { key: 'actions', header: '', width: '190px', render: (r) => (
              <div className="checks-actions">
                <Button variant="secondary" dense icon={<DownloadSimple size={13} />} onClick={() => window.open(cleanExportUrl(r.id), '_blank')}>
                  Clean list
                </Button>
                <Button variant="primary" dense icon={<ArrowsClockwise size={13} />} onClick={() => handleRecheck(r)}>
                  Re-check
                </Button>
              </div>
            ) },
          ]}
        />
      </Card>

      <div className="notice notice-footer">
        <Info size={18} />
        <p>
          Lists older than two weeks are worth re-checking — about 2% of a cold list goes stale every month. Batches are kept for 30 days, then only the counts remain.
        </p>
      </div>
    </>
  );
}
