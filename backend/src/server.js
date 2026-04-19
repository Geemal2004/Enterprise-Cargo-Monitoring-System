const path = require("path");
const { config } = require("./config/env");
const { createLogger } = require("./config/logger");
const { createApp } = require("./app");
const { createRuntimeState } = require("./services/runtimeState");
const { createDbPool, verifyDbConnection } = require("./db/pool");
const { runMigrations, runSeeds } = require("./db/migrator");
const { createMqttConsumer } = require("./mqtt/client");
const { createTelemetryIngestService } = require("./services/telemetryIngestService");
const { createAlertEngineService } = require("./services/alertEngineService");
const { createFleetService } = require("./services/fleetService");
const { createAlertsService } = require("./services/alertsService");
const { createReportsService } = require("./services/reportsService");
const { createAdminService } = require("./services/adminService");
const { createAuthService } = require("./services/authService");
const { startOfflineScannerJob } = require("./jobs/offlineScannerJob");
const telemetryRepository = require("./repositories/telemetryRepository");
const assetRepository = require("./repositories/assetRepository");
const alertRulesRepository = require("./repositories/alertRulesRepository");
const alertsRepository = require("./repositories/alertsRepository");
const reportsRepository = require("./repositories/reportsRepository");
const adminRepository = require("./repositories/adminRepository");
const authRepository = require("./repositories/authRepository");
const auditRepository = require("./repositories/auditRepository");
const telemetryValidator = require("./validators/telemetryValidator");

async function main() {
  const logger = createLogger(config.logLevel);
  const runtimeState = createRuntimeState();
  const pool = createDbPool(config, logger);

  let mqttConsumer = null;
  let offlineScannerJob = null;
  let server = null;
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info("Shutdown started", { signal });

    try {
      if (offlineScannerJob) {
        offlineScannerJob.stop();
      }
      if (mqttConsumer) {
        mqttConsumer.stop();
      }

      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }

      await pool.end();
      logger.info("Shutdown complete");
      process.exit(0);
    } catch (error) {
      logger.error("Shutdown failed", { error: error.message });
      process.exit(1);
    }
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await verifyDbConnection(pool);
    runtimeState.markDbHealthy();
    logger.info("PostgreSQL connection established");

    if (config.db.runMigrationsOnBoot) {
      const migrationsDir = path.resolve(__dirname, "../migrations");
      await runMigrations(pool, migrationsDir, logger);
    }

    if (config.db.runSeedsOnBoot) {
      const seedsDir = path.resolve(__dirname, "../seeds");
      await runSeeds(pool, seedsDir, logger);
    }

    const alertEngineService = createAlertEngineService({
      config,
      alertsRepository,
      alertRulesRepository,
    });

    const telemetryIngestService = createTelemetryIngestService({
      pool,
      logger,
      runtimeState,
      telemetryRepository,
      assetRepository,
      alertEngineService,
      telemetryValidator,
    });

    const services = {
      authService: createAuthService({
        config,
        pool,
        authRepository,
      }),
      fleetService: createFleetService({
        pool,
        config,
        telemetryRepository,
      }),
      alertsService: createAlertsService({
        pool,
        config,
        alertsRepository,
      }),
      reportsService: createReportsService({
        pool,
        config,
        reportsRepository,
      }),
      adminService: createAdminService({
        pool,
        adminRepository,
        auditRepository,
      }),
    };

    mqttConsumer = createMqttConsumer({
      config,
      logger,
      runtimeState,
      onTelemetryMessage: telemetryIngestService.handleIncomingTelemetry,
    });

    offlineScannerJob = startOfflineScannerJob({
      pool,
      config,
      logger,
      runtimeState,
      telemetryRepository,
      alertEngineService,
    });

    const app = createApp(config, logger, services, runtimeState);
    server = app.listen(config.server.port, () => {
      logger.info("Backend started", {
        port: config.server.port,
        apiPrefix: config.server.apiPrefix,
        mqttTopicFilter: config.mqtt.topicFilter,
      });
    });
  } catch (error) {
    runtimeState.markDbError(error);
    logger.error("Backend startup failed", { error: error.message });
    await pool.end();
    process.exit(1);
  }
}

main();
