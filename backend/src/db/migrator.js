const fs = require("fs");
const path = require("path");

function listSqlFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b, "en"));
}

async function ensureTrackingTable(pool, tableName) {
  if (!["schema_migrations", "seed_runs"].includes(tableName)) {
    throw new Error(`Unsupported migration tracking table: ${tableName}`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function readApplied(pool, tableName) {
  const result = await pool.query(`SELECT filename FROM ${tableName}`);
  return new Set(result.rows.map((row) => row.filename));
}

async function executeSqlFile(pool, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  await pool.query(sql);
}

async function runSqlDirectory(pool, options) {
  const { directory, trackingTable, logger, label } = options;

  await ensureTrackingTable(pool, trackingTable);
  const applied = await readApplied(pool, trackingTable);
  const files = listSqlFiles(directory);

  let appliedCount = 0;

  for (const filename of files) {
    if (applied.has(filename)) {
      logger.debug(`${label} already applied`, { filename });
      continue;
    }

    const absolutePath = path.join(directory, filename);
    logger.info(`Applying ${label}`, { filename });

    await executeSqlFile(pool, absolutePath);
    await pool.query(`INSERT INTO ${trackingTable}(filename) VALUES ($1)`, [filename]);
    appliedCount += 1;
  }

  return {
    totalFiles: files.length,
    appliedCount,
  };
}

async function runMigrations(pool, migrationsDir, logger) {
  return runSqlDirectory(pool, {
    directory: migrationsDir,
    trackingTable: "schema_migrations",
    logger,
    label: "migration",
  });
}

async function runSeeds(pool, seedsDir, logger) {
  return runSqlDirectory(pool, {
    directory: seedsDir,
    trackingTable: "seed_runs",
    logger,
    label: "seed",
  });
}

module.exports = {
  runMigrations,
  runSeeds,
};
