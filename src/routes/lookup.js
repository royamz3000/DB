const express = require('express');
const multer = require('multer');
const { checkEmailValidity, normalizeEmail } = require('../services/emailValidation');
const { getStatusForEmail } = require('../services/suppressions');
const { parsePastedText, parseUploadedEmailFile } = require('../services/importParser');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const MAX_BATCH = 5000;
const CONCURRENCY = 25;

// Runs an async worker over items with bounded concurrency, since DNS
// lookups for a large pasted list would otherwise all fire at once.
async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    const i = nextIndex++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    await runNext();
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, runNext);
  await Promise.all(runners);
  return results;
}

async function evaluateEmails(rawEmails) {
  const emails = [...new Set(rawEmails.map(normalizeEmail).filter(Boolean))].slice(0, MAX_BATCH);

  return mapWithConcurrency(emails, CONCURRENCY, async (email) => {
    const validity = await checkEmailValidity(email);
    const status = getStatusForEmail(email);
    return {
      email,
      validSyntax: validity.validSyntax,
      hasMailServer: validity.hasMailServer,
      validityReason: validity.reason,
      bounced: Boolean(status.bounced),
      bouncedDetail: status.bounced,
      unsubscribed: Boolean(status.unsubscribed),
      unsubscribedDetail: status.unsubscribed,
      suppressed: Boolean(status.bounced || status.unsubscribed),
    };
  });
}

router.post('/', async (req, res) => {
  const { emails, text } = req.body || {};
  let list = [];
  if (Array.isArray(emails)) list = emails;
  else if (typeof text === 'string') list = parsePastedText(text).map((r) => r.email);

  if (list.length === 0) {
    return res.status(400).json({ error: 'Provide "emails" (array) or "text" (pasted list) to check.' });
  }

  const results = await evaluateEmails(list);
  res.json({ results, checked: results.length, truncated: rawListWasTruncated(list, results) });
});

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  let emails;
  try {
    emails = parseUploadedEmailFile(req.file.buffer, req.file.originalname);
  } catch (err) {
    return res.status(400).json({ error: `Could not parse file: ${err.message}` });
  }

  if (emails.length === 0) {
    return res.status(400).json({ error: 'No email addresses found in the file.' });
  }

  const results = await evaluateEmails(emails);
  res.json({ results, checked: results.length, truncated: rawListWasTruncated(emails, results) });
});

function rawListWasTruncated(rawList, results) {
  const uniqueCount = new Set(rawList.map(normalizeEmail).filter(Boolean)).size;
  return uniqueCount > results.length;
}

module.exports = router;
