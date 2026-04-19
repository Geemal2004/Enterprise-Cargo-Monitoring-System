const path = require("path");
const { config } = require("../config/env");
const { createLogger } = require("../config/logger");
const { createDbPool } = require("./pool");
const { runSeeds } = require("./migrator");

async function main() {
  const logger = createLogger(config.logLevel);
  const pool = createDbPool(config, logger);

  try {
    const seedsDir = path.resolve(__dirname, "../../seeds");
    const result = await runSeeds(pool, seedsDir, logger);
    logger.info("Seeds completed", result);
    process.exit(0);
  } catch (error) {
    logger.error("Seed execution failed", { error: error.message });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
