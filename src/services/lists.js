const db = require('../db');

function listAll() {
  return db.prepare(`
    SELECT
      l.*,
      (SELECT COUNT(*) FROM suppression_entries e WHERE e.list_id = l.id) AS entry_count,
      (SELECT COUNT(*) FROM suppression_entries e WHERE e.list_id = l.id AND e.created_at >= datetime('now', '-7 days')) AS added_this_week
    FROM lists l
    ORDER BY l.kind ASC, l.id ASC
  `).all();
}

function getById(id) {
  return db.prepare('SELECT * FROM lists WHERE id = ?').get(id);
}

function create({ name, description }) {
  const result = db.prepare(`
    INSERT INTO lists (name, kind, description, can_be_emptied) VALUES (?, 'manual', ?, 1)
  `).run(name, description || null);
  return getById(result.lastInsertRowid);
}

/**
 * Deletes a list and everything tied to it, in FK-safe order and one
 * transaction: its suppression entries (whose events cascade), any import
 * jobs that targeted it, and it clears the destination on any Constant
 * Contact connection pointing at it. Returns how many addresses were removed.
 */
function deleteList(id) {
  const list = getById(id);
  if (!list) return { ok: false, error: 'not_found' };

  const entryCount = db.prepare('SELECT COUNT(*) AS c FROM suppression_entries WHERE list_id = ?').get(id).c;

  const run = db.transaction(() => {
    db.prepare('DELETE FROM suppression_entries WHERE list_id = ?').run(id);
    db.prepare('DELETE FROM import_jobs WHERE list_id = ?').run(id);
    db.prepare('UPDATE cc_connections SET destination_list_id = NULL WHERE destination_list_id = ?').run(id);
    db.prepare('DELETE FROM lists WHERE id = ?').run(id);
  });
  run();

  return { ok: true, entriesDeleted: entryCount };
}

module.exports = { listAll, getById, create, deleteList };
