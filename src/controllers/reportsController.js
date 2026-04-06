const pool = require("../config/db");

// GET /api/admin/reports/attendance-summary?start=YYYY-MM-DD&end=YYYY-MM-DD
exports.getAttendanceSummary = async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ message: "Start and end dates required" });

  try {
    const summaryQuery = `
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.department,
        COUNT(a.id) AS total_days,
        SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_days,
        SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent_days,
        ROUND(
          COALESCE(
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(a.id), 0), 
            0
          ), 2
        ) AS present_percent
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id 
        AND TO_DATE(a.date, 'DD Month YYYY') BETWEEN $1 AND $2
      GROUP BY u.id, u.full_name, u.email, u.department
      ORDER BY u.full_name
    `;
    const summaryRes = await pool.query(summaryQuery, [start, end]);

    // trend query (no division, so it's fine)
    const trendQuery = `
      SELECT 
        a.date,
        COUNT(a.id) AS present_count
      FROM attendance a
      WHERE a.status = 'Present'
        AND TO_DATE(a.date, 'DD Month YYYY') BETWEEN $1 AND $2
      GROUP BY a.date
      ORDER BY a.date
    `;
    const trendRes = await pool.query(trendQuery, [start, end]);

    res.json({
      summary: summaryRes.rows,
      trend: trendRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/reports/leave-summary
exports.getLeaveSummary = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending,
        COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved,
        COUNT(CASE WHEN status = 'Rejected' THEN 1 END) AS rejected
      FROM leave_applications
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/admin/reports/department-stats
exports.getDepartmentStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(u.department, 'No Dept') AS department,
        COUNT(DISTINCT u.id) AS total_employees,
        ROUND(AVG(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100, 2) AS present_percent,
        ROUND(AVG(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) * 100, 2) AS absent_percent
      FROM users u
      LEFT JOIN attendance a ON u.id = a.user_id
        AND TO_DATE(a.date, 'DD Month YYYY') >= DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY u.department
      ORDER BY department
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};