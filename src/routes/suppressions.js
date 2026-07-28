const express = require('express');
const multer = require('multer');
const suppressions = require('../services/suppressions');
const { parseCsvBuffer } = require('../services/importParser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const VALID_TYPES = new Set(['bounced', 'unsubscribed']);

router.get('/stats', (req, res) => {
  res.json(suppressions.getStats());
});

router.get('/imports', (req, res) => {
  const { page, pageSize } = req.query;
  res.json(suppressions.listImports({ page, pageSize }));
});

router.get('/', (req, res) => {
  const { type, search, page, pageSize } = req.query;
  res.json(suppressions.listSuppressions({ type, search, page, pageSize }));
});

router.post('/', (req, res) => {
  const { email, type, source, reason } = req.body || {};
  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'type must be "bounced" or "unsubscribed".' });
  }
  const result = suppressions.addSuppression({ email, type, source: source || 'manual', reason });
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.delete('/:id', (req, res) => {
  const ok = suppressions.deleteSuppression(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found.' });
  res.json({ ok: true });
});

router.post('/upload', upload.single('file'), (req, res) => {
  const { type, source } = req.body || {};
  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'type must be "bounced" or "unsubscribed".' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  let records;
  try {
    records = parseCsvBuffer(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: `Could not parse file: ${err.message}` });
  }

  if (records.length === 0) {
    return res.status(400).json({ error: 'No email addresses found in the file.' });
  }

  const summary = suppressions.addSuppressionsBulk(records, {
    type,
    source: source || 'manual-upload',
  });

  suppressions.recordImport({
    filename: req.file.originalname,
    type,
    source: source || 'manual-upload',
    totalRows: summary.total,
    addedCount: summary.added,
    duplicateCount: summary.duplicates,
    invalidCount: summary.invalid,
  });

  res.json(summary);
});

module.exports = router;
