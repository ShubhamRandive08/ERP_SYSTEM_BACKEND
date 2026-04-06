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

// PUNCH IN
// punch-in
// PUNCH IN
exports.punchIn = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current time in IST (UTC+5:30)
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000; // IST = UTC + 5:30
    const istTime = new Date(now.getTime() + istOffsetMs);

    // Format today's date as "DD Month YYYY" (e.g., "04 April 2026")
    const formattedDate = istTime.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'  // Ensures IST even if server timezone differs
    });

    // Check if already punched in today (using the formatted date string)
    const existing = await pool.query(
      "SELECT * FROM attendance WHERE user_id=$1 AND date=$2",
      [userId, formattedDate]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "Already punched in" });
    }

    // Insert with date as formatted string (column should be VARCHAR/TEXT)
    // Punch-in time is stored as a regular timestamp (could also convert to IST string if needed)
    await pool.query(
      "INSERT INTO attendance (user_id, date, punch_in, status) VALUES ($1, $2, $3, $4)",
      [userId, formattedDate, now, "Working"]
    );

    res.json({ message: "Punch-in success", date: formattedDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error during punch-in" });
  }
};

// PUNCH OUT
exports.punchOut = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    // Night shift handling
    let attendanceDate = new Date(now);
    if (now.getHours() < 5) {
      attendanceDate.setDate(attendanceDate.getDate() - 1);
    }

    const date = attendanceDate.toLocaleDateString("en-CA");

    // ✅ FIX: match using DATE(punch_in)
    const result = await pool.query(
      `SELECT * FROM attendance 
       WHERE user_id=$1 AND DATE(punch_in)=$2`,
      [userId, date]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Punch-in required" });
    }

    const record = result.rows[0];

    if (!record.punch_in) {
      return res.status(400).json({ message: "Invalid punch-in data" });
    }

    if (record.punch_out) {
      return res.status(400).json({ message: "Already punched out" });
    }

    const punchIn = new Date(record.punch_in);
    const punchOut = now;

    let total = "00:00";
    let status = "Absent";

    const diff = punchOut - punchIn;

    if (!isNaN(diff) && diff > 0) {
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);

      total = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

      if (hours >= 8 && hours >= 7) status = "Present";
      else if (hours >= 0 && hours < 7) status = "Half Present";
      else status = "Absent";
    }

    await pool.query(
      `UPDATE attendance 
       SET punch_out=$1, total_hours=$2, status=$3 
       WHERE id=$4`,   // ✅ BEST: use primary key
      [punchOut, total, status, record.id]
    );

    res.json({ total, status });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// run every day at 12:01 AM
exports.markAbsent = async () => {
  const today = new Date().toISOString().split("T")[0];

  await pool.query(
    `
    INSERT INTO attendance (user_id, date, status)
    SELECT id, $1, 'Absent'
    FROM users
    WHERE id NOT IN (
      SELECT user_id FROM attendance WHERE date=$1
    )
  `,
    [today],
  );
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