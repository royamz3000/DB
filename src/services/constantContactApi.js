const AUTHZ_BASE = 'https://authz.constantcontact.com/oauth2/default/v1';
const API_BASE = 'https://api.cc.email/v3';

// Each connected Constant Contact account brings its own Client ID/Secret
// (registered inside that account's own developer portal) rather than one
// shared app — Constant Contact scopes a new app to the account that
// created it unless approved for "public access", and that approval isn't
// always granted, so per-account apps are the reliable path for connecting
// several independent accounts.
function requireAppBaseUrl() {
  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) throw new Error('APP_BASE_URL must be set (your deployed HTTPS URL) to connect Constant Contact.');
  return appBaseUrl;
}

function redirectUri() {
  return `${requireAppBaseUrl().replace(/\/$/, '')}/api/integrations/constant-contact/callback`;
}

function buildAuthorizeUrl(state, clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'contact_data account_read',
    state,
  });
  return `${AUTHZ_BASE}/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code, clientId, clientSecret) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${AUTHZ_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) throw new Error(`Constant Contact token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function refreshTokens(refreshToken, clientId, clientSecret) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${AUTHZ_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) throw new Error(`Constant Contact token refresh failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/**
 * Identifies which Constant Contact account just connected, so multiple
 * connections can be labeled and de-duplicated (GET /v3/account/summary,
 * requires the account_read scope).
 */
async function fetchAccountSummary(accessToken) {
  const res = await fetch(`${API_BASE}/account/summary`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Constant Contact account summary fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/**
 * Fetches contacts that unsubscribed since `updatedAfter` (ISO string), paginating
 * through the full result set. Endpoint/params confirmed against public Constant
 * Contact v3 docs: GET /v3/contacts?status=unsubscribed&updated_after=...
 */
async function fetchUnsubscribedContacts(accessToken, updatedAfter) {
  const results = [];
  let nextUrl = `${API_BASE}/contacts?${new URLSearchParams({
    status: 'unsubscribed',
    updated_after: updatedAfter,
    limit: '500',
    include: 'phone_numbers',
  }).toString()}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Constant Contact contacts fetch failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    results.push(...(data.contacts || []));
    nextUrl = data._links?.next?.href ? `${API_BASE}${data._links.next.href}` : null;
  }

  return results;
}

/**
 * BEST-EFFORT: Constant Contact's account-wide bounce reporting isn't as
 * clearly documented publicly as the contacts/unsubscribe endpoint above —
 * their bounce data appears to live under per-campaign report endpoints
 * rather than one simple incremental feed. This targets the report contacts
 * endpoint for recently-bounced activity; verify against a real connected
 * account and adjust the path/params if this 404s or returns unexpected shape.
 */
async function fetchRecentBounces(accessToken, updatedAfter) {
  const res = await fetch(
    `${API_BASE}/contacts?${new URLSearchParams({ status: 'all', updated_after: updatedAfter, limit: '500' }).toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Constant Contact bounce fetch failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  // Bounce status isn't a documented field on the contact resource itself;
  // this filters defensively rather than assuming a specific field name.
  return (data.contacts || []).filter((c) => JSON.stringify(c).toLowerCase().includes('bounce'));
}

module.exports = {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  refreshTokens,
  fetchAccountSummary,
  fetchUnsubscribedContacts,
  fetchRecentBounces,
};
