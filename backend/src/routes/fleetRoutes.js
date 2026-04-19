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

  router.get(
    "/summary",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context.tenantCode || null;
      const summary = await services.fleetService.getFleetSummary(tenantCode);
      res.status(200).json(summary);
    })
  );

  router.get(
    "/units",
    asyncHandler(async (req, res) => {
      const tenantCode = req.context.tenantCode || null;
      const units = await services.fleetService.getFleetUnits(tenantCode);
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
