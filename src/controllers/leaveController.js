const pool = require("../config/db");

// APPLY LEAVE
exports.applyLeave = async (req, res) => {
  try {
    const { from_date, to_date, reason, person_incharge, leave_type, address } = req.body;

    // ✅ validation
    if (!from_date || !to_date || !reason || !person_incharge) {
      return res.status(400).json({ message: "All required fields missing" });
    }

    // 🔴 NEW VALIDATION: Check if already pending leave exists
    const existingPending = await pool.query(
      `SELECT * FROM leave_applications 
       WHERE user_id = $1 AND status = 'Pending' OR admin_status = 'Pending'`,
      [req.user.id]
    );

    if (existingPending.rows.length > 0) {
      return res.status(400).json({
        message: "You already have a pending leave request. Please wait until it is approved/rejected."
      });
    }

    // ✅ Insert new leave
    const result = await pool.query(
      `INSERT INTO leave_applications 
       (user_id, from_date, to_date, reason, status, person_incharge, leave_type, address)
       VALUES ($1,$2,$3,$4,'Pending',$5,$6,$7)
       RETURNING *`,
      [
        req.user.id,
        from_date,
        to_date,
        reason,
        person_incharge,
        leave_type || null,
        address || null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// GET LEAVES
exports.getLeaves = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM leave_applications WHERE user_id=$1 ORDER BY id DESC",
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// UPDATE LEAVE
exports.updateLeave = async (req, res) => {
  try {
    const userId = req.user.id;
    const leaveId = req.params.id;

    const {
      from_date,
      to_date,
      reason,
      person_incharge,
      leave_type,
      address,
    } = req.body;

    // ✅ Check leave exists & belongs to user
    const existing = await pool.query(
      "SELECT * FROM leave_applications WHERE id=$1 AND user_id=$2",
      [leaveId, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Leave not found" });
    }

    // ✅ Allow update only if Pending
    if (existing.rows[0].status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Cannot update approved/rejected leave" });
    }

    // ✅ Update query
    await pool.query(
      `UPDATE leave_applications 
       SET from_date=$1, to_date=$2, reason=$3,
           person_incharge=$4, leave_type=$5, address=$6
       WHERE id=$7`,
      [
        from_date,
        to_date,
        reason,
        person_incharge,
        leave_type,
        address,
        leaveId,
      ]
    );

    res.json({ message: "Leave updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.deleteLeave = async (req, res) => {
  try {
    const userId = req.user.id;
    const leaveId = req.params.id;

    const existing = await pool.query(
      "SELECT * FROM leave_applications WHERE id=$1 AND user_id=$2",
      [leaveId, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: "Leave not found" });
    }

    if (existing.rows[0].status !== "Pending") {
      return res.status(400).json({
        message: "Cannot delete approved/rejected leave",
      });
    }

    await pool.query("DELETE FROM leave_applications WHERE id=$1", [leaveId]);

    res.json({ message: "Leave cancelled" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
};

// GET /api/leave-acceptance?incharge=Shubham
exports.getLeaveAcceptance = async (req, res) => {
  try {
    const { incharge } = req.query;

    const result = await pool.query(
      `SELECT 
          la.*, 
          u.full_name AS employee_name
       FROM leave_applications la
       JOIN users u 
         ON la.user_id = u.id
       WHERE la.person_incharge = $1
       ORDER BY la.created_at DESC`,
      [incharge]
    );

    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

// PUT /api/leave-acceptance/:id
exports.updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // reason = manager message

    const result = await pool.query(
      `UPDATE leave_applications 
       SET status = $1, reason = $2 
       WHERE id = $3 
       RETURNING *`,
      [status, reason, id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.updateLeaveStatusAsAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body; // reason = manager message

    const result = await pool.query(
      `UPDATE leave_applications 
       SET status = $1, reason = $2 
       WHERE id = $3 
       RETURNING *`,
      [status, reason, id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};


// GET PENDING COUNT
exports.getPendingCount = async (req, res) => {
  try {
    const { incharge } = req.query;

    const result = await pool.query(
      `SELECT COUNT(*) 
       FROM leave_applications 
       WHERE person_incharge = $1 AND status = 'Pending'`,
      [incharge]
    );

    res.json({
      pendingCount: parseInt(result.rows[0].count),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
};


// const pool = require('../config/db');

// Get all pending leave requests with employee details
exports.getPendingLeaves = async (req, res) => {
  try {
    const query = `
      SELECT 
        l.id,
        l.user_id,
        l.leave_type,
        l.from_date,
        l.to_date,
        l.total_days,
        l.reason,
        l.address,
        l.status,
        l.created_at,
        u.full_name AS employee_name,
        u.email,
        u.department
      FROM leave_applications l
      JOIN users u ON l.user_id = u.id
      WHERE l.admin_status = 'Pending'
      ORDER BY l.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.approveLeave = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE leave_applications 
       SET admin_status = 'Approved', created_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json({ message: 'Leave approved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reject leave request with optional reason
exports.rejectLeave = async (req, res) => {
  const { id } = req.params;
  const { reject_reason } = req.body;
  try {
    const result = await pool.query(
      `UPDATE leave_applications 
       SET admin_status = 'Rejected', admin_resone = $1, created_at = NOW()
       WHERE id = $2 RETURNING *`,
      [reject_reason || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }
    res.json({ message: 'Leave rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get current leave policy (assumes a single row in leave_policy table)
exports.getLeavePolicy = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT casual_leave_days, sick_leave_days, annual_leave_days,
             carry_forward_limit, max_consecutive_days
      FROM leave_policy
      LIMIT 1
    `);
    // if (result.rows.length === 0) {
    //   // Return default values if no policy row exists
    //   return res.json({
    //     casual_leave_days: 12,
    //     sick_leave_days: 10,
    //     annual_leave_days: 15,
    //     carry_forward_limit: 5,
    //     max_consecutive_days: 10,
    //   });
    // }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update leave policy (upsert)
exports.updateLeavePolicy = async (req, res) => {
  const {
    casual_leave_days,
    sick_leave_days,
    annual_leave_days,
    carry_forward_limit,
    max_consecutive_days,
  } = req.body;
  try {
    // Check if policy row exists
    const check = await pool.query('SELECT id FROM leave_policy LIMIT 1');
    if (check.rows.length === 0) {
      // Insert new policy
      await pool.query(
        `INSERT INTO leave_policy 
         (casual_leave_days, sick_leave_days, annual_leave_days, carry_forward_limit, max_consecutive_days)
         VALUES ($1, $2, $3, $4, $5)`,
        [casual_leave_days, sick_leave_days, annual_leave_days, carry_forward_limit, max_consecutive_days]
      );
    } else {
      // Update existing
      await pool.query(
        `UPDATE leave_policy SET
         casual_leave_days = $1,
         sick_leave_days = $2,
         annual_leave_days = $3,
         carry_forward_limit = $4,
         max_consecutive_days = $5`,
        [casual_leave_days, sick_leave_days, annual_leave_days, carry_forward_limit, max_consecutive_days]
      );
    }
    res.json({ message: 'Policy updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// (Keep existing functions: getPendingLeaves, approveLeave, rejectLeave)