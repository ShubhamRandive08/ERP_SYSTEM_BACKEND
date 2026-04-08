// src/routes/adminSiteVisitRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../config/db');        // your PostgreSQL connection
const  protect  = require('../middleware/authMiddleware');  // adjust path as needed

// GET today's visits for ALL employees (admin sees all)
router.get('/today', protect, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT sv.*, u.full_name as employee_name 
       FROM site_visits sv
       JOIN users u ON sv.user_id = u.id
       WHERE sv.visit_date = $1
       ORDER BY sv.scheduled_time ASC`,
      [today]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET upcoming visits for ALL employees (admin sees all)
router.get('/upcoming', protect, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT sv.*, u.full_name as employee_name 
       FROM site_visits sv
       JOIN users u ON sv.user_id = u.id
       WHERE sv.visit_date > $1 AND sv.status = 'Scheduled'
       ORDER BY sv.visit_date ASC, sv.scheduled_time ASC`,
      [today]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST schedule a visit for the admin (admin's own user_id)
router.post('/schedule', protect, async (req, res) => {
  const userId = req.user.id;
  const { visit_date, scheduled_time, customer_name, customer_phone, pickup_point, persons, location, description } = req.body;
  if (!visit_date || !scheduled_time || !customer_name || !pickup_point || !location) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    await pool.query(
      `INSERT INTO site_visits 
        (user_id, visit_date, scheduled_time, customer_name, customer_phone, pickup_point, persons, location, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Scheduled')`,
      [userId, visit_date, scheduled_time, customer_name, customer_phone || null, pickup_point, persons || 1, location, description || null]
    );
    res.status(201).json({ message: 'Site visit scheduled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT update status (admin can update any visit)
router.put('/:id/status', protect, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      `UPDATE site_visits SET status = $1 WHERE id = $2 RETURNING id`,
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    res.json({ message: 'Status updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE any visit (admin)
router.delete('/:id', protect, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM site_visits WHERE id = $1 RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    res.json({ message: 'Visit deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;