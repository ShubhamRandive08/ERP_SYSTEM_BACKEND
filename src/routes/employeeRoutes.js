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


module.exports = router;