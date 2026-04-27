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

  function resolveManagerScope(req) {
    if (req.auth?.isSuperAdmin) {
      return null;
    }

    const roles = (req.auth?.roles || []).map((role) => String(role).toLowerCase());
    if (roles.includes("admin") || roles.includes("tenant_admin")) {
      return null;
    }

    return roles.includes("fleet_manager") ? req.auth.id : null;
  }

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

  router.post(
    "/container-day-summary",
    asyncHandler(async (req, res) => {
      const payload = await services.reportsService.getContainerDayAiSummary({
        ...(req.body || {}),
        tenantCode: req.context.tenantCode || null,
        managerUserId: resolveManagerScope(req),
      });
      res.status(200).json(payload);
    })
  );

  return router;
}

module.exports = {
  createReportsRoutes,
};
