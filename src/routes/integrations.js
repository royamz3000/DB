const express = require('express');
const cc = require('../services/constantContact');
const ccApi = require('../services/constantContactApi');

const router = express.Router();

router.get('/constant-contact', (req, res) => {
  res.json({ connections: cc.listConnections() });
});

router.get('/constant-contact/connect', (req, res) => {
  try {
    const state = cc.generateState();
    req.session.ccOauthState = state;
    res.redirect(ccApi.buildAuthorizeUrl(state));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/constant-contact/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!state || state !== req.session.ccOauthState) {
    return res.status(400).send('Invalid or expired OAuth state. Please try connecting again from Settings.');
  }
  delete req.session.ccOauthState;

  try {
    const tokens = await ccApi.exchangeCodeForTokens(code);
    const summary = await ccApi.fetchAccountSummary(tokens.access_token);

    cc.upsertConnectionFromOAuth({
      accountEmail: summary.contact_email,
      label: summary.organization_name || summary.contact_email,
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
