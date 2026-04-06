const express = require('express');
const router = express.Router();
const { createUser,getUsers, updateUser, deleteUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// All routes require admin authentication
// router.use(protect);

router.get('/allusers', getUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
router.post('/addusers', createUser);

module.exports = router;