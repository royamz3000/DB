const express = require('express');
const users = require('../services/users');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ users: users.listUsers() });
});

router.post('/', (req, res) => {
  const { email, name, password, role } = req.body || {};
  const result = users.createUser({ email, name, password, role });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json({ user: result.user });
});

router.delete('/:id', (req, res) => {
  const target = users.findById(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found.' });

  if (target.role === 'ops' && users.countOpsUsers() <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last ops account.' });
  }
  if (Number(req.params.id) === req.session.userId) {
    return res.status(400).json({ error: 'You cannot remove your own account while signed in.' });
  }

  users.deleteUser(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
