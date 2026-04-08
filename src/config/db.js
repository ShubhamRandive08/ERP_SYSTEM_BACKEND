const { Pool } = require("pg");

const pool = new Pool({
  user: "erp_system_cbtp_user",
  host: "dpg-d79ne10gjchc73fnnqdg-a.oregon-postgres.render.com",
  database: "erp_system_cbtp",
  password: "as5OUSqEn7f9Ht1JEZIJylbHZsExbiYp",
  port: 5432,
});

module.exports = pool;