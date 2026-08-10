const express = require('express');
const lists = require('../services/lists');
const { requireOps } = require('./auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ lists: lists.listAll() });
});

router.post('/', requireOps, (req, res) => {
  const { name, description } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required.' });
  try {
    const list = lists.create({ name: name.trim(), description });
    res.json({ list });
  } catch (err) {
    res.status(400).json({ error: 'A list with that name already exists.' });
  }
});

router.delete('/:id', requireOps, (req, res) => {
  const result = lists.deleteList(req.params.id);
  if (!result.ok) return res.status(404).json({ error: 'Not found.' });
  res.json(result);
});

module.exports = router;
