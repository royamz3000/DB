const crypto = require('crypto');
const db = require('../db');

function generateKey(env = 'live') {
  return `sk_${env}_${crypto.randomBytes(15).toString('hex')}`;
}

function listKeys() {
  return db.prepare('SELECT * FROM api_keys ORDER BY created_at ASC').all();
}

function createKey({ name, scope, env = 'live' }) {
  const keyValue = generateKey(env);
  const result = db.prepare(`
    INSERT INTO api_keys (name, scope, key_value) VALUES (?, ?, ?)
  `).run(name, scope, keyValue);
  return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(result.lastInsertRowid);
}

function deleteKey(id) {
  return db.prepare('DELETE FROM api_keys WHERE id = ?').run(id).changes > 0;
}

module.exports = { listKeys, createKey, deleteKey, generateKey };
