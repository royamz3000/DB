const express = require('express');
const users = require('../services/users');

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = email ? users.findByEmail(email) : null;

  if (!user || !password || !users.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  users.recordLogin(user.id);

  res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/session', (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ authenticated: false });
  const user = users.findById(req.session.userId);
  if (!user) return res.json({ authenticated: false });
  res.json({ authenticated: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/change-password', (req, res) => {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Not authenticated.' });
  const { currentPassword, newPassword } = req.body || {};
  const user = users.findById(req.session.userId);

  if (!user || !currentPassword || !users.verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const result = users.changePassword(user.id, newPassword);
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Not authenticated.' });
}

function requireOps(req, res, next) {
  if (req.session && req.session.role === 'ops') return next();
  return res.status(403).json({ error: 'This action requires an ops account.' });
}

module.exports = { router, requireAuth, requireOps };
