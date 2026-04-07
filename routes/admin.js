const express = require('express');
const { pool } = require('../db');
const { authenticate, isAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/requests', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT lr.*, u.name, u.email FROM leave_requests lr
       JOIN users u ON u.id = lr.user_id ORDER BY lr.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/employees', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.joining_date, lb.total_leaves, lb.used_leaves, lb.remaining_leaves
       FROM users u LEFT JOIN leave_balances lb ON lb.user_id = u.id WHERE u.role='employee' ORDER BY u.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/requests/:id', authenticate, isAdmin, async (req, res) => {
  const { status, admin_comment } = req.body;
  const { id } = req.params;
  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ message: 'Invalid status' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const leaveRes = await client.query('SELECT * FROM leave_requests WHERE id=$1', [id]);
    const leave = leaveRes.rows[0];
    if (!leave) return res.status(404).json({ message: 'Request not found' });
    if (leave.status !== 'pending') return res.status(400).json({ message: 'Already processed' });

    await client.query(
      'UPDATE leave_requests SET status=$1, admin_comment=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3',
      [status, admin_comment || null, id]
    );

    if (status === 'approved') {
      await client.query(
        'UPDATE leave_balances SET used_leaves=used_leaves+$1, remaining_leaves=remaining_leaves-$1 WHERE user_id=$2',
        [leave.days, leave.user_id]
      );
    }

    await client.query('COMMIT');
    const updated = await pool.query(
      `SELECT lr.*, u.name, u.email FROM leave_requests lr JOIN users u ON u.id=lr.user_id WHERE lr.id=$1`, [id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
