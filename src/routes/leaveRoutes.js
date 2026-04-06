const express = require('express');
const router = express.Router();
const {
  getPendingLeaves,
  approveLeave,
  rejectLeave,
  getLeavePolicy,
  updateLeavePolicy,
} = require('../controllers/leaveController');
// const { protect, adminOnly } = require('../middleware/authMiddleware');

// router.use(protect, adminOnly);

// Existing routes
router.get('/pending', getPendingLeaves);
router.put('/:id/approve', approveLeave);
router.put('/:id/reject', rejectLeave);

// New policy routes
router.get('/leave-policy', getLeavePolicy);
router.put('/leave-policy', updateLeavePolicy);


module.exports = router;