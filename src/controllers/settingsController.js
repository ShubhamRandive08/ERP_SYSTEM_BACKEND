const pool = require('../config/db');

// Get system settings (assumes single row)
exports.getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
    if (result.rows.length === 0) {
      // Return default settings if no row exists
      return res.json({
        company_name: "ERP System",
        company_email: "admin@company.com",
        company_phone: "+1 234 567 8900",
        company_address: "123 Business Street, City, Country",
        timezone: "Asia/Kolkata",
        date_format: "DD/MM/YYYY",
        time_format: "24h",
        week_start: "Monday",
        notification_email: "notifications@company.com",
        enable_email_notifications: true,
        enable_sms_notifications: false,
        logo_url: null,
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Update system settings
exports.updateSettings = async (req, res) => {
  const {
    company_name,
    company_email,
    company_phone,
    company_address,
    timezone,
    date_format,
    time_format,
    week_start,
    notification_email,
    enable_email_notifications,
    enable_sms_notifications,
    logo_url,
  } = req.body;

  try {
    const check = await pool.query('SELECT id FROM system_settings LIMIT 1');
    if (check.rows.length === 0) {
      // Insert new settings
      await pool.query(
        `INSERT INTO system_settings 
         (company_name, company_email, company_phone, company_address, timezone, date_format, time_format, week_start, notification_email, enable_email_notifications, enable_sms_notifications, logo_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [company_name, company_email, company_phone, company_address, timezone, date_format, time_format, week_start, notification_email, enable_email_notifications, enable_sms_notifications, logo_url]
      );
    } else {
      // Update existing
      await pool.query(
        `UPDATE system_settings SET
         company_name = $1,
         company_email = $2,
         company_phone = $3,
         company_address = $4,
         timezone = $5,
         date_format = $6,
         time_format = $7,
         week_start = $8,
         notification_email = $9,
         enable_email_notifications = $10,
         enable_sms_notifications = $11,
         logo_url = $12,
         updated_at = NOW()
         WHERE id = (SELECT id FROM system_settings LIMIT 1)`,
        [company_name, company_email, company_phone, company_address, timezone, date_format, time_format, week_start, notification_email, enable_email_notifications, enable_sms_notifications, logo_url]
      );
    }
    res.json({ message: "Settings updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Upload logo
exports.uploadLogo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const logoUrl = `/uploads/logos/${req.file.filename}`;
  try {
    await pool.query(
      `UPDATE system_settings SET logo_url = $1, updated_at = NOW()
       WHERE id = (SELECT id FROM system_settings LIMIT 1)`,
      [logoUrl]
    );
    res.json({ logo_url: logoUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
