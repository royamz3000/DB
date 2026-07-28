import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CloudArrowUp, FileCsv, CheckCircle, Spinner, WarningCircle, DownloadSimple,
} from '@phosphor-icons/react';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Stepper from '../../components/Stepper';
import RadioCard from '../../components/RadioCard';
import CheckboxRow from '../../components/Checkbox';
import ProgressBar from '../../components/ProgressBar';
import { SelectField } from '../../components/Field';
import { useLists } from '../../context/ListsContext';
import { usePolling } from '../../hooks/usePolling';
import { stageFile, createImportJob, fetchJob, skippedReportUrl } from '../../api/jobs';
import { cx } from '../../lib/cx';
import './UploadWizard.css';

const STEP_LABELS = ['Choose file', 'Map columns', 'Import & review'];

const FILE_KIND_OPTIONS = [
  { value: 'bounced', label: 'Bounced addresses', defaultReason: 'hard_bounce' },
  { value: 'unsubscribes', label: 'Unsubscribes, opt-outs', defaultReason: 'unsubscribed' },
  { value: 'spam_complaints', label: 'Spam complaints', defaultReason: 'spam_complaint' },
  { value: 'do_not_contact', label: 'Do-not-contact (manual)', defaultReason: 'global_blocklist' },
];

const MAP_TARGETS = [
  { value: 'email', label: 'Email address' },
  { value: 'reason', label: 'Suppression reason' },
  { value: 'date', label: 'Date added' },
  { value: 'added_by', label: 'Added by' },
  { value: 'note', label: 'Note' },
  { value: 'ignore', label: '— ignore —' },
];

const REASON_OPTIONS = [
  { value: 'hard_bounce', label: 'Hard bounce' },
  { value: 'soft_bounce', label: 'Soft bounce' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'spam_complaint', label: 'Spam complaint' },
  { value: 'catch_all_risky', label: 'Catch-all / risky' },
  { value: 'global_blocklist', label: 'Global blocklist' },
];

export default function UploadWizard() {
  const { lists, refreshLists } = useLists();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [staging, setStaging] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [listId, setListId] = useState('');
  const [fileKind, setFileKind] = useState('bounced');
  const [columnMapping, setColumnMapping] = useState({});
  const [defaultReason, setDefaultReason] = useState('hard_bounce');
  const [validateSyntax, setValidateSyntax] = useState(true);
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (listId) return;
    const preset = location.state?.presetListId;
    if (preset) setListId(String(preset));
    else if (lists.length > 0) setListId(String(lists[0].id));
  }, [lists, listId, location.state]);

  useEffect(() => {
    const kind = FILE_KIND_OPTIONS.find((k) => k.value === fileKind);
    if (kind) setDefaultReason(kind.defaultReason);
  }, [fileKind]);

  const handleFile = async (file) => {
    if (!file) return;
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      setUploadError('Please choose a CSV, TSV, or TXT file.');
      return;
    }
    setUploadError('');
    try {
      const result = await stageFile(file);
      setStaging(result);
      const initialMapping = {};
      result.columns.forEach((col) => {
        if (col.index === result.guessedMapping.emailCol) initialMapping[col.index] = 'email';
        else if (col.index === result.guessedMapping.reasonCol) initialMapping[col.index] = 'reason';
        else if (col.index === result.guessedMapping.dateCol) initialMapping[col.index] = 'date';
        else if (col.index === result.guessedMapping.addedByCol) initialMapping[col.index] = 'added_by';
        else initialMapping[col.index] = 'ignore';
      });
      setColumnMapping(initialMapping);
      setStep(1);
    } catch (err) {
      setUploadError(err.message);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const startImport = async () => {
    const emailCol = Number(Object.keys(columnMapping).find((k) => columnMapping[k] === 'email'));
    const reasonColKey = Object.keys(columnMapping).find((k) => columnMapping[k] === 'reason');

    const { jobId: newJobId } = await createImportJob({
      stagingId: staging.stagingId,
      filename: staging.filename,
      listId,
      fileKind,
      mapping: { emailCol, reasonCol: reasonColKey !== undefined ? Number(reasonColKey) : null },
      validateSyntax,
      defaultReason,
      totalRows: staging.rowCount,
    });
    setJobId(newJobId);
    setStep(2);
    refreshLists();
  };

  usePolling(
    () => fetchJob(jobId).then(setJob),
    1200,
    Boolean(jobId) && job?.status !== 'complete' && job?.status !== 'failed',
  );

  useEffect(() => {
    if (jobId) fetchJob(jobId).then(setJob);
  }, [jobId]);

  useEffect(() => {
    if (job?.status === 'complete') refreshLists();
  }, [job?.status]);

  const hasEmailMapped = Object.values(columnMapping).includes('email');

  return (
    <>
      <PageHeader
        kicker="Upload lists"
        title="Upload a bounce or unsubscribe list"
        subtitle="Drop a file, map its columns, and everything in it is suppressed for good. Files of any size — big ones process in the background."
      />

      <div className="wizard-wrap">
        <Stepper steps={STEP_LABELS} currentIndex={step} />

        {step === 0 && (
          <div className="upload-step1-grid">
            <div
              className={cx('dropzone', dragging && 'is-dragging')}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <CloudArrowUp size={42} weight="regular" style={{ color: 'var(--accent)' }} />
              <div className="text-panel">Drop a CSV, TSV or TXT file here</div>
              <p className="text-caption muted" style={{ maxWidth: '44ch' }}>
                Up to 5 million rows per file. Large files process in the background — you&rsquo;ll get an email and a webhook when they&rsquo;re done.
              </p>
              <Button variant="primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                Choose file
              </Button>
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
              <a className="text-caption" style={{ color: 'var(--accent)' }} href="/check" onClick={(e) => { e.stopPropagation(); navigate('/check'); e.preventDefault(); }}>
                or paste addresses on the check page
              </a>
              {uploadError && <p className="text-caption" style={{ color: 'oklch(0.66 0.125 25)' }}>{uploadError}</p>}
            </div>

            <Card>
              <SelectField label="Destination list" value={listId} onChange={(e) => setListId(e.target.value)}>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </SelectField>

              <div style={{ marginTop: 18 }}>
                <div className="field-label" style={{ marginBottom: 8 }}>What is in this file?</div>
                {FILE_KIND_OPTIONS.map((opt) => (
                  <RadioCard
                    key={opt.value}
                    name="fileKind"
                    label={opt.label}
                    selected={fileKind === opt.value}
                    onSelect={() => setFileKind(opt.value)}
                  />
                ))}
              </div>

              <hr className="rule" style={{ margin: '16px 0 10px' }} />
              <p className="text-caption faint">
                Addresses already on this list are skipped, not duplicated. Nothing is ever sent to the addresses you upload.
              </p>
            </Card>
          </div>
        )}

        {step === 1 && staging && (
          <Card>
            <div className="file-chip">
              <FileCsv size={22} style={{ color: 'var(--accent)' }} />
              <div style={{ flex: 1 }}>
                <div className="text-table">{staging.filename}</div>
                <div className="text-caption muted">
                  {staging.rowCount.toLocaleString()} rows · {staging.columns.length} columns · {(staging.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>
              <Button variant="secondary" dense onClick={() => setStep(0)}>Replace</Button>
            </div>

            <h2 className="text-section">Map your columns</h2>
            <p className="text-caption muted" style={{ marginTop: 4 }}>
              We matched {Object.values(columnMapping).filter((v) => v !== 'ignore').length} of {staging.columns.length} automatically. Anything left unmapped is ignored.
            </p>

            <table className="mapping-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Column in file</th>
                  <th style={{ width: '30%' }}>Maps to</th>
                  <th>Sample values</th>
                </tr>
              </thead>
              <tbody>
                {staging.columns.map((col) => (
                  <tr key={col.index}>
                    <td className="mono text-table">{col.name}</td>
                    <td>
                      <span className="select-wrap" style={{ width: '100%' }}>
                        <select
                          className="select"
                          value={columnMapping[col.index] || 'ignore'}
                          onChange={(e) => setColumnMapping((prev) => ({ ...prev, [col.index]: e.target.value }))}
                        >
                          {MAP_TARGETS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </span>
                    </td>
                    <td className="text-secondary faint" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                      {col.samples.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginTop: 6, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
                <SelectField label="Default suppression reason" value={defaultReason} onChange={(e) => setDefaultReason(e.target.value)}>
                  {REASON_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </SelectField>
                <p className="text-caption faint" style={{ maxWidth: 220 }}>Used for rows with no reason column.</p>
              </div>
              <CheckboxRow
                checked={validateSyntax}
                onChange={(e) => setValidateSyntax(e.target.checked)}
                label="Also run syntax + domain validation on every row"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button variant="secondary" onClick={() => setStep(0)}>Cancel</Button>
              <Button variant="primary" disabled={!hasEmailMapped} onClick={startImport}>
                Import {staging.rowCount.toLocaleString()} rows
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && job && <Step3Progress job={job} navigate={navigate} setStep={setStep} setStaging={setStaging} setJobId={setJobId} setJob={setJob} />}
      </div>
    </>
  );
}

function Step3Progress({ job, navigate, setStep, setStaging, setJobId, setJob }) {
  const isDone = job.status === 'complete';
  const isFailed = job.status === 'failed';
  const skippedTotal = job.duplicate_count + job.invalid_count + job.blank_count;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="job-card">
        <div className="job-card-head">
          {isFailed ? (
            <WarningCircle size={24} style={{ color: 'oklch(0.66 0.125 25)' }} />
          ) : isDone ? (
            <CheckCircle size={24} style={{ color: 'var(--accent)' }} />
          ) : (
            <Spinner size={24} className="spin" style={{ color: 'var(--accent)' }} />
          )}
          <div>
            <div className="text-panel">{isFailed ? 'Import failed' : isDone ? 'Import complete' : 'Importing…'}</div>
            <div className="text-caption muted">
              {job.filename} · {isFailed ? job.error_message : isDone
                ? `${job.processed_rows.toLocaleString()} rows processed in ${Math.round((job.duration_ms || 0) / 1000)}s`
                : `processing ${job.total_rows.toLocaleString()} rows`}
            </div>
          </div>
          {!isFailed && <span className="job-card-percent">{job.percent}%</span>}
        </div>
        {!isFailed && <ProgressBar percent={job.percent} />}
      </div>

      {isDone && (
        <>
          <div className="result-stat-grid">
            <ResultStat color="oklch(0.66 0.125 25)" label="Suppressed" value={job.suppressed_count} note="new entries added" />
            <ResultStat color="rgba(233,233,237,.5)" label="Already listed" value={job.duplicate_count} note="skipped as duplicates" />
            <ResultStat color="oklch(0.66 0.125 70)" label="Invalid syntax" value={job.invalid_count} note="could not be parsed" />
            <ResultStat color="oklch(0.66 0.125 155)" label="Blank rows" value={job.blank_count} note="skipped, no address" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button variant="primary" onClick={() => navigate(`/suppressions`)}>View in suppression list</Button>
            </div>
            <Button variant="secondary" onClick={() => { setStep(0); setStaging(null); setJobId(null); setJob(null); }}>
              Import another file
            </Button>
          </div>

          {skippedTotal > 0 && (
            <div className="notice">
              <WarningCircle size={18} />
              <div>
                <p>
                  {skippedTotal.toLocaleString()} rows were skipped: {job.duplicate_count.toLocaleString()} duplicates already on this list, {job.invalid_count.toLocaleString()} malformed addresses, {job.blank_count.toLocaleString()} blank rows.
                </p>
                {job.skipped_report_path && (
                  <a href={skippedReportUrl(job.id)} style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <DownloadSimple size={14} /> Download the skipped-rows report
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultStat({ color, label, value, note }) {
  return (
    <div className="result-stat-card">
      <div className="text-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="status-dot" style={{ background: color }} /> {label}
      </div>
      <div className="result-stat-value">{value.toLocaleString()}</div>
      <div className="text-caption muted">{note}</div>
    </div>
  );
}
