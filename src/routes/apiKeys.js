const express = require('express');
const apiKeys = require('../services/apiKeys');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ keys: apiKeys.listKeys() });
});

router.post('/', (req, res) => {
  const { name, scope, env } = req.body || {};
  if (!name || !scope) return res.status(400).json({ error: 'name and scope are required.' });
  const key = apiKeys.createKey({ name, scope, env });
  res.json({ key });
});

router.delete('/:id', (req, res) => {
  const ok = apiKeys.deleteKey(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found.' });
  res.json({ ok: true });
});

module.exports = router;
