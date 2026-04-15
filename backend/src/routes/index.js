const express = require("express");
const { createLatestRoutes } = require("./latestRoutes");
const { createAlertsRoutes } = require("./alertsRoutes");
const { createHealthRoutes } = require("./healthRoutes");

function createApiRoutes(store, runtimeState) {
  const router = express.Router();

  router.use("/latest", createLatestRoutes(store));
  router.use("/alerts", createAlertsRoutes(store));
  router.use("/health", createHealthRoutes(store, runtimeState));

  return router;
}

module.exports = {
  createApiRoutes,
};
