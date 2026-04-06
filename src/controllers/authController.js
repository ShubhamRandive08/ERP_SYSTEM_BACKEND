const pool = require("../config/db");
const bcrypt = require("bcrypt");
const { generateToken } = require("../utils/token");

exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // 🔹 Check user exists
    const user = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const dbUser = user.rows[0];

    // 🔹 Check password
    const isMatch = await bcrypt.compare(password, dbUser.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // 🔹 Role validation
    if (role && dbUser.role !== role) {
      return res.status(403).json({
        message: `Access denied. You are not authorized as ${role}`,
      });
    }

    // 🔹 Generate Token
    const token = generateToken(dbUser);

    res.json({
      success: true,
      token,
      user: {
        id: dbUser.id,
        name: dbUser.full_name,
        email: dbUser.email,
        role: dbUser.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};