# Email Suppression Portal

An internal portal for managing email suppression lists (bounced and unsubscribed
addresses) and checking whether individual emails are invalid or suppressed
before you send to them.

## Features

- **Upload lists** — CSV upload of bounced or unsubscribed addresses, with an
  optional `reason` column. Duplicate rows are deduplicated and existing
  entries are refreshed rather than duplicated.
- **Lookup tool** — paste a list of emails or upload a CSV/TXT file to check,
  for each address: syntax validity, whether its domain has a mail server
  (MX/A record lookup), and whether it's on the bounced or unsubscribed list.
- **Browse & manage** — search/filter the full suppression list and remove
  entries.
- **Import history** — audit trail of every upload (file name, source, counts).
- **Shared-password gate** — single password protects the whole portal via a
  server-side session cookie.

## Requirements

- Node.js 18+ (uses `better-sqlite3`, no separate database server needed)

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set PORTAL_PASSWORD and SESSION_SECRET to real values
npm start
```

Then open `http://localhost:3000` and log in with `PORTAL_PASSWORD`.

The SQLite database file is created automatically at `data/suppression.db`
(ignored by git).

## Environment variables

| Variable          | Purpose                                          |
|--------------------|--------------------------------------------------|
| `PORTAL_PASSWORD`  | Shared password required to log in.               |
| `SESSION_SECRET`   | Random string used to sign session cookies.       |
| `PORT`             | Port to listen on (default `3000`).               |

## CSV format

Bounced/unsubscribed uploads accept a CSV with an `email` column (case-insensitive
header match: `email`, `email address`, `e-mail`, `address`) and an optional
`reason` column. If no recognized header row is found, the first column of
every row is treated as the email address.

## What "invalid" means here

Each looked-up email gets two independent signals:

1. **Syntax** — a practical (not full RFC 5322) regex check.
2. **Mail server** — an MX record lookup for the domain (falling back to an
   A/AAAA lookup for domains that accept mail without an MX record). This
   catches typo'd/nonexistent domains without doing an SMTP handshake, so it
   works from any network and costs nothing.

This is a good first filter, but it can't tell you a specific mailbox has
been closed — that's what the suppression list (real bounces reported by your
mail sender) is for.

## Pulling in Salesforce / Constant Contact / other bounce & unsubscribe data

The portal's data model doesn't care where a suppression entry came from — every
row has a `source` field (e.g. `manual-upload`, `salesforce`, `constant-contact`).
The manual CSV upload path in the UI is one way to populate it; a scheduled job
that calls the Salesforce or Constant Contact API and pulls their bounce/
unsubscribe reports is another. Both should go through the same insertion path:

```js
const { addSuppressionsBulk, recordImport } = require('./src/services/suppressions');

const records = fetchedRecordsFromApi.map((r) => ({ email: r.email, reason: r.reason }));
const summary = addSuppressionsBulk(records, { type: 'bounced', source: 'salesforce' });
recordImport({ filename: null, type: 'bounced', source: 'salesforce', totalRows: summary.total,
  addedCount: summary.added, duplicateCount: summary.duplicates, invalidCount: summary.invalid });
```

This isn't wired up to any specific API yet — connecting it just means writing
a small script/cron job that fetches records and calls the function above with
the right `type` (`bounced` or `unsubscribed`) and `source`.

## Project structure

```
src/
  server.js               Express app entry point
  db.js                   SQLite connection + schema
  routes/
    auth.js               login/logout/session + requireAuth middleware
    suppressions.js        list/add/delete/upload/import-history endpoints
    lookup.js              batch email lookup endpoints
  services/
    emailValidation.js     syntax + MX/domain checks
    suppressions.js        suppression list read/write logic
    importParser.js        CSV/plain-text parsing
public/
  index.html, css/, js/     plain HTML/JS frontend (no build step)
```
