const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");

function createAlertsRoutes(services) {
  const router = express.Router();
  const requireAlertsRead = createRequireRolesMiddleware([
    "admin",
    "tenant_admin",
    "fleet_manager",
    "viewer",
  ]);
  const requireAlertsWrite = createRequireRolesMiddleware([
    "admin",
    "tenant_admin",
    "fleet_manager",
  ]);

  router.use(requireAlertsRead);

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const payload = await services.alertsService.listAlerts({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json(payload);
    })
  );

  router.get(
    "/history",
    asyncHandler(async (req, res) => {
      const payload = await services.alertsService.listAlertHistory({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json(payload);
    })
  );

  router.get(
    "/:alertId/events",
    asyncHandler(async (req, res) => {
      const payload = await services.alertsService.getAlertEvents(
        req.params.alertId,
        req.query || {},
        req.context.tenantCode || null
      );
      res.status(200).json(payload);
    })
  );

  router.patch(
    "/:alertId",
    requireAlertsWrite,
    asyncHandler(async (req, res) => {
      const updated = await services.alertsService.transitionAlert(
        req.params.alertId,
        req.body && req.body.action,
        {
          message: req.body && req.body.message,
          actorUserId: req.context.actorUserId,
        }
      );

      res.status(200).json(updated);
    })
  );

  return router;
}

module.exports = {
  createAlertsRoutes,
};
