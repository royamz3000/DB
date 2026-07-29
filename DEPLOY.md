# Deploying Bizcap to Railway (with your own domain)

This gets the app live at `https://suppress.yourdomain.com` (or whatever
subdomain you pick), with persistent data and the background Constant Contact
sync running. ~10 minutes, ~$5/month.

Everything the build needs is already in the repo (`Dockerfile`). You won't
touch any code — just click through Railway and add a DNS record.

---

## 1. Create the Railway project

1. Go to [railway.app](https://railway.app) → sign in with GitHub.
2. **New Project → Deploy from GitHub repo** → pick this repository
   (`royamz3000/DB`), branch `claude/email-suppression-portal-s243bq`.
3. Railway detects the `Dockerfile` and starts building. Let it finish the
   first build (it may crash on boot until you finish step 2 — that's fine).

## 2. Add a persistent volume (so data survives restarts)

1. In the service, go to the **Variables / Settings → Volumes** area →
   **New Volume**.
2. Mount path: `/app/data`
   (this is where the SQLite database, import staging, and reports live).

## 3. Set environment variables

In the service's **Variables** tab, add:

| Variable | Value |
|---|---|
| `SESSION_SECRET` | a long random string (e.g. run `openssl rand -hex 32`) |
| `INITIAL_ADMIN_EMAIL` | your email — this becomes the first ops login |
| `INITIAL_ADMIN_NAME` | your name |
| `INITIAL_ADMIN_PASSWORD` | a strong password (min 8 chars) — you'll log in with this |
| `APP_BASE_URL` | `https://suppress.yourdomain.com` (the domain from step 4) |

Do **not** set `PORT` — Railway sets it automatically and the app reads it.

After saving, Railway redeploys. Once it's green, the app is live at the
temporary `*.up.railway.app` URL Railway shows.

## 4. Point your domain at it (via Cloudflare DNS)

1. In Railway → service **Settings → Networking → Custom Domain**, enter
   `suppress.yourdomain.com`. Railway shows you a target value (a
   `*.up.railway.app` hostname).
2. In your **Cloudflare dashboard → your domain → DNS**, add a record:
   - Type: **CNAME**
   - Name: `suppress` (or whatever subdomain you chose)
   - Target: the `*.up.railway.app` value Railway gave you
   - Proxy status: **DNS only** (grey cloud) is the safe default; you can turn
     the orange proxy on later if you want Cloudflare in front.
3. Wait a few minutes for it to verify. Railway provisions HTTPS automatically.

Make sure `APP_BASE_URL` (step 3) exactly matches this final
`https://suppress.yourdomain.com`.

## 5. First login

Open `https://suppress.yourdomain.com`, log in with the
`INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` you set. Add teammates from
**Settings → Team**.

---

## 6. Connect Constant Contact (once the app is live)

Now the OAuth flow has a real URL to work with. For **each** Constant Contact
account you want to sync:

1. In that account's developer portal
   ([developer.constantcontact.com](https://developer.constantcontact.com)),
   open your app and set its **Redirect URI** to exactly:
   `https://suppress.yourdomain.com/api/integrations/constant-contact/callback`
2. Copy the app's **Client ID** (API Key) and generate/copy its **Client
   Secret**.
3. In Bizcap → **Settings → Constant Contact → Connect another account** →
   enter a label + that Client ID + Client Secret → continue → log in to
   Constant Contact and click **Allow**.
4. Pick which suppression list this account's new unsubscribes/bounces land
   in. Done — it syncs now and every 30 minutes after.

Repeat step 6 for each additional account (each needs its own developer app,
per the README).

---

## Updating later

Railway auto-deploys when you push to the connected branch. No manual step.
