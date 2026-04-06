const express = require('express');
const router = express.Router();
// const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  getAttendanceSummary,
  getLeaveSummary,
  getDepartmentStats,
} = require('../controllers/reportsController'); // adjust path

// router.use(protect, adminOnly);
router.get('/attendance-summary', getAttendanceSummary);
router.get('/leave-summary', getLeaveSummary);
router.get('/department-stats', getDepartmentStats);

module.exports = router;