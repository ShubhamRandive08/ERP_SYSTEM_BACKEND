const pool = require("../config/db");

const getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // from auth middleware
    const result = await pool.query(
      `SELECT id, full_name, email, role, department, designation, is_active 
       FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getProfile };