const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const stagingDir = path.join(dataDir, 'staging');
if (!fs.existsSync(stagingDir)) fs.mkdirSync(stagingDir, { recursive: true });

const db = new Database(path.join(dataDir, 'sieve.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('system', 'manual')),
    description TEXT,
    can_be_emptied INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS suppression_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN (
      'hard_bounce', 'soft_bounce', 'unsubscribed', 'spam_complaint', 'catch_all_risky', 'global_blocklist'
    )),
    list_id INTEGER NOT NULL REFERENCES lists (id),
    risk_score INTEGER NOT NULL DEFAULT 50,
    source TEXT NOT NULL DEFAULT 'manual',
    added_by TEXT NOT NULL DEFAULT 'ops@workspace',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (email, list_id)
  );

  CREATE INDEX IF NOT EXISTS idx_entries_email ON suppression_entries (email);
  CREATE INDEX IF NOT EXISTS idx_entries_reason ON suppression_entries (reason);
  CREATE INDEX IF NOT EXISTS idx_entries_list ON suppression_entries (list_id);

  CREATE TABLE IF NOT EXISTS entry_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL REFERENCES suppression_entries (id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    detail TEXT,
    actor TEXT,
    occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_entry ON entry_events (entry_id);

  CREATE TABLE IF NOT EXISTS import_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    list_id INTEGER NOT NULL REFERENCES lists (id),
    file_kind TEXT NOT NULL CHECK (file_kind IN ('bounced', 'unsubscribes', 'spam_complaints', 'do_not_contact')),
    default_reason TEXT NOT NULL,
    validate_syntax INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'complete', 'failed')),
    error_message TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    processed_rows INTEGER NOT NULL DEFAULT 0,
    suppressed_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    invalid_count INTEGER NOT NULL DEFAULT 0,
    blank_count INTEGER NOT NULL DEFAULT 0,
    skipped_report_path TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    duration_ms INTEGER
  );

  CREATE TABLE IF NOT EXISTS check_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'pasted',
    deep_check INTEGER NOT NULL DEFAULT 1,
    total_count INTEGER NOT NULL DEFAULT 0,
    flagged_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS check_batch_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL REFERENCES check_batches (id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    verdict TEXT NOT NULL CHECK (verdict IN ('deliverable', 'suppressed_or_invalid')),
    reason TEXT,
    list_name TEXT,
    risk_score INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_batch_results_batch ON check_batch_results (batch_id);

  CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('check_and_suppress', 'check_only')),
    key_value TEXT NOT NULL UNIQUE,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS webhook_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    webhook_url TEXT NOT NULL DEFAULT 'https://hooks.acme.io/sieve/imports',
    auto_suppress_hard_bounces INTEGER NOT NULL DEFAULT 1,
    email_summary_on_import INTEGER NOT NULL DEFAULT 1,
    auto_remove_soft_bounces_90d INTEGER NOT NULL DEFAULT 0
  );

  INSERT OR IGNORE INTO webhook_settings (id) VALUES (1);
`);

module.exports = db;
module.exports.stagingDir = stagingDir;
