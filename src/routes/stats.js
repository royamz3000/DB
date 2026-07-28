const express = require('express');
const stats = require('../services/stats');

const router = express.Router();

router.get('/overview', (req, res) => {
  res.json(stats.getOverview());
});

module.exports = router;
