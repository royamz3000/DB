require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const { router: authRouter, requireAuth, requireOps } = require('./routes/auth');
const listsRouter = require('./routes/lists');
const suppressionsRouter = require('./routes/suppressions');
const checksRouter = require('./routes/checks');
const jobsRouter = require('./routes/jobs');
const apiKeysRouter = require('./routes/apiKeys');
const settingsRouter = require('./routes/settings');
const statsRouter = require('./routes/stats');
const usersRouter = require('./routes/users');
const integrationsRouter = require('./routes/integrations');
const { seedIfEmpty } = require('./services/seed');
const { bootstrapInitialAdminIfEmpty } = require('./services/users');
const constantContact = require('./services/constantContact');

seedIfEmpty();
bootstrapInitialAdminIfEmpty();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn('Warning: SESSION_SECRET is not set. Using an insecure default for this run only.');
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// 'auto' marks the cookie Secure only when the request actually arrived over HTTPS
// (respecting a reverse proxy's X-Forwarded-Proto) — a flat NODE_ENV check would
// silently break every login for anyone running this behind plain HTTP.
app.set('trust proxy', 1);
app.use(session({
  secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: 'auto',
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/lists', requireAuth, listsRouter);
app.use('/api/suppressions', requireAuth, suppressionsRouter);
app.use('/api/checks', requireAuth, checksRouter);
app.use('/api/jobs', requireAuth, requireOps, jobsRouter);
app.use('/api/api-keys', requireAuth, requireOps, apiKeysRouter);
app.use('/api/settings', requireAuth, requireOps, settingsRouter);
app.use('/api/stats', requireAuth, requireOps, statsRouter);
app.use('/api/users', requireAuth, requireOps, usersRouter);
app.use('/api/integrations', requireAuth, requireOps, integrationsRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

const SYNC_INTERVAL_MS = 30 * 60 * 1000;
setInterval(() => {
  constantContact.runSyncAll().catch((err) => console.warn('Constant Contact scheduled sync failed:', err.message));
}, SYNC_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`Bizcap portal listening on http://localhost:${PORT}`);
});
