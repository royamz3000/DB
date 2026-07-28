const db = require('../db');
const { addEntry } = require('./suppressions');

const DOMAINS = ['northgate.io', 'meridianworks.com', 'brightfield.co', 'lumenpartners.com', 'atlascorp.net', 'summitware.io', 'harbortech.com', 'vertexlabs.co'];
const FIRST = ['maria', 'james', 'ava', 'noah', 'liam', 'sofia', 'ethan', 'mia', 'lucas', 'grace', 'daniel', 'ruth', 'omar', 'priya', 'wei', 'ines'];
const LAST = ['chen', 'ortiz', 'nguyen', 'patel', 'kowalski', 'mensah', 'silva', 'novak', 'haddad', 'romero'];
const COMPANIES = ['Northgate Inc.', 'Meridian Works', 'Brightfield Co.', 'Lumen Partners', 'Atlas Corp', 'Summitware', 'Harbor Tech', 'Vertex Labs'];
const REPS = ['Jordan Lee', 'Casey Kim', 'Taylor Brooks', 'Morgan Reyes'];

function pick(arr, n) {
  return arr[n % arr.length];
}

function fakeEmail(seed) {
  const first = pick(FIRST, seed);
  const last = pick(LAST, seed * 7 + 3);
  const domain = pick(DOMAINS, seed * 13 + 5);
  return `${first}.${last}${seed % 97}@${domain}`;
}

// Modeled on a typical Constant Contact contact export, since that's the
// primary import source — a numeric contact id and a link back to the
// contact's page rather than a Salesforce-style lead id/URL.
function fakeCrmFields(seed) {
  if (seed % 5 === 0) return { companyName: null, leadId: null, phone: null, crmOwner: null, crmRecordUrl: null };
  const contactId = String(10000000 + ((seed * 9301 + 49297) % 9000000));
  return {
    companyName: pick(COMPANIES, seed * 3 + 1),
    leadId: contactId,
    phone: `+1-555-${String(100 + (seed * 7) % 900).padStart(3, '0')}-${String(1000 + (seed * 13) % 9000).padStart(4, '0')}`,
    crmOwner: pick(REPS, seed * 5 + 2),
    crmRecordUrl: `https://app.constantcontact.com/pages/contacts/details/${contactId}`,
  };
}

function daysAgo(n, hh = 9, mm = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

function seedLists() {
  const insert = db.prepare(`
    INSERT INTO lists (name, kind, description, can_be_emptied) VALUES (?, ?, ?, ?)
  `);
  insert.run('Global bounces', 'system', 'Every hard bounce and complaint from all sending domains. Written to automatically by the ESP webhook.', 1);
  insert.run('Unsubscribes', 'system', 'Opt-outs and one-click unsubscribes. Legally required — cannot be emptied.', 0);
  insert.run('Outbound prospecting', 'manual', 'Cold-outreach exclusions: competitors, do-not-contact requests, spam traps found by the sales team.', 1);
  insert.run('Q3 campaign holdout', 'manual', 'Temporary suppression for the accounts in the enterprise pilot. Expires 30 Sep 2026.', 1);

  return Object.fromEntries(db.prepare('SELECT id, name FROM lists').all().map((l) => [l.name, l.id]));
}

const REASON_POOL = ['hard_bounce', 'hard_bounce', 'soft_bounce', 'unsubscribed', 'spam_complaint', 'catch_all_risky', 'global_blocklist'];

function seedEntries(listIds) {
  const listByReason = {
    hard_bounce: listIds['Global bounces'],
    soft_bounce: listIds['Global bounces'],
    spam_complaint: listIds['Global bounces'],
    catch_all_risky: listIds['Outbound prospecting'],
    unsubscribed: listIds['Unsubscribes'],
    global_blocklist: listIds['Global bounces'],
  };

  const seeded = [];
  for (let i = 0; i < 140; i += 1) {
    const reason = pick(REASON_POOL, i);
    const listId = i % 11 === 0 ? listIds['Q3 campaign holdout'] : listByReason[reason];
    const email = fakeEmail(i + 1);
    const ageDays = Math.floor((i * 37) % 45);
    const createdAt = daysAgo(ageDays, 8 + (i % 10), (i * 7) % 60);
    const addedBy = i % 3 === 0 ? 'sales@workspace' : 'ops@workspace';

    const result = addEntry({
      email,
      reason,
      listId,
      source: i % 5 === 0 ? 'api' : 'upload',
      addedBy,
      createdAt,
      eventDetail: `Reported via ${i % 5 === 0 ? 'API' : 'CSV import'}`,
      ...fakeCrmFields(i),
    });
    if (result.ok && !result.wasDuplicate) seeded.push({ entryId: result.entryId, reason, createdAt });
  }
  return seeded;
}

function seedEvents(seeded) {
  const insertEvent = db.prepare('INSERT INTO entry_events (entry_id, type, detail, actor, occurred_at) VALUES (?, ?, ?, ?, ?)');

  for (const { entryId, reason, createdAt } of seeded) {
    const created = new Date(createdAt);
    const firstSeen = new Date(created.getTime() - 1000 * 60 * 60 * 24 * 120).toISOString();
    const lastDelivery = new Date(created.getTime() - 1000 * 60 * 60 * 24 * 3).toISOString();

    insertEvent.run(entryId, 'first_seen', 'Address first appeared in a send.', 'system', firstSeen);
    insertEvent.run(entryId, 'delivery_success', 'Last campaign send was delivered without error.', 'system', lastDelivery);

    if (reason === 'unsubscribed') {
      insertEvent.run(entryId, 'unsubscribe_click', 'One-click unsubscribe link was used.', 'system', createdAt);
    } else if (reason === 'hard_bounce' || reason === 'soft_bounce' || reason === 'global_blocklist') {
      insertEvent.run(entryId, 'bounce', reason === 'hard_bounce' ? 'Mailbox does not exist (550).' : 'Mailbox temporarily unavailable (450).', 'system', createdAt);
    }
  }
}

function seedImportJobs(listIds) {
  const insert = db.prepare(`
    INSERT INTO import_jobs
      (filename, list_id, file_kind, default_reason, validate_syntax, status, error_message,
       total_rows, processed_rows, suppressed_count, duplicate_count, invalid_count, blank_count,
       started_at, finished_at, duration_ms)
    VALUES (@filename, @listId, @fileKind, @defaultReason, 1, @status, @errorMessage,
      @totalRows, @processedRows, @suppressedCount, @duplicateCount, @invalidCount, @blankCount,
      @startedAt, @finishedAt, @durationMs)
  `);

  insert.run({
    filename: 'bounces_july_2026.csv', listId: listIds['Global bounces'], fileKind: 'bounced', defaultReason: 'hard_bounce',
    status: 'complete', errorMessage: null, totalRows: 3690, processedRows: 3690,
    suppressedCount: 3414, duplicateCount: 191, invalidCount: 62, blankCount: 23,
    startedAt: daysAgo(0, 9, 12), finishedAt: daysAgo(0, 9, 13), durationMs: 41000,
  });
  insert.run({
    filename: 'unsub_export_wk30.tsv', listId: listIds['Unsubscribes'], fileKind: 'unsubscribes', defaultReason: 'unsubscribed',
    status: 'complete', errorMessage: null, totalRows: 1902, processedRows: 1902,
    suppressedCount: 1902, duplicateCount: 0, invalidCount: 0, blankCount: 0,
    startedAt: daysAgo(1, 18, 40), finishedAt: daysAgo(1, 18, 41), durationMs: 8200,
  });
  insert.run({
    filename: 'sales_dnc_master.csv', listId: listIds['Outbound prospecting'], fileKind: 'do_not_contact', defaultReason: 'global_blocklist',
    status: 'processing', errorMessage: null, totalRows: 2400000, processedRows: 1632000,
    suppressedCount: 811004, duplicateCount: 800000, invalidCount: 15000, blankCount: 5996,
    startedAt: daysAgo(1, 11, 5), finishedAt: null, durationMs: null,
  });
  insert.run({
    filename: 'q3_holdout.csv', listId: listIds['Q3 campaign holdout'], fileKind: 'do_not_contact', defaultReason: 'global_blocklist',
    status: 'complete', errorMessage: null, totalRows: 9873, processedRows: 9873,
    suppressedCount: 9873, duplicateCount: 0, invalidCount: 0, blankCount: 0,
    startedAt: daysAgo(4, 16, 22), finishedAt: daysAgo(4, 16, 23), durationMs: 6100,
  });
  insert.run({
    filename: 'partner_list_raw.xlsx', listId: listIds['Outbound prospecting'], fileKind: 'bounced', defaultReason: 'hard_bounce',
    status: 'failed', errorMessage: 'Unsupported file format (.xlsx). Please export as CSV or TSV.',
    totalRows: 0, processedRows: 0, suppressedCount: 0, duplicateCount: 0, invalidCount: 0, blankCount: 0,
    startedAt: daysAgo(5, 8, 51), finishedAt: daysAgo(5, 8, 51), durationMs: 400,
  });
}

const RECENT_CHECK_BATCHES = [
  { name: 'Enterprise ICP — round 3', source: 'pasted', ageDays: 0, hh: 11, mm: 4, total: 1204, flagged: 86 },
  { name: 'Apollo export — DACH manufacturing', source: 'apollo_dach.csv', ageDays: 1, hh: 16, mm: 31, total: 3880, flagged: 412 },
  { name: 'Webinar no-shows', source: 'pasted', ageDays: 4, hh: 10, mm: 0, total: 642, flagged: 19 },
  { name: 'Conference badge scans', source: 'expo_scans.csv', ageDays: 6, hh: 9, mm: 0, total: 2117, flagged: 498 },
  { name: 'Referral intros Q3', source: 'pasted', ageDays: 10, hh: 9, mm: 0, total: 96, flagged: 2 },
];

function seedCheckBatches() {
  const insertBatch = db.prepare(`
    INSERT INTO check_batches (name, source, deep_check, total_count, flagged_count, created_at) VALUES (?, ?, 1, ?, ?, ?)
  `);
  const insertResult = db.prepare(`
    INSERT INTO check_batch_results (batch_id, email, verdict, reason, list_name, risk_score) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const batch of RECENT_CHECK_BATCHES) {
    const createdAt = daysAgo(batch.ageDays, batch.hh, batch.mm);
    const info = insertBatch.run(batch.name, batch.source, batch.total, batch.flagged, createdAt);
    for (let i = 0; i < batch.total; i += 1) {
      const flagged = i < batch.flagged;
      const reason = flagged ? pick(['hard_bounce', 'soft_bounce', 'unsubscribed', 'spam_complaint'], i) : 'clean';
      insertResult.run(
        info.lastInsertRowid,
        fakeEmail(i + batch.total),
        flagged ? 'suppressed_or_invalid' : 'deliverable',
        reason,
        flagged ? 'Global bounces' : null,
        flagged ? 80 + (i % 20) : i % 10,
      );
    }
  }
}

function seedApiKeys() {
  const insert = db.prepare(`
    INSERT INTO api_keys (name, scope, key_value, last_used_at, created_at) VALUES (?, ?, ?, ?, ?)
  `);
  insert.run('Production server', 'check_and_suppress', 'sk_live_9f31c4a77b02e14c2a', daysAgo(0, new Date().getHours(), Math.max(0, new Date().getMinutes() - 2)), daysAgo(120));
  insert.run('Marketing automation', 'check_only', 'sk_live_2b7e0d5519aa83f0c1', daysAgo(0, Math.max(0, new Date().getHours() - 1)), daysAgo(90));
  insert.run('Staging', 'check_only', 'sk_test_44ac1e9820db77bb52', daysAgo(22, 10, 0), daysAgo(200));
}

function seedIfEmpty() {
  const listCount = db.prepare('SELECT COUNT(*) AS c FROM lists').get().c;
  if (listCount > 0) return;

  const run = db.transaction(() => {
    const listIds = seedLists();
    const seeded = seedEntries(listIds);
    seedEvents(seeded);
    seedImportJobs(listIds);
    seedCheckBatches();
    seedApiKeys();
  });
  run();
}

module.exports = { seedIfEmpty };
