const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { createRequireAuthMiddleware } = require("../middleware/authMiddleware");

function createAuthRoutes(services) {
  const router = express.Router();
  const requireAuth = createRequireAuthMiddleware(services.authService);

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const payload = await services.authService.login({
        email: req.body?.email,
        password: req.body?.password,
      });

      res.status(200).json(payload);
    })
  );

  router.get(
    "/me",
    requireAuth,
    asyncHandler(async (req, res) => {
      res.status(200).json({
        user: {
          id: req.auth.id,
          email: req.auth.email,
          fullName: req.auth.fullName,
          roles: req.auth.roles,
          tenant: req.auth.tenant,
        },
      });
    })
  );

  router.post(
    "/refresh",
    asyncHandler(async (req, res) => {
      const payload = await services.authService.refresh(req.body?.refreshToken);
      res.status(200).json(payload);
    })
  );

  return router;
}

module.exports = {
  createAuthRoutes,
};
