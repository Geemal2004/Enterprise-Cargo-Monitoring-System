const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");

function createTripsRoutes(services) {
  const router = express.Router();
  const requireTripsAccess = createRequireRolesMiddleware([
    "admin",
    "tenant_admin",
    "fleet_manager",
    "viewer",
  ]);

  router.use(requireTripsAccess);

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

  function requestContext(req) {
    return {
      actorUserId: req.context.actorUserId,
      tenantCode: req.context.tenantCode || null,
      tenantCodeOverride: req.body?.tenantCode || req.query?.tenantCode || null,
      managerUserId: resolveManagerScope(req),
      isSuperAdmin: Boolean(req.auth?.isSuperAdmin),
      ipAddress: req.ip,
      userAgent: req.header("user-agent") || null,
    };
  }

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const items = await services.tripsService.listTrips(req.query || {}, requestContext(req));
      res.status(200).json({
        count: items.length,
        items,
      });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const created = await services.tripsService.createTrip(req.body, requestContext(req));
      res.status(201).json(created);
    })
  );

  router.post(
    "/:id/start",
    asyncHandler(async (req, res) => {
      const updated = await services.tripsService.startTrip(req.params.id, requestContext(req));
      res.status(200).json(updated);
    })
  );

  router.post(
    "/:id/complete",
    asyncHandler(async (req, res) => {
      const updated = await services.tripsService.completeTrip(
        req.params.id,
        requestContext(req)
      );
      res.status(200).json(updated);
    })
  );

  return router;
}

module.exports = {
  createTripsRoutes,
};
