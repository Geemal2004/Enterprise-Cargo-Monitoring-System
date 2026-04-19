const { Pool } = require("pg");

function createDbPool(config, logger) {
  const pool = new Pool(config.db.pg);

  pool.on("error", (error) => {
    logger.error("Unexpected PostgreSQL pool error", { error: error.message });
  });

  return pool;
}

async function verifyDbConnection(pool) {
  const result = await pool.query("SELECT NOW() AS now");
  return result.rows[0];
}

module.exports = {
  createDbPool,
  verifyDbConnection,
};
