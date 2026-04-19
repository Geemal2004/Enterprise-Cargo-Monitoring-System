const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");

function createReportsRoutes(services) {
  const router = express.Router();
  const requireReportsRead = createRequireRolesMiddleware([
    "admin",
    "tenant_admin",
    "fleet_manager",
    "viewer",
  ]);

  router.use(requireReportsRead);

  router.get(
    "/fleet-summary",
    asyncHandler(async (req, res) => {
      const payload = await services.reportsService.getFleetSummaryReport({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json(payload);
    })
  );

  router.get(
    "/alert-summary",
    asyncHandler(async (req, res) => {
      const payload = await services.reportsService.getAlertSummaryReport({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json(payload);
    })
  );

  router.get(
    "/device-health-summary",
    asyncHandler(async (req, res) => {
      const payload = await services.reportsService.getDeviceHealthSummaryReport({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json(payload);
    })
  );

  return router;
}

module.exports = {
  createReportsRoutes,
};
