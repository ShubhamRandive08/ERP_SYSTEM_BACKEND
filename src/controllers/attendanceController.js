const pool = require("../config/db");

// GET ATTENDANCE
exports.getAttendance = async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(`
    SELECT 
      date,
      TO_CHAR(punch_in, 'HH12:MI AM') AS punch_in,
      TO_CHAR(punch_out, 'HH12:MI AM') AS punch_out,
      total_hours,
      status
    FROM attendance
    WHERE user_id=$1
    ORDER BY date DESC
  `, [userId]);

  res.json(result.rows);
};

const formatToDbDate = (dateInput) => {
  const date = new Date(dateInput);
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

// Helper: Calculate working hours between two timestamps
const calculateWorkingHours = (punchIn, punchOut) => {
  const diffMs = new Date(punchOut) - new Date(punchIn);
  const hours = diffMs / (1000 * 60 * 60);
  const hrs = Math.floor(hours);
  const mins = Math.round((hours - hrs) * 60);
  return `${hrs}:${mins.toString().padStart(2, '0')}`;
};



// PUNCH IN
// punch-in
// PUNCH IN
// Inside attendanceController.js
exports.punchIn = async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const dateStr = formatToDbDate(now); // "DD Month YYYY"
  const punchInTime = now;

  // Optional: determine if late (e.g., after 10:00 AM)
  const hour = now.getHours();
  const minute = now.getMinutes();
  let status = 'Present';
  if (hour > 10 || (hour === 10 && minute > 0)) {
    status = 'Late';
  }

  try {
    // Check if already punched in today
    const existing = await pool.query(
      `SELECT id FROM attendance WHERE user_id = $1 AND date = $2`,
      [userId, dateStr]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Already punched in today' });
    }

    await pool.query(
      `INSERT INTO attendance (user_id, date, punch_in, status)
       VALUES ($1, $2, $3, $4)`,
      [userId, dateStr, punchInTime, status]
    );
    res.json({ message: 'Punched in successfully', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUNCH OUT
exports.punchOut = async (req, res) => {
  const userId = req.user.id;
  const now = new Date();
  const dateStr = formatToDbDate(now);

  try {
    const result = await pool.query(
      `SELECT id, punch_in FROM attendance
       WHERE user_id = $1 AND date = $2 AND punch_out IS NULL`,
      [userId, dateStr]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'No active punch-in found' });
    }

    const punchInTime = result.rows[0].punch_in;
    const punchOutTime = now;
    const diffMs = punchOutTime - new Date(punchInTime);
    const totalHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
    const formattedHours = `${Math.floor(totalHours)}:${Math.round((totalHours % 1) * 60)}`;

    // Optionally update status (e.g., if punch-out before expected time)
    let status = 'Present';
    // ... custom logic

    await pool.query(
      `UPDATE attendance
       SET punch_out = $1, total_hours = $2, status = $3
       WHERE id = $4`,
      [punchOutTime, formattedHours, status, result.rows[0].id]
    );
    res.json({ message: 'Punched out successfully', total_hours: formattedHours });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Run every day at 12:01 AM to mark absent for users who didn't punch in
exports.markAbsent = async () => {
  const today = new Date();
  // Format today's date as "DD Month YYYY"
  const formattedToday = formatToDbDate(today);
  
  // For debugging, you can also log the date
  console.log(`Marking absent for date: ${formattedToday}`);

  const query = `
    INSERT INTO attendance (user_id, date, status)
    SELECT id, $1, 'Absent'
    FROM users
    WHERE id NOT IN (
      SELECT user_id FROM attendance WHERE date = $1
    )
  `;
  
  try {
    const result = await pool.query(query, [formattedToday]);
    console.log(`Marked ${result.rowCount} users as absent for ${formattedToday}`);
    return result;
  } catch (err) {
    console.error('Error in markAbsent:', err);
    throw err;
  }
};

// @desc    Get daily attendance report (admin only)
// @route   GET /api/admin/attendance/daily
// @access  Private/Admin
// @desc    Get daily attendance report (admin only)
// @route   GET /api/admin/attendance/daily?date=DD Month YYYY
// @access  Private/Admin
exports.getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query; // Read from query string, not body
    // console.log(date)
    if (!date) {
      return res.status(400).json({ message: "Date parameter is required" });
    }

    const query = `
      SELECT 
        a.id,
        a.user_id,
        a.date,
        a.punch_in,
        a.punch_out,
        a.status,
        a.total_hours,
        u.full_name,
        u.email,
        u.department
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      WHERE a.date = $1
      ORDER BY u.full_name ASC
    `;
    const result = await pool.query(query, [date]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get monthly attendance summary
// @route   GET /api/admin/attendance/monthly?month=4&year=2026
// @access  Private/Admin
exports.getMonthlySummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: "Month and year parameters are required" });
    }

    // Get all active users
    const usersQuery = `
      SELECT id, full_name, email, department
      FROM users
      WHERE is_active = 'Active'
      ORDER BY full_name
    `;
    const usersResult = await pool.query(usersQuery);
    const users = usersResult.rows;

    // For each user, aggregate attendance for the given month
    const summary = await Promise.all(users.map(async (user) => {
      const attendanceQuery = `
        SELECT 
          COUNT(CASE WHEN status = 'Present' THEN 1 END) as present_days,
          COUNT(CASE WHEN status = 'Absent' THEN 1 END) as absent_days,
          COUNT(CASE WHEN status = 'Late' THEN 1 END) as late_days,
          COUNT(CASE WHEN status = 'Half Present' THEN 1 END) as half_days,
          SUM(
            CASE 
              WHEN total_hours ~ '^[0-9]+:[0-9]+$' 
              THEN (SPLIT_PART(total_hours, ':', 1)::int + SPLIT_PART(total_hours, ':', 2)::int / 60.0)
              ELSE 0 
            END
          ) as total_hours
        FROM attendance
        WHERE user_id = $1 
          AND EXTRACT(YEAR FROM TO_DATE(date, 'DD Month YYYY')) = $2
          AND EXTRACT(MONTH FROM TO_DATE(date, 'DD Month YYYY')) = $3
      `;
      const result = await pool.query(attendanceQuery, [user.id, year, month]);
      const stats = result.rows[0];
      return {
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        department: user.department,
        present_days: parseInt(stats.present_days) || 0,
        absent_days: parseInt(stats.absent_days) || 0,
        late_days: parseInt(stats.late_days) || 0,
        half_days: parseInt(stats.half_days) || 0,
        total_hours: stats.total_hours ? parseFloat(stats.total_hours).toFixed(2) : 0,
      };
    }));

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// @desc    Get employee's daily attendance for a specific month
// @route   GET /api/admin/attendance/employee-monthly?user_id=X&month=Y&year=Z
// @access  Private/Admin
exports.getEmployeeMonthlyDetails = async (req, res) => {
  try {
    const { user_id, month, year } = req.query;
    if (!user_id || !month || !year) {
      return res.status(400).json({ message: "user_id, month and year are required" });
    }

    const query = `
      SELECT 
        id,
        date,
        punch_in,
        punch_out,
        status,
        total_hours
      FROM attendance
      WHERE user_id = $1
        AND EXTRACT(YEAR FROM TO_DATE(date, 'DD Month YYYY')) = $2
        AND EXTRACT(MONTH FROM TO_DATE(date, 'DD Month YYYY')) = $3
      ORDER BY TO_DATE(date, 'DD Month YYYY') ASC
    `;
    const result = await pool.query(query, [user_id, year, month]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};