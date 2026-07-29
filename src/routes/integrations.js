const express = require('express');
const cc = require('../services/constantContact');
const ccApi = require('../services/constantContactApi');

const router = express.Router();

router.get('/constant-contact', (req, res) => {
  res.json({ connections: cc.listConnections() });
});

// A real <form method="POST"> submit, not a fetch — the response is a
// redirect the browser must follow to Constant Contact's own login page,
// which a JS fetch() call can't do (it would just consume the redirect).
router.post('/constant-contact/connect', (req, res) => {
  const { label, clientId, clientSecret } = req.body || {};
  if (!label || !clientId || !clientSecret) {
    return res.status(400).send('Label, Client ID, and Client Secret are all required to connect an account.');
  }

  const state = cc.generateState();
  req.session.pendingCcConnect = { state, label, clientId, clientSecret };
  res.redirect(ccApi.buildAuthorizeUrl(state, clientId));
});

router.get('/constant-contact/callback', async (req, res) => {
  const { code, state } = req.query;
  const pending = req.session.pendingCcConnect;

  if (!pending || !state || state !== pending.state) {
    return res.status(400).send('Invalid or expired OAuth state. Please try connecting again from Settings.');
  }
  delete req.session.pendingCcConnect;

  try {
    const tokens = await ccApi.exchangeCodeForTokens(code, pending.clientId, pending.clientSecret);
    const summary = await ccApi.fetchAccountSummary(tokens.access_token);

    cc.upsertConnectionFromOAuth({
      accountEmail: summary.contact_email,
      label: pending.label,
      clientId: pending.clientId,
      clientSecret: pending.clientSecret,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
      userId: req.session.userId,
    });
    res.redirect('/settings');
  } catch (err) {
    res.status(500).send(`Could not complete the Constant Contact connection: ${err.message}`);
  }
});

router.patch('/constant-contact/:id', (req, res) => {
  const { destinationListId } = req.body || {};
  if (!destinationListId) return res.status(400).json({ error: 'destinationListId is required.' });
  cc.setDestinationList(req.params.id, destinationListId);
  res.json({ ok: true });
});

router.post('/constant-contact/:id/sync-now', async (req, res) => {
  try {
    const result = await cc.runSyncForConnection(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/constant-contact/:id/disconnect', (req, res) => {
  cc.disconnect(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
