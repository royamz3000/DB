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

module.exports = { listAll, getById, create };
