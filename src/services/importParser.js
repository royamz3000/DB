const { parse } = require('csv-parse/sync');

const EMAIL_HEADER_NAMES = ['email', 'email address', 'e-mail', 'address'];
const REASON_HEADER_NAMES = ['reason', 'bounce_reason', 'bounce reason', 'bouncereason'];

/**
 * Parses an uploaded CSV/TSV file into { email, reason } rows.
 * Looks for an "email" column by header name; if no header is recognized,
 * falls back to treating the first column of every row as the email.
 */
function parseCsvBuffer(buffer) {
  const text = buffer.toString('utf8');
  const records = parse(text, {
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  if (records.length === 0) return [];

  const firstRow = records[0].map((cell) => String(cell).trim().toLowerCase());
  const emailColIdx = firstRow.findIndex((cell) => EMAIL_HEADER_NAMES.includes(cell));
  const reasonColIdx = firstRow.findIndex((cell) => REASON_HEADER_NAMES.includes(cell));

  const hasHeader = emailColIdx !== -1;
  const dataRows = hasHeader ? records.slice(1) : records;
  const emailIdx = hasHeader ? emailColIdx : 0;

  return dataRows
    .map((row) => ({
      email: (row[emailIdx] || '').trim(),
      reason: reasonColIdx !== -1 ? (row[reasonColIdx] || '').trim() || null : null,
    }))
    .filter((row) => row.email.length > 0);
}

/**
 * Parses freeform pasted text (one email per line, or comma/semicolon/
 * whitespace separated) into { email, reason: null } rows.
 */
function parsePastedText(text) {
  return String(text || '')
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((email) => ({ email, reason: null }));
}

/**
 * Parses an uploaded file for the lookup tool (CSV with an email column,
 * or a plain .txt list) into a flat array of email strings.
 */
function parseUploadedEmailFile(buffer, filename = '') {
  if (/\.csv$/i.test(filename)) {
    return parseCsvBuffer(buffer).map((r) => r.email);
  }
  return parsePastedText(buffer.toString('utf8'));
}

module.exports = { parseCsvBuffer, parsePastedText, parseUploadedEmailFile };
