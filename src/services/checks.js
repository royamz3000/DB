const db = require('../db');
const { checkEmailValidity, normalizeEmail } = require('./emailValidation');
const { findActiveEntry } = require('./suppressions');

const MAX_BATCH = 5000;
const CONCURRENCY = 25;

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    const i = nextIndex++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    return runNext();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
  return results;
}

async function evaluateAddress(rawEmail, deepCheck) {
  const email = normalizeEmail(rawEmail);
  const suppression = findActiveEntry(email);

  if (suppression) {
    return {
      email,
      verdict: 'suppressed_or_invalid',
      reason: suppression.reason,
      listName: suppression.list_name,
      riskScore: suppression.risk_score,
      entryId: suppression.id,
    };
  }

  if (!deepCheck) {
    return { email, verdict: 'deliverable', reason: 'clean', listName: null, riskScore: 5, entryId: null };
  }

  const validity = await checkEmailValidity(email);
  if (!validity.validSyntax) {
    return { email, verdict: 'suppressed_or_invalid', reason: 'invalid_syntax', listName: null, riskScore: 100, entryId: null };
  }
  if (!validity.hasMailServer) {
    return { email, verdict: 'suppressed_or_invalid', reason: 'invalid_domain', listName: null, riskScore: 95, entryId: null };
  }
  return { email, verdict: 'deliverable', reason: 'clean', listName: null, riskScore: 5, entryId: null };
}

async function runBatch(rawEmails, { deepCheck = true, name, source = 'pasted' } = {}) {
  const emails = [...new Set(rawEmails.map(normalizeEmail).filter(Boolean))].slice(0, MAX_BATCH);
  const results = await mapWithConcurrency(emails, CONCURRENCY, (email) => evaluateAddress(email, deepCheck));

  const flaggedCount = results.filter((r) => r.verdict === 'suppressed_or_invalid').length;
  const batchName = name || (source === 'pasted' ? 'Pasted batch' : source);

  const insertBatch = db.prepare(`
    INSERT INTO check_batches (name, source, deep_check, total_count, flagged_count)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertResult = db.prepare(`
    INSERT INTO check_batch_results (batch_id, email, verdict, reason, list_name, risk_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const batchId = db.transaction(() => {
    const info = insertBatch.run(batchName, source, deepCheck ? 1 : 0, results.length, flaggedCount);
    for (const r of results) {
      insertResult.run(info.lastInsertRowid, r.email, r.verdict, r.reason, r.listName, r.riskScore);
    }
    return info.lastInsertRowid;
  })();

  return { batchId, results, checked: results.length, flaggedCount, truncated: rawEmails.length > results.length };
}

function listBatches({ page = 1, pageSize = 25 } = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const total = db.prepare("SELECT COUNT(*) AS c FROM check_batches WHERE created_at >= datetime('now', '-30 days')").get().c;
  const rows = db.prepare(`
    SELECT * FROM check_batches WHERE created_at >= datetime('now', '-30 days')
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
  return { rows, total, page: Number(page) || 1, pageSize: limit };
}

function getBatch(id) {
  const batch = db.prepare('SELECT * FROM check_batches WHERE id = ?').get(id);
  if (!batch) return null;
  const results = db.prepare('SELECT * FROM check_batch_results WHERE batch_id = ?').all(id);
  return { batch, results };
}

module.exports = { runBatch, listBatches, getBatch, evaluateAddress, MAX_BATCH };
