# Sieve — email suppression & validation portal

An internal portal for an email-ops team to upload bounced/unsubscribed address
lists into named suppression lists, and for anyone (ops or sales) to check
individual addresses — pasted or imported from a file — for validity and
suppression status before sending to them.

## Stack

- **Backend**: Node.js + Express + SQLite (`better-sqlite3`), no external
  services required.
- **Frontend**: React + Vite SPA (React Router, plain CSS design-token
  system, `@phosphor-icons/react`), built as static assets the Express
  server serves.
- **Auth**: real per-user accounts (bcrypt-hashed passwords, session
  cookies). Each account has a role — `ops` or `sales` — assigned when the
  account is created, not a self-service toggle. The role is enforced
  server-side (see `requireOps` in `src/routes/auth.js`), not just hidden in
  the UI, so a sales account genuinely cannot call the upload/un-suppress/
  export endpoints even by hitting the API directly.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_NAME / INITIAL_ADMIN_PASSWORD
#             and SESSION_SECRET to real values
npm run build   # builds the frontend into frontend/dist
npm start        # serves the API + built SPA on PORT (default 3000)
```

On first boot against an empty database, the server creates one `ops`
account from `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_NAME`/`INITIAL_ADMIN_PASSWORD`.
Sign in as that account, then add teammates (with their own email, name,
password, and role) from **Settings → Team** — there's no self-service sign-up,
accounts are created by an ops teammate.

For local development with hot reload on both sides:

```bash
npm install
npm run dev   # runs the Express API (--watch) and the Vite dev server together
```

The Vite dev server proxies `/api/*` to the Express server on port 3000, so
visit whatever port Vite prints (usually 5173) during development.

The SQLite database lives at `data/sieve.db` (git-ignored) and is seeded
automatically with a small, realistic demo dataset the first time the server
starts against an empty database.

## CRM/ESP fields on suppression entries

Since suppression lists here are mostly populated from Constant Contact
exports (with some Salesforce-style CRM data mixed in), each entry can also
carry **company name, lead/contact ID, phone, CRM owner, and a CRM record
URL**. The upload wizard's column-mapping step recognizes both Constant
Contact's typical space-separated headers ("Company Name", "Phone Number",
"Bounce Reason") and underscored CRM-style ones ("company_name",
"bounce_type") when guessing the mapping. These fields are:

- Shown in the address detail drawer (Company, Lead/Contact ID, Phone, CRM
  owner, and a link to the CRM record when present).
- Included in the Suppression list search (searching "Acme Corp" matches
  entries whose company name is Acme Corp, not just its email domain).
- Included in the CSV export.

They are **not** shown as extra columns in the main suppression table — that
table's layout matches the original design spec exactly, and cramming five
more columns into it would break that fidelity. Manually-added entries and
entries added via the API don't set these fields (they're CSV-import-only for
now), so they show as "—" in the drawer for those rows.

## Environment variables

| Variable                  | Purpose                                                        |
|----------------------------|-----------------------------------------------------------------|
| `INITIAL_ADMIN_EMAIL`      | Email for the one `ops` account created on first boot.          |
| `INITIAL_ADMIN_NAME`       | Display name for that first account.                             |
| `INITIAL_ADMIN_PASSWORD`   | Password for that first account (min 8 characters).             |
| `SESSION_SECRET`           | Random string used to sign session cookies.                      |
| `PORT`                     | Port to listen on (default `3000`).                              |

These three `INITIAL_ADMIN_*` variables are only consulted when the `users`
table is empty — they don't need to stay set (or accurate) after the first
account exists.

## What's real vs. illustrative

Every number in the UI is computed from a real SQLite query against seeded
demo data — nothing is hardcoded. A few spots were deliberately adapted from
the original design brief because the literal numbers/behavior in that brief
didn't hold up as real product logic:

- **Upload results**: a suppression-list import only ever suppresses (that's
  the whole point of the screen — "everything in it is suppressed for good").
  So the completion screen reports **Suppressed / Already listed / Invalid
  syntax / Blank rows** — there's no "Clean, safe to send" bucket, since a
  bounce/unsubscribe file uploaded here isn't being validated for
  deliverability, it's being suppressed outright.
- **Overview stat deltas**: shown deltas (e.g. "+N this week") are computed
  from real `created_at` timestamps. A fabricated multi-week trend line
  (e.g. "vs last month") isn't shown, since there isn't real historical data
  to back a comparison like that honestly.
- **"Also run syntax + domain validation" (upload wizard)**: always checks
  basic email syntax (a malformed address can't be inserted). The checkbox
  additionally runs a DNS/MX lookup per unique domain (cached in-process) and
  raises the risk score for addresses whose domain doesn't resolve — it
  doesn't block suppression, since a bounce file's whole purpose is to
  suppress addresses regardless of current domain validity.

## Role model

`ops` sees Overview, Upload, Check, Suppression list, Lists, and API &
Settings, with full bulk actions (un-suppress, export, create lists/keys,
manage teammates). `sales` sees only Check a list, My recent checks, and
read-only Search — no upload, no row selection, no export-suppressed, no
un-suppress.

Each account's role is set once, when an ops teammate creates that account
(Settings → Team), not something the account holder can change themselves.
It's enforced both in the UI (routes/buttons hidden per role) and on the
server (`requireOps` middleware rejects sales-role sessions on the
upload/un-suppress/export/settings/user-management endpoints even if called
directly) — so this is a real access boundary, not just a UI convenience.

## Project structure

```
src/
  server.js                Express app entry point (serves API + built SPA)
  db.js                     SQLite connection + schema
  routes/                   auth, lists, suppressions, checks, jobs, apiKeys, settings, stats
  services/                 matching business logic modules + seed.js
frontend/
  src/
    App.jsx, main.jsx        routing + providers
    context/                 RoleContext, ListsContext, ToastContext
    components/              design-system primitives (Button, Card, Drawer, DataTable, ...)
    styles/                  tokens.css (design tokens), global.css, components.css
    screens/                 CheckEmails, Suppressions, Upload, Overview, Lists, Settings, Checks
    api/                     thin fetch wrappers per backend route group
```

## Deploying somewhere persistent (for other people to use)

Local `npm start` and GitHub Codespaces are both single-user/ephemeral — fine
for trying it yourself, not for giving a team a URL that stays up. This repo
includes a `Dockerfile` and `fly.toml` for [Fly.io](https://fly.io), which
(unlike most free static/serverless hosts) supports a real persistent volume,
which SQLite needs.

```bash
curl -L https://fly.io/install.sh | sh   # install flyctl
fly auth login                            # creates/logs into a Fly.io account (free tier available)

fly launch --no-deploy                    # picks up the existing Dockerfile + fly.toml; choose a unique app name
fly volumes create sieve_data --size 1 --region iad   # match the region you picked

fly secrets set \
  INITIAL_ADMIN_EMAIL="you@yourcompany.com" \
  INITIAL_ADMIN_NAME="Your Name" \
  INITIAL_ADMIN_PASSWORD="choose-a-real-password" \
  SESSION_SECRET="$(openssl rand -hex 32)"

fly deploy
fly open   # opens https://<your-app-name>.fly.dev — this is the durable, shareable URL
```

Sign in with the `INITIAL_ADMIN_EMAIL`/`INITIAL_ADMIN_PASSWORD` you set above,
then add teammates from Settings → Team — anyone you add can then sign in
with their own email/password at that same URL.

The volume (`sieve_data`, mounted at `/app/data` per `fly.toml`) is what makes
the suppression database survive redeploys and restarts — without it, every
deploy would reset to the seeded demo data. Any other host that gives you a
persistent disk plus a long-running Node process works the same way; Fly.io
is just a straightforward free option for this shape of app.

## Large imports

Import files are streamed from disk (not buffered in memory) and processed
in chunks with periodic event-loop yields, so the server stays responsive
during large imports and multi-million-row files don't need to fit in RAM.
Progress is polled from `GET /api/jobs/:id` by the upload wizard's step 3.
