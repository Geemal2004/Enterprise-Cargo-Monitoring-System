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

function createApiRoutes(services, config, runtimeState) {
  const router = express.Router();
  const requireAuth = createRequireAuthMiddleware(services.authService);
  const enforceTenantScope = createTenantScopeMiddleware();

  router.use("/health", createHealthRoutes(runtimeState));
  router.use("/auth", createAuthRoutes(services));

  router.use(requireAuth, enforceTenantScope);

  router.use("/", createTelemetryRoutes(services, config));
  router.use("/fleet", createFleetRoutes(services));
  router.use("/alerts", createAlertsRoutes(services));
  router.use("/reports", createReportsRoutes(services));
  router.use("/admin", createAdminRoutes(services));

  return router;
}

module.exports = {
  createApiRoutes,
};
