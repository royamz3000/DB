const express = require('express');
const crypto = require('crypto');

const router = express.Router();

function safeEqual(a, b) {
  const bufA = crypto.createHash('sha256').update(String(a)).digest();
  const bufB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.PORTAL_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: 'PORTAL_PASSWORD is not configured on the server.' });
  }
  if (!password || !safeEqual(password, expected)) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  req.session.authenticated = true;
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session && req.session.authenticated) });
});

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Not authenticated.' });
}

module.exports = { router, requireAuth };
