const pool = require("../config/db");

// ADD COMPOFF
exports.addCompOff = async (req, res) => {
  try {
    const { date, description } = req.body;

    const result = await pool.query(
      `INSERT INTO compoff (user_id, date, description, status)
       VALUES ($1,$2,$3,'Approved') RETURNING *`,
      [req.user.id, date, description]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// GET COMPOFF
exports.getCompOff = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM compoff WHERE user_id=$1 ORDER BY id DESC",
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};