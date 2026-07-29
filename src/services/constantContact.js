const crypto = require('crypto');
const db = require('../db');
const ccApi = require('./constantContactApi');
const { addEntriesBulk, riskScoreFor } = require('./suppressions');

function listConnections() {
  return db.prepare(`
    SELECT id, label, account_email, connected_at, destination_list_id,
      last_synced_at, last_sync_status, last_sync_error, last_sync_added_count
    FROM cc_connections ORDER BY connected_at ASC
  `).all();
}

function getConnectionRaw(id) {
  return db.prepare('SELECT * FROM cc_connections WHERE id = ?').get(id);
}

/**
 * Creates a new connection or refreshes tokens for one that already exists
 * for this Constant Contact account (matched by account_email), so
 * reconnecting the same account updates it in place instead of duplicating.
 */
function upsertConnectionFromOAuth({ accountEmail, label, accessToken, refreshToken, expiresInSeconds, userId }) {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  db.prepare(`
    INSERT INTO cc_connections (label, account_email, access_token, refresh_token, token_expires_at, connected_by_user_id)
    VALUES (@label, @accountEmail, @accessToken, @refreshToken, @expiresAt, @userId)
    ON CONFLICT (account_email) DO UPDATE SET
      label = excluded.label,
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      token_expires_at = excluded.token_expires_at,
      connected_by_user_id = excluded.connected_by_user_id
  `).run({ label, accountEmail, accessToken, refreshToken, expiresAt, userId });

  return db.prepare('SELECT id FROM cc_connections WHERE account_email = ?').get(accountEmail);
}

function setDestinationList(connectionId, listId) {
  db.prepare('UPDATE cc_connections SET destination_list_id = ? WHERE id = ?').run(listId, connectionId);
}

function disconnect(connectionId) {
  db.prepare('DELETE FROM cc_connections WHERE id = ?').run(connectionId);
}

function recordSyncResult(connectionId, { status, error, addedCount }) {
  db.prepare(`
    UPDATE cc_connections SET
      last_synced_at = datetime('now'), last_sync_status = ?, last_sync_error = ?, last_sync_added_count = ?
    WHERE id = ?
  `).run(status, error || null, addedCount || 0, connectionId);
}

async function getValidAccessToken(connectionId) {
  const conn = getConnectionRaw(connectionId);
  if (!conn) throw new Error('This Constant Contact connection no longer exists.');

  const expiresAt = new Date(conn.token_expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) return conn.access_token;

  const fresh = await ccApi.refreshTokens(conn.refresh_token);
  db.prepare(`
    UPDATE cc_connections SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?
  `).run(
    fresh.access_token,
    fresh.refresh_token || conn.refresh_token,
    new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
    connectionId,
  );
  return fresh.access_token;
}

function mapContactToEntry(contact, reason) {
  const email = contact.email_address?.address || contact.email_addresses?.[0]?.address;
  return {
    email,
    reason,
    riskScoreOverride: riskScoreFor(reason),
    companyName: contact.company_name || null,
    leadId: contact.contact_id || null,
    phone: contact.phone_numbers?.[0]?.phone_number || null,
    crmOwner: null,
    crmRecordUrl: contact.contact_id ? `https://app.constantcontact.com/pages/contacts/details/${contact.contact_id}` : null,
  };
}

async function runSyncForConnection(connectionId) {
  const conn = getConnectionRaw(connectionId);
  if (!conn) throw new Error('This Constant Contact connection no longer exists.');
  if (!conn.destination_list_id) throw new Error('Choose a destination list before syncing.');

  const since = conn.last_synced_at
    ? new Date(conn.last_synced_at).toISOString()
    : new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString();

  try {
    const accessToken = await getValidAccessToken(connectionId);

    const unsubscribed = await ccApi.fetchUnsubscribedContacts(accessToken, since);
    const rows = unsubscribed.map((c) => mapContactToEntry(c, 'unsubscribed')).filter((r) => r.email);

    let bounceRows = [];
    try {
      const bounced = await ccApi.fetchRecentBounces(accessToken, since);
      bounceRows = bounced.map((c) => mapContactToEntry(c, 'hard_bounce')).filter((r) => r.email);
    } catch (err) {
      // Best-effort — see the caveat in constantContactApi.js. An unsubscribe-only
      // sync is still valuable even if the bounce endpoint needs adjustment.
      console.warn(`Constant Contact bounce sync skipped for connection ${connectionId}:`, err.message);
    }

    const { added } = addEntriesBulk([...rows, ...bounceRows], {
      listId: conn.destination_list_id,
      source: 'api',
      addedBy: `constant-contact:${conn.label}`,
    });

    recordSyncResult(connectionId, { status: 'ok', addedCount: added });
    return { ok: true, added };
  } catch (err) {
    recordSyncResult(connectionId, { status: 'error', error: err.message });
    throw err;
  }
}

/**
 * Runs every connected account's sync independently — one account's failure
 * (expired refresh token, API error, etc.) doesn't block the others.
 */
async function runSyncAll() {
  const results = [];
  for (const conn of listConnections()) {
    try {
      results.push({ connectionId: conn.id, ...(await runSyncForConnection(conn.id)) });
    } catch (err) {
      results.push({ connectionId: conn.id, ok: false, error: err.message });
    }
  }
  return results;
}

function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  listConnections,
  getConnectionRaw,
  upsertConnectionFromOAuth,
  setDestinationList,
  disconnect,
  runSyncForConnection,
  runSyncAll,
  generateState,
};
