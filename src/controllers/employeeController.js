const pool = require('../config/db');

const updateProfile = async (req, res) => {
  const { full_name, email, phone, address } = req.body;
  const userId = req.user.id;
  try {
    await pool.query(
      `UPDATE users SET full_name=$1, email=$2, phone=$3, address=$4 WHERE id=$5`,
      [full_name, email, phone, address, userId]
    );
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { updateProfile };