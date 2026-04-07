const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.get('/balance', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lb.*, u.name, u.email, u.joining_date FROM leave_balances lb
       JOIN users u ON u.id = lb.user_id WHERE lb.user_id=$1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/request', authenticate, async (req, res) => {
  const { leave_type, start_date, end_date, reason } = req.body;
  if (!leave_type || !start_date || !end_date || !reason)
    return res.status(400).json({ message: 'All fields required' });

  const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) + 1;
  if (days <= 0) return res.status(400).json({ message: 'Invalid date range' });

  try {
    const balance = await pool.query('SELECT remaining_leaves FROM leave_balances WHERE user_id=$1', [req.user.id]);
    if (balance.rows[0].remaining_leaves < days)
      return res.status(400).json({ message: 'Insufficient leave balance' });

    const result = await pool.query(
      'INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, days, reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.user.id, leave_type, start_date, end_date, days, reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my-requests', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM leave_requests WHERE user_id=$1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
