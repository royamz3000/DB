const db = require('../db');
const { normalizeEmail, hasValidSyntax } = require('./emailValidation');

const VALID_TYPES = new Set(['bounced', 'unsubscribed']);

const upsertStmt = db.prepare(`
  INSERT INTO suppressions (email, type, source, reason, created_at, updated_at)
  VALUES (@email, @type, @source, @reason, datetime('now'), datetime('now'))
  ON CONFLICT (email, type) DO UPDATE SET
    source = excluded.source,
    reason = excluded.reason,
    updated_at = datetime('now')
`);

const findByEmailStmt = db.prepare('SELECT * FROM suppressions WHERE email = ?');

/**
 * Inserts or refreshes a single suppression record. Used by both the manual
 * CSV upload path and (later) any programmatic import, e.g. from a CRM API.
 */
function addSuppression({ email, type, source = 'manual', reason = null }) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: false, error: 'empty_email' };
  if (!VALID_TYPES.has(type)) return { ok: false, error: 'invalid_type' };
  if (!hasValidSyntax(normalized)) return { ok: false, error: 'invalid_syntax' };

  const existing = db.prepare('SELECT id FROM suppressions WHERE email = ? AND type = ?').get(normalized, type);
  upsertStmt.run({ email: normalized, type, source, reason });
  return { ok: true, email: normalized, wasDuplicate: Boolean(existing) };
}

/**
 * Bulk-inserts suppression records inside a single transaction, tallying
 * how many were newly added vs. already present vs. rejected for bad syntax.
 */
function addSuppressionsBulk(records, { type, source }) {
  let added = 0;
  let duplicates = 0;
  let invalid = 0;

  const run = db.transaction((rows) => {
    for (const row of rows) {
      const email = normalizeEmail(row.email);
      const reason = row.reason || null;
      if (!email || !hasValidSyntax(email)) {
        invalid += 1;
        continue;
      }
      const result = addSuppression({ email, type, source, reason });
      if (result.wasDuplicate) duplicates += 1;
      else added += 1;
    }
  });

  run(records);
  return { added, duplicates, invalid, total: records.length };
}

function recordImport({ filename, type, source, totalRows, addedCount, duplicateCount, invalidCount }) {
  db.prepare(`
    INSERT INTO imports (filename, type, source, total_rows, added_count, duplicate_count, invalid_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(filename, type, source, totalRows, addedCount, duplicateCount, invalidCount);
}

function getStatusForEmail(rawEmail) {
  const email = normalizeEmail(rawEmail);
  const rows = db.prepare('SELECT * FROM suppressions WHERE email = ?').all(email);
  const bounced = rows.find((r) => r.type === 'bounced') || null;
  const unsubscribed = rows.find((r) => r.type === 'unsubscribed') || null;
  return { email, bounced, unsubscribed };
}

function listSuppressions({ type, search, page = 1, pageSize = 50 } = {}) {
  const clauses = [];
  const params = {};

  if (type && VALID_TYPES.has(type)) {
    clauses.push('type = @type');
    params.type = type;
  }
  if (search) {
    clauses.push('email LIKE @search');
    params.search = `%${normalizeEmail(search)}%`;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM suppressions ${where}`).get(params).count;

  const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 500);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const rows = db.prepare(`
    SELECT * FROM suppressions ${where}
    ORDER BY updated_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  return { rows, total, page: Number(page) || 1, pageSize: limit };
}

function deleteSuppression(id) {
  const result = db.prepare('DELETE FROM suppressions WHERE id = ?').run(id);
  return result.changes > 0;
}

function listImports({ page = 1, pageSize = 25 } = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) AS count FROM imports').get().count;
  const rows = db.prepare('SELECT * FROM imports ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  return { rows, total, page: Number(page) || 1, pageSize: limit };
}

function getStats() {
  const bounced = db.prepare("SELECT COUNT(*) AS count FROM suppressions WHERE type = 'bounced'").get().count;
  const unsubscribed = db.prepare("SELECT COUNT(*) AS count FROM suppressions WHERE type = 'unsubscribed'").get().count;
  return { bounced, unsubscribed, total: bounced + unsubscribed };
}

module.exports = {
  addSuppression,
  addSuppressionsBulk,
  recordImport,
  getStatusForEmail,
  listSuppressions,
  deleteSuppression,
  listImports,
  getStats,
};
