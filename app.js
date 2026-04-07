require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./db');

const app = express();
let dbInitPromise;

const ensureDbInitialized = async () => {
  if (!dbInitPromise) {
    dbInitPromise = initDB().catch((error) => {
      dbInitPromise = undefined;
      throw error;
    });
  }

  return dbInitPromise;
};

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Vercel functions do not have a persistent bootstrap phase, so ensure the DB
// schema is ready before route handlers execute on a cold start.
app.use(async (_req, _res, next) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use((error, _req, res, _next) => {
  console.error('Unhandled API error:', error);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = { app, ensureDbInitialized };
