const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");

function createFleetRoutes(services) {
  const router = express.Router();
  const requireFleetRead = createRequireRolesMiddleware([
    "admin",
    "tenant_admin",
    "fleet_manager",
    "viewer",
  ]);

  router.use(requireFleetRead);

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
    "/summary",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context.tenantCode || null;
      const summary = await services.fleetService.getFleetSummary(
        tenantCode,
        resolveManagerScope(req)
      );
      res.status(200).json(summary);
    })
  );

  router.get(
    "/units",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context.tenantCode || null;
      const units = await services.fleetService.getFleetUnits(
        tenantCode,
        resolveManagerScope(req)
      );
      res.status(200).json({
        count: units.length,
        items: units,
      });
    })
  );

  return router;
}

module.exports = {
  createFleetRoutes,
};
