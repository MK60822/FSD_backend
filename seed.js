require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./db');

async function seed() {
  await initDB();
  const hashed = await bcrypt.hash('admin123', 10);
  const res = await pool.query(
    `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    ['Admin User', 'admin@leaveflow.com', hashed, 'admin']
  );
  if (res.rows.length) {
    await pool.query('INSERT INTO leave_balances (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [res.rows[0].id]);
    console.log('Admin seeded: admin@leaveflow.com / admin123');
  } else {
    console.log('Admin already exists');
  }
  process.exit(0);
}

seed().catch(err => { console.error(err.message); process.exit(1); });
