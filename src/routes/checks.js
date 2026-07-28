const express = require('express');
const multer = require('multer');
const checks = require('../services/checks');
const { parsePastedText, parseUploadedEmailFile } = require('../services/importParser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const { page, pageSize } = req.query;
  res.json(checks.listBatches({ page, pageSize }));
});

router.get('/:id', (req, res) => {
  const data = checks.getBatch(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found.' });
  res.json(data);
});

router.get('/:id/export', (req, res) => {
  const data = checks.getBatch(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found.' });
  const scope = req.query.scope === 'suppressed' ? 'suppressed_or_invalid' : 'deliverable';
  const rows = data.results.filter((r) => r.verdict === scope);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${scope}-${req.params.id}.csv"`);
  res.write('email\n');
  for (const r of rows) res.write(`${r.email}\n`);
  res.end();
});

router.post('/quick', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email is required.' });
  const result = await checks.evaluateAddress(email, true);
  res.json(result);
});

router.post('/:id/recheck', async (req, res) => {
  const data = checks.getBatch(req.params.id);
  if (!data) return res.status(404).json({ error: 'Not found.' });
  const emails = data.results.map((r) => r.email);
  const result = await checks.runBatch(emails, { deepCheck: Boolean(data.batch.deep_check), name: data.batch.name, source: data.batch.source });
  res.json(result);
});

router.post('/', async (req, res) => {
  const { emails, text, deepCheck = true } = req.body || {};
  let list = [];
  if (Array.isArray(emails)) list = emails;
  else if (typeof text === 'string') list = parsePastedText(text).map((r) => r.email);

  if (list.length === 0) {
    return res.status(400).json({ error: 'Provide "emails" (array) or "text" (pasted list) to check.' });
  }

  const result = await checks.runBatch(list, { deepCheck: Boolean(deepCheck), source: 'pasted' });
  res.json(result);
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const deepCheck = req.body.deepCheck !== 'false';

  let emails;
  try {
    emails = parseUploadedEmailFile(req.file.buffer, req.file.originalname);
  } catch (err) {
    return res.status(400).json({ error: `Could not parse file: ${err.message}` });
  }
  if (emails.length === 0) return res.status(400).json({ error: 'No email addresses found in the file.' });

  const baseName = req.file.originalname.replace(/\.[^.]+$/, '');
  const result = await checks.runBatch(emails, { deepCheck, name: baseName, source: req.file.originalname });
  res.json(result);
});

module.exports = router;
