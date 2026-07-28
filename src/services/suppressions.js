const db = require('../db');
const { normalizeEmail, hasValidSyntax } = require('./emailValidation');

const RISK_RANGES = {
  hard_bounce: [88, 99],
  soft_bounce: [45, 65],
  unsubscribed: [30, 50],
  spam_complaint: [90, 99],
  catch_all_risky: [55, 78],
  global_blocklist: [95, 100],
};

function riskScoreFor(reason) {
  const [min, max] = RISK_RANGES[reason] || [40, 60];
  return Math.round(min + Math.random() * (max - min));
}

const insertEntryStmt = db.prepare(`
  INSERT INTO suppression_entries (email, reason, list_id, risk_score, source, added_by, created_at, updated_at)
  VALUES (@email, @reason, @listId, @riskScore, @source, @addedBy, @createdAt, @createdAt)
  ON CONFLICT (email, list_id) DO UPDATE SET
    reason = excluded.reason,
    risk_score = excluded.risk_score,
    updated_at = datetime('now')
`);

const insertEventStmt = db.prepare(`
  INSERT INTO entry_events (entry_id, type, detail, actor, occurred_at) VALUES (?, ?, ?, ?, ?)
`);

/**
 * Adds (or refreshes) a single suppression entry and logs the "added" event.
 * Shared by manual add, bulk CSV import, and any future API-based import.
 */
function addEntry({ email, reason, listId, source = 'manual', addedBy = 'ops@workspace', createdAt, eventDetail, riskScoreOverride }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !hasValidSyntax(normalized)) return { ok: false, error: 'invalid_syntax' };

  const existing = db.prepare('SELECT id FROM suppression_entries WHERE email = ? AND list_id = ?').get(normalized, listId);
  const riskScore = riskScoreOverride ?? riskScoreFor(reason);
  const timestamp = createdAt || new Date().toISOString();

  const result = insertEntryStmt.run({
    email: normalized,
    reason,
    listId,
    riskScore,
    source,
    addedBy,
    createdAt: timestamp,
  });

  const entryId = existing ? existing.id : result.lastInsertRowid;
  if (!existing) {
    insertEventStmt.run(entryId, 'added', eventDetail || null, addedBy, timestamp);
  }

  return { ok: true, email: normalized, wasDuplicate: Boolean(existing), entryId };
}

/**
 * Bulk-inserts entries inside a single transaction (one WAL commit per chunk
 * instead of per row) — used by the async import job runner for large files.
 */
function addEntriesBulk(rows, { listId, source = 'upload', addedBy = 'ops@workspace' }) {
  let added = 0;
  let duplicates = 0;

  const run = db.transaction((items) => {
    for (const item of items) {
      const result = addEntry({ ...item, listId, source, addedBy });
      if (result.ok) {
        if (result.wasDuplicate) duplicates += 1;
        else added += 1;
      }
    }
  });
  run(rows);

  return { added, duplicates };
}

function findActiveEntry(email) {
  const normalized = normalizeEmail(email);
  return db.prepare(`
    SELECT e.*, l.name AS list_name, l.can_be_emptied
    FROM suppression_entries e JOIN lists l ON l.id = e.list_id
    WHERE e.email = ?
    ORDER BY CASE e.reason WHEN 'global_blocklist' THEN 0 ELSE 1 END, e.risk_score DESC
    LIMIT 1
  `).get(normalized);
}

function getEntryById(id) {
  return db.prepare(`
    SELECT e.*, l.name AS list_name, l.can_be_emptied
    FROM suppression_entries e JOIN lists l ON l.id = e.list_id
    WHERE e.id = ?
  `).get(id);
}

function getEventsForEntry(id) {
  return db.prepare('SELECT * FROM entry_events WHERE entry_id = ? ORDER BY occurred_at ASC').all(id);
}

function listEntries({ search, reasons, listId, page = 1, pageSize = 50 } = {}) {
  const clauses = [];
  const params = {};

  if (listId) {
    clauses.push('e.list_id = @listId');
    params.listId = listId;
  }
  if (search) {
    clauses.push('(e.email LIKE @search OR l.name LIKE @search)');
    params.search = `%${search.trim().toLowerCase()}%`;
  }

  const baseWhere = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const reasonCountRows = db.prepare(`
    SELECT e.reason, COUNT(*) AS count
    FROM suppression_entries e JOIN lists l ON l.id = e.list_id
    ${baseWhere}
    GROUP BY e.reason
  `).all(params);
  const reasonCounts = Object.fromEntries(reasonCountRows.map((r) => [r.reason, r.count]));

  const reasonClauses = [...clauses];
  if (reasons && reasons.length > 0) {
    const placeholders = reasons.map((_, i) => `@reason${i}`).join(', ');
    reasonClauses.push(`e.reason IN (${placeholders})`);
    reasons.forEach((r, i) => { params[`reason${i}`] = r; });
  }
  const where = reasonClauses.length ? `WHERE ${reasonClauses.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM suppression_entries e JOIN lists l ON l.id = e.list_id ${where}
  `).get(params).count;

  const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 500);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const rows = db.prepare(`
    SELECT e.*, l.name AS list_name, l.can_be_emptied
    FROM suppression_entries e JOIN lists l ON l.id = e.list_id
    ${where}
    ORDER BY e.created_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  return { rows, total, page: Number(page) || 1, pageSize: limit, reasonCounts };
}

function listEntriesForExport({ search, reasons, listId, scope } = {}) {
  const clauses = [];
  const params = {};
  if (listId) {
    clauses.push('e.list_id = @listId');
    params.listId = listId;
  }
  if (search) {
    clauses.push('(e.email LIKE @search OR l.name LIKE @search)');
    params.search = `%${search.trim().toLowerCase()}%`;
  }
  if (reasons && reasons.length > 0) {
    const placeholders = reasons.map((_, i) => `@reason${i}`).join(', ');
    clauses.push(`e.reason IN (${placeholders})`);
    reasons.forEach((r, i) => { params[`reason${i}`] = r; });
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`
    SELECT e.email, e.reason, l.name AS list_name, e.added_by, e.created_at, e.risk_score
    FROM suppression_entries e JOIN lists l ON l.id = e.list_id
    ${where}
    ORDER BY e.created_at DESC
  `).all(params);
}

function unsuppress(ids, actor = 'ops@workspace') {
  const rows = ids.map((id) => getEntryById(id)).filter(Boolean);
  const removable = rows.filter((r) => r.reason !== 'global_blocklist');
  const blocked = rows.length - removable.length;

  const del = db.transaction((entries) => {
    for (const entry of entries) {
      db.prepare('DELETE FROM suppression_entries WHERE id = ?').run(entry.id);
    }
  });
  del(removable);

  return { removedCount: removable.length, blockedCount: blocked };
}

function addNote(entryId, note, actor = 'ops@workspace') {
  insertEventStmt.run(entryId, 'note', note, actor, new Date().toISOString());
}

function requestReview(entryId, actor = 'sales@workspace') {
  insertEventStmt.run(entryId, 'review_requested', 'Flagged by a sales rep for ops review.', actor, new Date().toISOString());
}

function logEvent(entryId, type, detail, actor) {
  insertEventStmt.run(entryId, type, detail, actor, new Date().toISOString());
}

function getStats() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM suppression_entries').get().c;
  const addedThisWeek = db.prepare("SELECT COUNT(*) AS c FROM suppression_entries WHERE created_at >= datetime('now', '-7 days')").get().c;
  const reasonRows = db.prepare('SELECT reason, COUNT(*) AS count FROM suppression_entries GROUP BY reason').all();
  const reasonCounts = Object.fromEntries(reasonRows.map((r) => [r.reason, r.count]));
  return { total, addedThisWeek, reasonCounts };
}

module.exports = {
  riskScoreFor,
  addEntry,
  addEntriesBulk,
  findActiveEntry,
  getEntryById,
  getEventsForEntry,
  listEntries,
  listEntriesForExport,
  unsuppress,
  addNote,
  requestReview,
  logEvent,
  getStats,
};
