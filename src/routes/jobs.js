const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { stagingDir } = require('../db');
const jobs = require('../services/jobs');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, stagingDir),
  filename: (req, file, cb) => cb(null, jobs.newStagingId(file.originalname)),
});
const upload = multer({ storage, limits: { fileSize: 512 * 1024 * 1024 } });

router.post('/stage', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const preview = await jobs.previewStagedFile(req.file.filename);
    res.json({ stagingId: req.file.filename, filename: req.file.originalname, ...preview });
  } catch (err) {
    res.status(400).json({ error: `Could not read file: ${err.message}` });
  }
});

router.get('/', (req, res) => {
  const { page, pageSize } = req.query;
  res.json(jobs.listJobs({ page, pageSize }));
});

router.get('/:id', (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found.' });
  const percent = job.total_rows > 0 ? Math.min(100, Math.round((job.processed_rows / job.total_rows) * 100)) : 0;
  res.json({ ...job, percent });
});

router.get('/:id/skipped-report', (req, res) => {
  const job = jobs.getJob(req.params.id);
  if (!job || !job.skipped_report_path) return res.status(404).json({ error: 'No report available.' });
  const filePath = jobs.skippedReportPath(job.skipped_report_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Report file missing.' });
  res.download(filePath, `skipped-rows-${job.id}.csv`);
});

router.post('/', async (req, res) => {
  const { stagingId, filename, listId, fileKind, mapping = {}, validateSyntax = true, totalRows = 0 } = req.body || {};

  if (!stagingId || !listId || !fileKind || !filename) {
    return res.status(400).json({ error: 'stagingId, filename, listId and fileKind are required.' });
  }
  if (mapping.emailCol === undefined || mapping.emailCol === null) {
    return res.status(400).json({ error: 'An email column must be mapped.' });
  }

  const defaultReason = jobs.FILE_KIND_DEFAULT_REASON[fileKind];
  if (!defaultReason) return res.status(400).json({ error: 'Invalid fileKind.' });

  const stagedPath = jobs.stagingPathFor(stagingId);
  if (!fs.existsSync(stagedPath)) return res.status(400).json({ error: 'Staged file expired or not found. Please re-upload.' });

  const jobId = jobs.createJobRecord({ filename, listId, fileKind, defaultReason, validateSyntax, totalRows });

  const jobPath = path.join(stagingDir, `job-${jobId}${path.extname(filename) || '.csv'}`);
  fs.renameSync(stagedPath, jobPath);

  res.json({ jobId });

  jobs.startImportJob(jobId, {
    emailCol: mapping.emailCol,
    reasonCol: mapping.reasonCol ?? null,
    companyCol: mapping.companyCol ?? null,
    leadIdCol: mapping.leadIdCol ?? null,
    phoneCol: mapping.phoneCol ?? null,
    crmOwnerCol: mapping.crmOwnerCol ?? null,
    crmUrlCol: mapping.crmUrlCol ?? null,
    firstNameCol: mapping.firstNameCol ?? null,
    lastNameCol: mapping.lastNameCol ?? null,
    sourceCol: mapping.sourceCol ?? null,
    listId,
    defaultReason,
    validateSyntax,
    filename,
  }).catch(() => {});
});

module.exports = router;
