const db = require('../db');

function getWebhookSettings() {
  return db.prepare('SELECT * FROM webhook_settings WHERE id = 1').get();
}

function updateWebhookSettings(patch) {
  const current = getWebhookSettings();
  const next = { ...current, ...patch };
  db.prepare(`
    UPDATE webhook_settings SET
      webhook_url = @webhook_url,
      auto_suppress_hard_bounces = @auto_suppress_hard_bounces,
      email_summary_on_import = @email_summary_on_import,
      auto_remove_soft_bounces_90d = @auto_remove_soft_bounces_90d
    WHERE id = 1
  `).run(next);
  return getWebhookSettings();
}

async function notifyWebhookIfEnabled(payload) {
  const settings = getWebhookSettings();
  if (!settings.email_summary_on_import && !settings.webhook_url) return;
  if (!settings.webhook_url) return;
  try {
    await fetch(settings.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // Best-effort notification; the import itself already succeeded.
  }
}

module.exports = { getWebhookSettings, updateWebhookSettings, notifyWebhookIfEnabled };
