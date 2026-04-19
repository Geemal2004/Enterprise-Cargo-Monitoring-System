const { withTransaction } = require("../db/transaction");

function startOfflineScannerJob(deps) {
  const {
    pool,
    config,
    logger,
    runtimeState,
    telemetryRepository,
    alertEngineService,
  } = deps;

  let running = false;

  const timer = setInterval(async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      const candidates = await telemetryRepository.findOfflineCandidates(
        pool,
        config.alerts.offlineThresholdMs,
        null,
        1000
      );

      for (const candidate of candidates) {
        await withTransaction(pool, async (client) => {
          await alertEngineService.evaluateOfflineCandidateInTransaction(client, candidate);
        });
      }

      runtimeState.markOfflineScanRun();
      logger.debug("Offline scanner completed", {
        scanned: candidates.length,
      });
    } catch (error) {
      runtimeState.markOfflineScanError(error);
      logger.error("Offline scanner failed", {
        error: error.message,
      });
    } finally {
      running = false;
    }
  }, config.jobs.offlineScanIntervalMs);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

module.exports = {
  startOfflineScannerJob,
};
