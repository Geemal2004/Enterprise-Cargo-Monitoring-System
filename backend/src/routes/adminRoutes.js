const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRequireRolesMiddleware } = require("../middleware/authMiddleware");

function createAdminRoutes(services) {
  const router = express.Router();
  const requireSuperAdmin = createRequireRolesMiddleware(["super_admin"]);
  const requireAdminRead = createRequireRolesMiddleware([
    "admin",
    "tenant_admin",
    "fleet_manager",
  ]);
  const requireAdminManage = createRequireRolesMiddleware(["admin", "tenant_admin"]);

  function requestAuditContext(req) {
    return {
      actorUserId: req.context.actorUserId,
      actorTenantCode: req.context.tenantCode || req.auth?.tenant?.code || null,
      actorRoles: req.auth?.roles || [],
      isSuperAdmin: Boolean(req.auth?.isSuperAdmin),
      ipAddress: req.ip,
      userAgent: req.header("user-agent") || null,
    };
  }

  router.get(
    "/tenants",
    requireSuperAdmin,
    asyncHandler(async (req, res) => {
      const tenants = await services.adminService.listTenants(req.query || {});
      res.status(200).json({
        count: tenants.length,
        items: tenants,
      });
    })
  );

  router.get(
    "/roles",
    requireAdminRead,
    asyncHandler(async (_req, res) => {
      const roles = await services.adminService.listRoles();
      res.status(200).json({
        count: roles.length,
        items: roles,
      });
    })
  );

  router.get(
    "/users",
    requireAdminRead,
    asyncHandler(async (req, res) => {
      const users = await services.adminService.listUsers({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json({
        count: users.length,
        items: users,
      });
    })
  );

  router.post(
    "/users",
    requireAdminManage,
    asyncHandler(async (req, res) => {
      const created = await services.adminService.createUser(req.body, requestAuditContext(req));
      res.status(201).json(created);
    })
  );

  router.patch(
    "/users/:id",
    requireAdminManage,
    asyncHandler(async (req, res) => {
      const updated = await services.adminService.patchUser(
        req.params.id,
        req.body,
        requestAuditContext(req)
      );
      res.status(200).json(updated);
    })
  );

  router.post(
    "/users/:id/reset-password",
    requireAdminManage,
    asyncHandler(async (req, res) => {
      const updated = await services.adminService.resetUserPassword(
        req.params.id,
        req.body,
        requestAuditContext(req)
      );

      res.status(200).json(updated);
    })
  );

  router.get(
    "/device-registry",
    requireAdminRead,
    asyncHandler(async (req, res) => {
      const items = await services.adminService.listDeviceRegistry({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json({
        count: items.length,
        items,
      });
    })
  );

  router.get(
    "/audit-logs",
    requireAdminManage,
    asyncHandler(async (req, res) => {
      const items = await services.adminService.listAuditLogs({
        ...req.query,
        tenantCode: req.context.tenantCode || null,
      });
      res.status(200).json({
        count: items.length,
        items,
      });
    })
  );

  return router;
}

module.exports = {
  createAdminRoutes,
};
