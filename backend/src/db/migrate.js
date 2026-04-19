const path = require("path");
const { config } = require("../config/env");
const { createLogger } = require("../config/logger");
const { createDbPool } = require("./pool");
const { runMigrations } = require("./migrator");

async function main() {
  const logger = createLogger(config.logLevel);
  const pool = createDbPool(config, logger);

  try {
    const migrationsDir = path.resolve(__dirname, "../../migrations");
    const result = await runMigrations(pool, migrationsDir, logger);
    logger.info("Migrations completed", result);
    process.exit(0);
  } catch (error) {
    logger.error("Migration execution failed", { error: error.message });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
