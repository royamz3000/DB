require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const { router: authRouter, requireAuth } = require('./routes/auth');
const suppressionsRouter = require('./routes/suppressions');
const lookupRouter = require('./routes/lookup');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn('Warning: SESSION_SECRET is not set. Using an insecure default for this run only.');
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 12 * 60 * 60 * 1000, // 12 hours
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/suppressions', requireAuth, suppressionsRouter);
app.use('/api/lookup', requireAuth, lookupRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`Email suppression portal listening on http://localhost:${PORT}`);
});
