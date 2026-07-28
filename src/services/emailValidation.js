const dns = require('dns').promises;

// Reasonably strict but practical email syntax check (not full RFC 5322).
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hasValidSyntax(email) {
  return EMAIL_RE.test(email) && email.length <= 254;
}

// MX lookups are slow and identical for repeated domains within a batch, so cache per process.
const mxCache = new Map();

async function domainHasMailServer(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);

  const result = await (async () => {
    try {
      const records = await dns.resolveMx(domain);
      if (records && records.length > 0) return true;
    } catch (err) {
      // fall through to A/AAAA fallback below
    }
    // Some domains accept mail without an MX record, falling back to the A record.
    try {
      await dns.lookup(domain);
      return true;
    } catch (err) {
      return false;
    }
  })();

  mxCache.set(domain, result);
  return result;
}

/**
 * Checks an email's syntax and, if syntax is valid, whether its domain
 * resolves to a mail server. Does not attempt an SMTP handshake.
 */
async function checkEmailValidity(rawEmail) {
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return { email, validSyntax: false, hasMailServer: false, valid: false, reason: 'empty' };
  }

  if (!hasValidSyntax(email)) {
    return { email, validSyntax: false, hasMailServer: false, valid: false, reason: 'invalid_syntax' };
  }

  const domain = email.split('@')[1];
  const hasMailServer = await domainHasMailServer(domain);

  return {
    email,
    validSyntax: true,
    hasMailServer,
    valid: hasMailServer,
    reason: hasMailServer ? null : 'domain_not_found',
  };
}

module.exports = { normalizeEmail, hasValidSyntax, checkEmailValidity };
