const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://erp_system_cbtp_user:as5OUSqEn7f9Ht1JEZIJylbHZsExbiYp@dpg-d79ne10gjchc73fnnqdg-a.oregon-postgres.render.com/erp_system_cbtp',
  ssl: { rejectUnauthorized: false }
});
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error(err);
  else console.log('Connected:', res.rows[0]);
});
module.exports = pool;