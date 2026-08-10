const express = require('express');
const suppressions = require('../services/suppressions');
const { checkEmailValidity } = require('../services/emailValidation');
const { requireOps } = require('./auth');

const router = express.Router();

router.get('/', (req, res) => {
  const { search, listId, page, pageSize } = req.query;
  const reasons = req.query.reasons ? String(req.query.reasons).split(',').filter(Boolean) : [];
  res.json(suppressions.listEntries({ search, reasons, listId, page, pageSize }));
});

router.get('/export', requireOps, (req, res) => {
  const { search, listId } = req.query;
  const reasons = req.query.reasons ? String(req.query.reasons).split(',').filter(Boolean) : [];
  const rows = suppressions.listEntriesForExport({ search, reasons, listId });

  const csvField = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="suppressed.csv"');
  res.write('email,reason,source,list,added_by,added_at,risk_score,first_name,last_name,company_name,lead_id,phone,crm_owner,crm_record_url\n');
  for (const r of rows) {
    res.write([
      csvField(r.email), r.reason, csvField(r.source), csvField(r.list_name), csvField(r.added_by), r.created_at, r.risk_score,
      csvField(r.first_name), csvField(r.last_name), csvField(r.company_name), csvField(r.lead_id), csvField(r.phone), csvField(r.crm_owner), csvField(r.crm_record_url),
    ].join(',') + '\n');
  }
  res.end();
});

router.get('/:id', (req, res) => {
  const entry = suppressions.getEntryById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found.' });
  const events = suppressions.getEventsForEntry(req.params.id);
  res.json({ entry, events });
});

router.patch('/:id', requireOps, (req, res) => {
  const result = suppressions.updateEntry(req.params.id, req.body || {});
  if (!result.ok) {
    const code = result.error === 'not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.json(result);
});

router.post('/unsuppress', requireOps, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids must be a non-empty array.' });
  const result = suppressions.unsuppress(ids);
  res.json(result);
});

router.post('/:id/notes', requireOps, (req, res) => {
  const { note } = req.body || {};
  if (!note || !note.trim()) return res.status(400).json({ error: 'note is required.' });
  suppressions.addNote(req.params.id, note.trim());
  res.json({ ok: true });
});

router.post('/:id/ask-review', (req, res) => {
  suppressions.requestReview(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/revalidate', requireOps, async (req, res) => {
  const entry = suppressions.getEntryById(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found.' });
  const result = await checkEmailValidity(entry.email);
  suppressions.logEvent(
    req.params.id,
    'revalidated',
    result.valid ? 'Domain resolves; still listed on this suppression list.' : 'Domain still does not resolve.',
    'ops@workspace',
  );
  res.json({ ok: true, result });
});

module.exports = router;
