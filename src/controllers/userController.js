const pool = require("../config/db");
const bcrypt = require('bcrypt')
exports.getAllUsers = async (req, res) => {
 try {
    const loggedInUserId = req.user.id;
    const result = await pool.query(
      `SELECT id, full_name AS name 
       FROM users 
       WHERE LOWER(is_active) = 'active' AND id != $1
       ORDER BY full_name ASC`,
      [loggedInUserId]
    );
    res.json(result.rows);
} catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users" });
}
};






// @desc    Get all users (admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, department, designation, is_active 
       FROM users where role != 'admin' ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Update user (admin only)
// @route   PUT /api/admin/users/:id
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { full_name, email, role, department, designation, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users 
       SET full_name = $1, email = $2, role = $3, department = $4, designation = $5, is_active = $6
       WHERE id = $7 RETURNING *`,
      [full_name, email, role, department, designation, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete user (admin only)
// @route   DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Create a new user (Admin only)
// @route   POST /api/admin/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { full_name, email, password, role, department, designation, is_active } = req.body;

    // Basic validation
    if (!full_name || !email || !password) {
      return res.status(400).json({ message: "Full name, email and password are required" });
    }

    // Check if user already exists
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password, role, department, designation, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, full_name, email, role, department, designation, is_active`,
      [
        full_name,
        email,
        hashedPassword,
        role || 'employee',
        department || '',
        designation || '',
        is_active || 'Active'
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// module.exports = { createUser };

// module.exports = { getUsers, updateUser, deleteUser };