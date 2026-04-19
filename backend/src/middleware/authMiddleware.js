const { AppError } = require("../utils/appError");

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);
  if (!scheme || !token) {
    return null;
  }

  if (scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

function createRequireAuthMiddleware(authService) {
  if (!authService) {
    throw new Error("createRequireAuthMiddleware requires authService.");
  }

  return async function requireAuth(req, _res, next) {
    try {
      const token = extractBearerToken(req.headers.authorization);
      if (!token) {
        throw new AppError("Authorization bearer token is required.", 401, {
          code: "TOKEN_MISSING",
        });
      }

      const decoded = authService.verifyAccessToken(token);
      const userId = String(decoded.sub || "").trim();
      if (!userId) {
        throw new AppError("Invalid token subject.", 401, {
          code: "TOKEN_SUBJECT_INVALID",
        });
      }

      const authenticatedUser = await authService.getAuthenticatedUserById(userId);

      req.auth = {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
        fullName: authenticatedUser.fullName,
        roles: authenticatedUser.roles,
        isSuperAdmin: authenticatedUser.isSuperAdmin,
        tenant: authenticatedUser.tenant,
      };

      if (!req.context) {
        req.context = {};
      }
      req.context.actorUserId = authenticatedUser.id;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function createRequireRolesMiddleware(allowedRoles) {
  const normalizedAllowed = (Array.isArray(allowedRoles) ? allowedRoles : [])
    .filter((role) => typeof role === "string")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  return function requireRoles(req, _res, next) {
    if (!req.auth) {
      return next(new AppError("Unauthorized.", 401));
    }

    if (req.auth.isSuperAdmin) {
      return next();
    }

    if (normalizedAllowed.length === 0) {
      return next();
    }

    const roleSet = new Set((req.auth.roles || []).map((role) => String(role).toLowerCase()));
    const hasAllowedRole = normalizedAllowed.some((role) => roleSet.has(role));

    if (!hasAllowedRole) {
      return next(
        new AppError("Insufficient permissions for this action.", 403, {
          code: "RBAC_FORBIDDEN",
          requiredRoles: normalizedAllowed,
        })
      );
    }

    return next();
  };
}

function createTenantScopeMiddleware() {
  return function enforceTenantScope(req, _res, next) {
    if (!req.auth) {
      return next();
    }

    if (!req.context) {
      req.context = {};
    }

    const requestedTenantCodeRaw = req.query?.tenantCode;
    const requestedTenantCode =
      typeof requestedTenantCodeRaw === "string" && requestedTenantCodeRaw.trim()
        ? requestedTenantCodeRaw.trim()
        : null;

    if (req.auth.isSuperAdmin) {
      req.context.tenantCode = requestedTenantCode;
      if (requestedTenantCode) {
        req.query.tenantCode = requestedTenantCode;
      }
      return next();
    }

    const userTenantCode = req.auth.tenant?.code || null;
    if (!userTenantCode) {
      return next(
        new AppError("Authenticated user has no tenant scope.", 403, {
          code: "TENANT_SCOPE_MISSING",
        })
      );
    }

    if (requestedTenantCode && requestedTenantCode !== userTenantCode) {
      return next(
        new AppError("Cross-tenant access is not allowed.", 403, {
          code: "TENANT_SCOPE_VIOLATION",
          requestedTenantCode,
          tenantCode: userTenantCode,
        })
      );
    }

    req.context.tenantCode = userTenantCode;
    req.query.tenantCode = userTenantCode;

    return next();
  };
}

module.exports = {
  createRequireAuthMiddleware,
  createRequireRolesMiddleware,
  createTenantScopeMiddleware,
};
