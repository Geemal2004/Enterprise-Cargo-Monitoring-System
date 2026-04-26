const express = require("express");
const {
  createRequireAuthMiddleware,
  createTenantScopeMiddleware,
} = require("../middleware/authMiddleware");
const { createAuthRoutes } = require("./authRoutes");
const { createTelemetryRoutes } = require("./telemetryRoutes");
const { createFleetRoutes } = require("./fleetRoutes");
const { createAlertsRoutes } = require("./alertsRoutes");
const { createReportsRoutes } = require("./reportsRoutes");
const { createHealthRoutes } = require("./healthRoutes");
const { createAdminRoutes } = require("./adminRoutes");
const { createTripsRoutes } = require("./tripsRoutes");
const { createOtaRoutes, createOtaFirmwareHandler } = require("./ota");
const otaService = require("../services/otaService");
const { asyncHandler } = require("../utils/asyncHandler");

function createApiRoutes(services, config, runtimeState) {
  const router = express.Router();
  const requireAuth = createRequireAuthMiddleware(services.authService);
  const enforceTenantScope = createTenantScopeMiddleware();

  router.use("/health", createHealthRoutes(runtimeState));
  router.use("/auth", createAuthRoutes(services));

  router.get(
    "/ota/events",
    asyncHandler(async (_req, res) => {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.flushHeaders();

      const ping = setInterval(() => {
        res.write(": ping\n\n");
      }, 20000);

      otaService.addSseClient(res);

      _req.on("close", () => {
        clearInterval(ping);
        otaService.removeSseClient(res);
      });
    })
  );

  router.get("/ota/firmware/:target", createOtaFirmwareHandler());

  router.use(requireAuth, enforceTenantScope);

  router.use("/", createTelemetryRoutes(services, config));
  router.use("/fleet", createFleetRoutes(services));
  router.use("/alerts", createAlertsRoutes(services));
  router.use("/trips", createTripsRoutes(services));
  router.use("/ota", createOtaRoutes(services));
  router.use("/reports", createReportsRoutes(services));
  router.use("/admin", createAdminRoutes(services));

  return router;
}

module.exports = {
  createApiRoutes,
};
