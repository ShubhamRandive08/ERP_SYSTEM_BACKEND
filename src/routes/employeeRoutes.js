const express = require("express");
const router = express.Router();
// const { generateToken, verifyToken } = require("../utils/token");
const pool = require("../config/db");
const bcrypt = require("bcrypt");

const protect = require("../middleware/authMiddleware");

const { getProfile } = require("../controllers/profileController");

const {updateProfile} = require('../controllers/employeeController')
const { getAllUsers, getUsers } = require("../controllers/userController");
const {
  getAttendance,
  punchIn,
  punchOut,
} = require("../controllers/attendanceController");

const {
  applyLeave,
  getLeaves,
  updateLeave,
  deleteLeave,
  getLeaveAcceptance,
  getPendingCount,
  updateLeaveStatus
} = require("../controllers/leaveController");

const {
  addCompOff,
  getCompOff,
} = require("../controllers/compOffController");

// 🔐 ALL PROTECTED ROUTES

router.get("/profile", protect, getProfile);

// ATTENDANCE
router.get("/attendance", protect, getAttendance);
router.post("/attendance/punch-in", protect, punchIn);
router.post("/attendance/punch-out", protect, punchOut);
router.put("/profile", protect, updateProfile);
// LEAVE
router.post("/leave", protect, applyLeave);
router.get("/leave", protect, getLeaves);
router.put("/leave/:id", protect, updateLeave);
router.delete("/leave/:id", protect, deleteLeave);

// GET ALL (by incharge)
router.get("/leave/leaveacceptance", protect,getLeaveAcceptance);
router.put("/leave/leaveacceptance/:id", protect,updateLeaveStatus);
router.get("/leave/leaveacceptance/pending/count", protect,getPendingCount);

// COMPOFF
router.post("/compoff", protect, addCompOff);
router.get("/compoff", protect, getCompOff);
router.get("/users", protect, getAllUsers);
// ---------- Attendance Summary (present days this month) ----------
router.get('/attendance/summary', async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) {
    return res.status(400).json({ message: 'Month and year required' });
  }
  try {
    // Count present days
    const presentQuery = `
      SELECT COUNT(*) as present_count
      FROM attendance
      WHERE status = 'Present'
        AND EXTRACT(YEAR FROM TO_DATE(date, 'DD Month YYYY')) = $1
        AND EXTRACT(MONTH FROM TO_DATE(date, 'DD Month YYYY')) = $2
    `;
    const presentRes = await pool.query(presentQuery, [ year, month]);
    const presentDays = parseInt(presentRes.rows[0].present_count) || 0;

    // Total working days in month (you can adjust if you exclude weekends)
    const totalDays = new Date(year, month, 0).getDate();

    res.json({ presentDays, totalWorkingDays: totalDays });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/leaves', protect, async (req, res) => {
  const { status, year } = req.query;
  let query = `SELECT * FROM leave_applications WHERE user_id = $1`;
  const params = [req.user.id];           // assuming protect sets req.user with an 'id' property
  if (status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(status);
  }
  if (year) {
    query += ` AND EXTRACT(YEAR FROM created_at) = $${params.length + 1}`;
    params.push(year);
  }
  query += ` ORDER BY created_at DESC`;
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change Password
router.put('/change-password', protect, async (req, res) => {
  const userId = req.user.id; // from protect middleware
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  try {
    // Fetch user's current hashed password from database
    const userQuery = await pool.query(
      `SELECT password FROM users WHERE id = $1`,
      [userId]
    );
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const hashedPassword = userQuery.rows[0].password;

    // Compare provided current password with stored hash
    const isMatch = await bcrypt.compare(currentPassword, hashedPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash the new password
    const saltRounds = 10;
    const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password in database
    await pool.query(
      `UPDATE users SET password = $1 WHERE id = $2`,
      [newHashedPassword, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ---------- SITE VISIT ROUTES (with customer_phone, using 'users' table) ----------

// Schedule a new site visit
router.post('/site-visit/schedule', protect, async (req, res) => {
  const { visit_date, scheduled_time, customer_name, customer_phone, pickup_point, persons, location, description } = req.body;
  const userId = req.user.id;

  if (!visit_date || !scheduled_time || !customer_name || !pickup_point || !location) {
    return res.status(400).json({ message: 'Missing required fields: visit_date, scheduled_time, customer_name, pickup_point, location' });
  }

  try {
    await pool.query(
      `INSERT INTO site_visits 
        (user_id, visit_date, scheduled_time, customer_name, customer_phone, pickup_point, persons, location, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, visit_date, scheduled_time, customer_name, customer_phone || null, pickup_point, persons || 1, location, description || null]
    );
    res.status(201).json({ message: 'Site visit scheduled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get count of today's scheduled visits (for the badge)
router.get('/site-visit/today/count', protect, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM site_visits
       WHERE visit_date = $1 AND status = 'Scheduled'`,
      [today]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get list of today's scheduled visits (includes user name from 'users' table)
router.get('/site-visit/today', protect, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT sv.id, sv.visit_date, sv.scheduled_time, sv.customer_name, sv.customer_phone, 
              sv.pickup_point, sv.persons, sv.location, sv.description, sv.status,
              u.full_name as employee_name
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

// Get upcoming visits (date > today, status = 'Scheduled')
router.get('/site-visit/upcoming', protect, async (req, res) => {
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(
      `SELECT id, visit_date, scheduled_time, customer_name, customer_phone, 
              pickup_point, persons, location, description, status
       FROM site_visits
       WHERE user_id = $1 AND visit_date > $2 AND status = 'Scheduled'
       ORDER BY visit_date ASC, scheduled_time ASC`,
      [userId, today]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update status of a visit (Complete / Cancel)
router.put('/site-visit/:id/status', protect, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      `UPDATE site_visits SET status = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING id`,
      [status, id, req.user.id]
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

// Delete a site visit (only if it belongs to the user)
router.delete('/site-visit/:id', protect, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM site_visits WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user.id]
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