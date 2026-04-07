const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, password, role = 'employee', joining_date } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'All fields required' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, joining_date) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role, joining_date',
      [name, email, hashed, role, joining_date || new Date()]
    );
    const user = result.rows[0];
    await pool.query('INSERT INTO leave_balances (user_id) VALUES ($1)', [user.id]);

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, joining_date: user.joining_date } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
