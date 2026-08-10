const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const db = require('../db');
const { stagingDir } = require('../db');
const { normalizeEmail, hasValidSyntax, checkEmailValidity } = require('./emailValidation');
const { addEntriesBulk, riskScoreFor } = require('./suppressions');
const { notifyWebhookIfEnabled } = require('./settings');

const reportsDir = path.join(__dirname, '..', '..', 'data', 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

const CHUNK_SIZE = 1000;

// Header hints cover both Constant Contact's space-separated export columns
// (e.g. "Email Address", "Bounce Reason") and underscored CRM-style exports
// (e.g. "email_address", "bounce_type"), since real files mix both styles.
const EMAIL_HEADER_HINTS = ['email', 'email_address', 'email address', 'e-mail', 'address'];
const REASON_HEADER_HINTS = [
  'reason', 'bounce_type', 'bounce type', 'bounce_reason', 'bounce reason',
  'suppression reason', 'suppression_reason', 'unsubscribe reason', 'unsubscribe_reason',
];
const DATE_HEADER_HINTS = [
  'date', 'event_date', 'event date', 'date added', 'date_added', 'added_at',
  'created_at', 'bounce date', 'bounce_date', 'unsubscribe date', 'unsubscribe_date',
];
const ADDED_BY_HEADER_HINTS = ['added_by', 'added by', 'user'];
const COMPANY_HEADER_HINTS = [
  'company', 'company_name', 'company name', 'account', 'account_name',
  'account name', 'organization', 'organization name', 'business', 'business name',
];
const LEAD_ID_HEADER_HINTS = [
  'lead_id', 'lead id', 'contact_id', 'contact id', 'salesforce_id',
  'sfid', 'crm_id', 'crm id', 'record_id', 'record id', 'id',
];
const PHONE_HEADER_HINTS = ['phone', 'phone_number', 'phone number', 'mobile', 'contact_phone', 'contact phone', 'work phone', 'cell'];
const CRM_OWNER_HEADER_HINTS = ['owner', 'sales_rep', 'sales rep', 'account_owner', 'account owner', 'rep', 'assigned to', 'assigned_to'];
const CRM_URL_HEADER_HINTS = ['record_url', 'record url', 'salesforce_url', 'crm_url', 'crm url', 'link', 'url', 'profile url'];
const FIRST_NAME_HEADER_HINTS = ['first_name', 'first name', 'firstname', 'fname', 'first', 'given name', 'given_name'];
const LAST_NAME_HEADER_HINTS = ['last_name', 'last name', 'lastname', 'lname', 'last', 'surname', 'family name', 'family_name'];
const SOURCE_HEADER_HINTS = ['source', 'origin', 'provider', 'list source', 'data source', 'data_source', 'lead source', 'lead_source'];

const FILE_KIND_DEFAULT_REASON = {
  bounced: 'hard_bounce',
  unsubscribes: 'unsubscribed',
  spam_complaints: 'spam_complaint',
  do_not_contact: 'global_blocklist',
};

function detectDelimiter(headerLine) {
  const tabCount = (headerLine.match(/\t/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return tabCount > commaCount ? '\t' : ',';
}

function splitLine(line, delimiter) {
  return line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
}

function inferReasonFromText(text, fallback) {
  const t = (text || '').toLowerCase();
  if (!t) return fallback;
  if (t.includes('hard')) return 'hard_bounce';
  if (t.includes('soft')) return 'soft_bounce';
  if (t.includes('unsub')) return 'unsubscribed';
  if (t.includes('complaint') || t.includes('spam')) return 'spam_complaint';
  if (t.includes('risky') || t.includes('catch')) return 'catch_all_risky';
  if (t.includes('block')) return 'global_blocklist';
  return fallback;
}

function stagingPathFor(id) {
  return path.join(stagingDir, id);
}

function newStagingId(originalName) {
  const ext = path.extname(originalName) || '.csv';
  return `${crypto.randomBytes(12).toString('hex')}${ext}`;
}

async function previewStagedFile(stagingId) {
  const stagedPath = stagingPathFor(stagingId);
  const stats = fs.statSync(stagedPath);
  const rl = readline.createInterface({ input: fs.createReadStream(stagedPath, { encoding: 'utf8' }), crlfDelay: Infinity });

  let header = null;
  let delimiter = ',';
  const sampleRows = [];
  let rowCount = 0;

  for await (const line of rl) {
    if (line.trim() === '') continue;
    if (!header) {
      delimiter = detectDelimiter(line);
      header = splitLine(line, delimiter);
      continue;
    }
    rowCount += 1;
    if (sampleRows.length < 5) sampleRows.push(splitLine(line, delimiter));
  }

  const columns = (header || []).map((name, index) => ({
    index,
    name,
    samples: sampleRows.map((row) => row[index] || ''),
  }));

  const usedIndexes = new Set();
  const normalizedHeaders = (header || []).map((h) => normalizeHeader(h));

  // Smarter matching: normalize headers (lowercase, strip spaces/punctuation)
  // and score each against a field's hints — exact normalized match beats a
  // substring match. Each column is only claimed by one field, best-fit first,
  // so "email" and "email domain" don't both grab the email slot.
  const guess = (hints) => {
    const normHints = hints.map(normalizeHeader);
    let best = { idx: -1, score: 0 };
    normalizedHeaders.forEach((h, idx) => {
      if (usedIndexes.has(idx) || !h) return;
      let score = 0;
      if (normHints.includes(h)) score = 3;
      else if (normHints.some((hint) => h === hint || h.startsWith(hint) || hint.startsWith(h))) score = 2;
      else if (normHints.some((hint) => hint.length >= 4 && (h.includes(hint) || hint.includes(h)))) score = 1;
      if (score > best.score) best = { idx, score };
    });
    if (best.idx === -1) return null;
    usedIndexes.add(best.idx);
    return best.idx;
  };

  // Claim the most specific fields first so generic hints (e.g. "id", "url")
  // don't steal a column a more specific field wants.
  const emailCol = guess(EMAIL_HEADER_HINTS);
  const firstNameCol = guess(FIRST_NAME_HEADER_HINTS);
  const lastNameCol = guess(LAST_NAME_HEADER_HINTS);
  const reasonCol = guess(REASON_HEADER_HINTS);
  const companyCol = guess(COMPANY_HEADER_HINTS);
  const phoneCol = guess(PHONE_HEADER_HINTS);
  const sourceCol = guess(SOURCE_HEADER_HINTS);
  const crmOwnerCol = guess(CRM_OWNER_HEADER_HINTS);
  const leadIdCol = guess(LEAD_ID_HEADER_HINTS);
  const crmUrlCol = guess(CRM_URL_HEADER_HINTS);
  const dateCol = guess(DATE_HEADER_HINTS);
  const addedByCol = guess(ADDED_BY_HEADER_HINTS);

  return {
    sizeBytes: stats.size,
    rowCount,
    columns,
    guessedMapping: {
      emailCol, reasonCol, dateCol, addedByCol, companyCol, leadIdCol,
      phoneCol, crmOwnerCol, crmUrlCol, firstNameCol, lastNameCol, sourceCol,
    },
  };
}

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function createJobRecord({ filename, listId, fileKind, defaultReason, validateSyntax, totalRows }) {
  const result = db.prepare(`
    INSERT INTO import_jobs (filename, list_id, file_kind, default_reason, validate_syntax, total_rows)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(filename, listId, fileKind, defaultReason, validateSyntax ? 1 : 0, totalRows);
  return result.lastInsertRowid;
}

function getJob(id) {
  return db.prepare(`
    SELECT j.*, l.name AS list_name
    FROM import_jobs j JOIN lists l ON l.id = j.list_id
    WHERE j.id = ?
  `).get(id);
}

function listJobs({ page = 1, pageSize = 25 } = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) AS c FROM import_jobs').get().c;
  const rows = db.prepare(`
    SELECT j.*, l.name AS list_name
    FROM import_jobs j JOIN lists l ON l.id = j.list_id
    ORDER BY j.started_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return { rows, total, page: Number(page) || 1, pageSize: limit };
}

function updateProgress(jobId, patch) {
  const fields = Object.keys(patch).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE import_jobs SET ${fields} WHERE id = @id`).run({ id: jobId, ...patch });
}

function writeSkippedReport(jobId, skippedRows) {
  if (skippedRows.length === 0) return null;
  const relPath = `job-${jobId}-skipped.csv`;
  const lines = ['email,reason_skipped', ...skippedRows.map((r) => `"${(r.email || '').replace(/"/g, '""')}",${r.reasonSkipped}`)];
  fs.writeFileSync(path.join(reportsDir, relPath), lines.join('\n'));
  return relPath;
}

function skippedReportPath(relPath) {
  return path.join(reportsDir, relPath);
}

async function startImportJob(jobId, {
  emailCol, reasonCol, listId, defaultReason, validateSyntax, filename,
  companyCol, leadIdCol, phoneCol, crmOwnerCol, crmUrlCol,
  firstNameCol, lastNameCol, sourceCol,
}) {
  const startedAt = Date.now();
  const stagedPath = path.join(stagingDir, `job-${jobId}${path.extname(filename) || '.csv'}`);

  let processed = 0;
  let suppressed = 0;
  let duplicates = 0;
  let invalid = 0;
  let blank = 0;
  const skippedRows = [];
  let chunkBuffer = [];

  const flush = () => {
    if (chunkBuffer.length === 0) return;
    const { added, duplicates: dupes } = addEntriesBulk(chunkBuffer, { listId, source: 'upload', addedBy: 'ops@workspace' });
    suppressed += added;
    duplicates += dupes;
    chunkBuffer = [];
  };

  try {
    const rl = readline.createInterface({ input: fs.createReadStream(stagedPath, { encoding: 'utf8' }), crlfDelay: Infinity });
    let isHeader = true;
    let delimiter = ',';

    for await (const line of rl) {
      if (isHeader) {
        delimiter = detectDelimiter(line);
        isHeader = false;
        continue;
      }
      if (line.trim() === '') {
        blank += 1;
        processed += 1;
        continue;
      }

      const cols = splitLine(line, delimiter);
      const rawEmail = cols[emailCol] ?? '';
      const email = normalizeEmail(rawEmail);
      processed += 1;

      if (!email || !hasValidSyntax(email)) {
        invalid += 1;
        skippedRows.push({ email: rawEmail, reasonSkipped: 'invalid_syntax' });
      } else {
        const rawReasonText = reasonCol != null ? cols[reasonCol] : null;
        const reason = inferReasonFromText(rawReasonText, defaultReason);
        let riskScoreOverride = riskScoreFor(reason);

        if (validateSyntax) {
          const validity = await checkEmailValidity(email);
          if (!validity.hasMailServer) riskScoreOverride = 99;
        }

        const rowSource = sourceCol != null ? (cols[sourceCol] || null) : null;
        chunkBuffer.push({
          email,
          reason,
          riskScoreOverride,
          ...(rowSource ? { source: rowSource } : {}),
          firstName: firstNameCol != null ? (cols[firstNameCol] || null) : null,
          lastName: lastNameCol != null ? (cols[lastNameCol] || null) : null,
          companyName: companyCol != null ? (cols[companyCol] || null) : null,
          leadId: leadIdCol != null ? (cols[leadIdCol] || null) : null,
          phone: phoneCol != null ? (cols[phoneCol] || null) : null,
          crmOwner: crmOwnerCol != null ? (cols[crmOwnerCol] || null) : null,
          crmRecordUrl: crmUrlCol != null ? (cols[crmUrlCol] || null) : null,
        });
      }

      if (processed % CHUNK_SIZE === 0) {
        flush();
        updateProgress(jobId, {
          processed_rows: processed,
          suppressed_count: suppressed,
          duplicate_count: duplicates,
          invalid_count: invalid,
          blank_count: blank,
        });
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    flush();
    const skippedPath = writeSkippedReport(jobId, skippedRows.slice(0, 50000));

    updateProgress(jobId, {
      status: 'complete',
      processed_rows: processed,
      suppressed_count: suppressed,
      duplicate_count: duplicates,
      invalid_count: invalid,
      blank_count: blank,
      skipped_report_path: skippedPath,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
    });

    fs.unlink(stagedPath, () => {});

    const job = getJob(jobId);
    notifyWebhookIfEnabled({
      event: 'import.completed',
      jobId,
      filename: job.filename,
      list: job.list_name,
      suppressed,
      duplicates,
      invalid,
      blank,
    }).catch(() => {});
  } catch (err) {
    updateProgress(jobId, { status: 'failed', error_message: err.message, finished_at: new Date().toISOString() });
  }
}

module.exports = {
  stagingPathFor,
  newStagingId,
  previewStagedFile,
  createJobRecord,
  getJob,
  listJobs,
  startImportJob,
  skippedReportPath,
  FILE_KIND_DEFAULT_REASON,
};
