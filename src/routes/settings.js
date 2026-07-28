const express = require('express');
const settings = require('../services/settings');

const router = express.Router();

router.get('/webhooks', (req, res) => {
  res.json(settings.getWebhookSettings());
});

router.patch('/webhooks', (req, res) => {
  const { webhook_url, auto_suppress_hard_bounces, email_summary_on_import, auto_remove_soft_bounces_90d } = req.body || {};
  const patch = {};
  if (webhook_url !== undefined) patch.webhook_url = webhook_url;
  if (auto_suppress_hard_bounces !== undefined) patch.auto_suppress_hard_bounces = auto_suppress_hard_bounces ? 1 : 0;
  if (email_summary_on_import !== undefined) patch.email_summary_on_import = email_summary_on_import ? 1 : 0;
  if (auto_remove_soft_bounces_90d !== undefined) patch.auto_remove_soft_bounces_90d = auto_remove_soft_bounces_90d ? 1 : 0;
  res.json(settings.updateWebhookSettings(patch));
});

module.exports = router;
