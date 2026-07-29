const express = require('express');
const db = require('../db');

const router = express.Router();

function realTableNames() {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
}

router.get('/tables', (req, res) => {
  const tables = realTableNames().map((name) => {
    const count = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c;
    const columns = db.prepare(`PRAGMA table_info("${name}")`).all().map((c) => c.name);
    return { name, rowCount: count, columns };
  });
  res.json({ tables });
});

router.get('/tables/:table', (req, res) => {
  const { table } = req.params;
  if (!realTableNames().includes(table)) return res.status(404).json({ error: 'No such table.' });

  const page = Math.max(Number(req.query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 500);
  const offset = (page - 1) * pageSize;

  const total = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
  const rows = db.prepare(`SELECT * FROM "${table}" LIMIT ? OFFSET ?`).all(pageSize, offset);
  const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);

  res.json({ rows, columns, total, page, pageSize });
});

router.post('/query', (req, res) => {
  const { sql } = req.body || {};
  if (!sql || !sql.trim()) return res.status(400).json({ error: 'sql is required.' });

  try {
    const stmt = db.prepare(sql);
    if (stmt.reader) {
      const rows = stmt.all();
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      res.json({ kind: 'rows', rows, columns, rowCount: rows.length });
    } else {
      const info = stmt.run();
      res.json({ kind: 'write', changes: info.changes, lastInsertRowid: info.lastInsertRowid });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
