const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");
const { parseHistoryQuery } = require("../validators/historyQueryValidator");
const { AppError } = require("../utils/appError");

function createTelemetryRoutes(services, config) {
  const router = express.Router();
  const requireTelemetryRead = createRequireRolesMiddleware([
    "admin",
    "tenant_admin",
    "fleet_manager",
    "viewer",
  ]);

  router.use(requireTelemetryRead);

  async function sendUnitHistory(req, res, truckId, containerId) {
    const query = parseHistoryQuery(req.query, config);
    const tenantCode = req.context.tenantCode || null;

    const history = await services.fleetService.getHistoryForUnit(truckId, containerId, {
      ...query,
      tenantCode,
    });

    res.status(200).json(history);
  }

  router.get(
    "/latest",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context.tenantCode || null;
      const payload = await services.fleetService.getLatestSnapshot(tenantCode);
      res.status(200).json(payload);
    })
  );

  router.get(
    "/latest/:truckId/:containerId",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context.tenantCode || null;
      const payload = await services.fleetService.getLatestForUnit(
        req.params.truckId,
        req.params.containerId,
        tenantCode
      );
      res.status(200).json(payload);
    })
  );

  router.get(
    "/trucks/:truckId/containers/:containerId/latest",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context.tenantCode || null;
      const payload = await services.fleetService.getLatestForUnit(
        req.params.truckId,
        req.params.containerId,
        tenantCode
      );
      res.status(200).json(payload);
    })
  );

  router.get(
    "/trucks/:truckId/containers/:containerId/history",
    asyncHandler(async (req, res) => {
      await sendUnitHistory(req, res, req.params.truckId, req.params.containerId);
    })
  );

  router.get(
    "/history/:truckId/:containerId",
    asyncHandler(async (req, res) => {
      await sendUnitHistory(req, res, req.params.truckId, req.params.containerId);
    })
  );

  router.get(
    "/telemetry/history/:truckId/:containerId",
    asyncHandler(async (req, res) => {
      await sendUnitHistory(req, res, req.params.truckId, req.params.containerId);
    })
  );

  router.get(
    "/history",
    asyncHandler(async (req, res) => {
      const truckId = req.query.truckId;
      const containerId = req.query.containerId;

      if (!truckId || !containerId) {
        throw new AppError("truckId and containerId query params are required", 400);
      }

      await sendUnitHistory(req, res, truckId, containerId);
    })
  );

  return router;
}

module.exports = {
  createTelemetryRoutes,
};
