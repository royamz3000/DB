const bcrypt = require('bcryptjs');
const db = require('../db');

const SALT_ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function findByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function toSafeUser(user) {
  if (!user) return user;
  const { password_hash, ...safe } = user;
  return safe;
}

function listUsers() {
  return db.prepare('SELECT id, email, name, role, created_at, last_login_at FROM users ORDER BY created_at ASC').all();
}

function createUser({ email, name, password, role }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !name || !password || !['ops', 'sales'].includes(role)) {
    return { ok: false, error: 'email, name, password, and a valid role are required.' };
  }
  if (password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  if (findByEmail(normalizedEmail)) return { ok: false, error: 'A user with that email already exists.' };

  const result = db.prepare(`
    INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)
  `).run(normalizedEmail, name.trim(), hashPassword(password), role);

  return { ok: true, user: toSafeUser(findById(result.lastInsertRowid)) };
}

function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
}

function countUsers() {
  return db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
}

function countOpsUsers() {
  return db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'ops'").get().c;
}

function recordLogin(id) {
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

function changePassword(id, newPassword) {
  if (!newPassword || newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), id);
  return { ok: true };
}

function bootstrapInitialAdminIfEmpty() {
  if (countUsers() > 0) return;
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      'No users exist yet and INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD are not set — ' +
      'nobody will be able to log in. Set them in .env and restart.',
    );
    return;
  }
  const name = process.env.INITIAL_ADMIN_NAME || 'Admin';
  createUser({ email, name, password, role: 'ops' });
  console.log(`Created initial ops account for ${email}.`);
}

module.exports = {
  hashPassword,
  verifyPassword,
  findByEmail,
  findById,
  listUsers,
  createUser,
  deleteUser,
  countUsers,
  countOpsUsers,
  recordLogin,
  changePassword,
  bootstrapInitialAdminIfEmpty,
};
