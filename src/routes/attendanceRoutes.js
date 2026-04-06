const express = require('express');
const router = express.Router();
const { 
  getDailyAttendance, 
  getMonthlySummary,
  getEmployeeMonthlyDetails   // add this
} = require('../controllers/attendanceController');

router.get('/daily', getDailyAttendance);
router.get('/monthly', getMonthlySummary);
router.get('/employee-monthly', getEmployeeMonthlyDetails);  // new route

module.exports = router;