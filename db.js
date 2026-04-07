const { createClient } = require('@libsql/client');
require('dotenv').config();

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  throw new Error('TURSO_DATABASE_URL is required');
}

const db = createClient({
  url: databaseUrl,
  authToken,
});

const normalizeSql = (sql) => sql.replace(/\$\d+/g, '?');

const executeQuery = async (sql, params = []) => {
  const result = await db.execute({
    sql: normalizeSql(sql),
    args: params,
  });

  return {
    rows: result.rows.map((row) => ({ ...row })),
    rowsAffected: Number(result.rowsAffected || 0),
  };
};

const createTransactionClient = () => {
  let active = false;

  return {
    async query(sql, params = []) {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed === 'BEGIN') {
        await db.execute('BEGIN');
        active = true;
        return { rows: [], rowsAffected: 0 };
      }

      if (trimmed === 'COMMIT') {
        await db.execute('COMMIT');
        active = false;
        return { rows: [], rowsAffected: 0 };
      }

      if (trimmed === 'ROLLBACK') {
        await db.execute('ROLLBACK');
        active = false;
        return { rows: [], rowsAffected: 0 };
      }

      return executeQuery(sql, params);
    },
    async release() {
      if (active) {
        await db.execute('ROLLBACK');
        active = false;
      }
    },
  };
};

const pool = {
  query: executeQuery,
  async connect() {
    return createTransactionClient();
  },
};

const initDB = async () => {
  try {
    await db.execute('PRAGMA foreign_keys = ON');
    console.log('DB connected successfully');

    await db.batch([
      `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'employee',
          joining_date TEXT NOT NULL DEFAULT (date('now')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS leave_balances (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          total_leaves INTEGER NOT NULL DEFAULT 20,
          used_leaves INTEGER NOT NULL DEFAULT 0,
          remaining_leaves INTEGER NOT NULL DEFAULT 20
        )
      `,
      `
        CREATE TABLE IF NOT EXISTS leave_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          leave_type TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          days INTEGER NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          admin_comment TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `,
    ], 'write');

    console.log('Database initialized successfully');
  } catch (err) {
    console.error('DB init error details:', err.message, err.code, err.stack);
    throw err;
  }
};

module.exports = { pool, initDB };
