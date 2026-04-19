const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { AppError } = require("../utils/appError");

const ACTIVE_USER_STATUS = "ACTIVE";
const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

function normalizeRoleCodes(rawRoles) {
  if (!Array.isArray(rawRoles)) {
    return [];
  }

  const unique = new Set();
  for (const role of rawRoles) {
    if (typeof role !== "string") {
      continue;
    }

    const normalized = role.trim().toLowerCase();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique.values());
}

function toPublicUser(userRecord) {
  return {
    id: userRecord.id,
    email: userRecord.email,
    fullName: userRecord.full_name,
    status: userRecord.status,
    isActive: userRecord.is_active,
    lastLoginAt: userRecord.last_login_at,
    tenant: {
      id: userRecord.tenant_id,
      code: userRecord.tenant_code,
      name: userRecord.tenant_name,
      isActive: userRecord.tenant_is_active,
    },
    roles: normalizeRoleCodes(userRecord.roles),
  };
}

function assertAccountIsActive(userRecord) {
  if (!userRecord) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (userRecord.deleted_at) {
    throw new AppError("User account is disabled.", 403, {
      code: "USER_DELETED",
    });
  }

  if (!userRecord.is_active || String(userRecord.status || "").toUpperCase() !== ACTIVE_USER_STATUS) {
    throw new AppError("User account is disabled.", 403, {
      code: "USER_DISABLED",
    });
  }

  if (!userRecord.tenant_is_active) {
    throw new AppError("Tenant is inactive.", 403, {
      code: "TENANT_INACTIVE",
    });
  }

  const roles = normalizeRoleCodes(userRecord.roles);
  if (roles.length === 0) {
    throw new AppError("User account has no assigned roles.", 403, {
      code: "ROLE_MISSING",
    });
  }
}

function createAuthService({ config, pool, authRepository }) {
  const authConfig = config.auth;

  function signToken(userRecord, tokenType) {
    const secret =
      tokenType === ACCESS_TOKEN_TYPE
        ? authConfig.jwtAccessSecret
        : authConfig.jwtRefreshSecret;

    const expiresIn =
      tokenType === ACCESS_TOKEN_TYPE
        ? authConfig.jwtAccessExpiresIn
        : authConfig.jwtRefreshExpiresIn;

    const roles = normalizeRoleCodes(userRecord.roles);

    return jwt.sign(
      {
        tokenType,
        tenantId: userRecord.tenant_id,
        tenantCode: userRecord.tenant_code,
        roles,
      },
      secret,
      {
        subject: String(userRecord.id),
        expiresIn,
        issuer: authConfig.jwtIssuer,
        audience: authConfig.jwtAudience,
      }
    );
  }

  function issueTokenPair(userRecord) {
    return {
      tokenType: "Bearer",
      accessToken: signToken(userRecord, ACCESS_TOKEN_TYPE),
      refreshToken: signToken(userRecord, REFRESH_TOKEN_TYPE),
      accessTokenExpiresIn: authConfig.jwtAccessExpiresIn,
      refreshTokenExpiresIn: authConfig.jwtRefreshExpiresIn,
    };
  }

  function verifyToken(token, tokenType) {
    const secret =
      tokenType === ACCESS_TOKEN_TYPE
        ? authConfig.jwtAccessSecret
        : authConfig.jwtRefreshSecret;

    let decoded;
    try {
      decoded = jwt.verify(token, secret, {
        issuer: authConfig.jwtIssuer,
        audience: authConfig.jwtAudience,
      });
    } catch (error) {
      throw new AppError("Invalid or expired token.", 401, {
        code: "TOKEN_INVALID",
      });
    }

    if (typeof decoded !== "object" || decoded === null) {
      throw new AppError("Invalid token payload.", 401, {
        code: "TOKEN_PAYLOAD_INVALID",
      });
    }

    if (decoded.tokenType !== tokenType) {
      throw new AppError("Invalid token type.", 401, {
        code: "TOKEN_TYPE_INVALID",
      });
    }

    return decoded;
  }

  async function getAuthenticatedUserById(userId) {
    const userRecord = await authRepository.getUserAuthById(pool, userId);
    if (!userRecord) {
      throw new AppError("User not found.", 401, {
        code: "USER_NOT_FOUND",
      });
    }

    assertAccountIsActive(userRecord);
    const user = toPublicUser(userRecord);

    return {
      ...user,
      isSuperAdmin: user.roles.includes("super_admin"),
    };
  }

  async function login(input) {
    const email = String(input?.email || "").trim();
    const password = String(input?.password || "");

    if (!email || !password) {
      throw new AppError("Email and password are required.", 400);
    }

    const userRecord = await authRepository.findUserAuthByEmail(pool, email);
    if (!userRecord) {
      throw new AppError("Invalid email or password.", 401);
    }

    const passwordMatches = await bcrypt.compare(password, userRecord.password_hash || "");
    if (!passwordMatches) {
      throw new AppError("Invalid email or password.", 401);
    }

    assertAccountIsActive(userRecord);

    await authRepository.touchLastLoginAt(pool, userRecord.id);
    const refreshedUser = await authRepository.getUserAuthById(pool, userRecord.id);
    assertAccountIsActive(refreshedUser);

    return {
      user: toPublicUser(refreshedUser),
      tokens: issueTokenPair(refreshedUser),
    };
  }

  async function refresh(refreshToken) {
    if (!refreshToken || typeof refreshToken !== "string") {
      throw new AppError("refreshToken is required.", 400);
    }

    const decoded = verifyToken(refreshToken, REFRESH_TOKEN_TYPE);
    const userId = String(decoded.sub || "").trim();
    if (!userId) {
      throw new AppError("Invalid token subject.", 401);
    }

    const userRecord = await authRepository.getUserAuthById(pool, userId);
    assertAccountIsActive(userRecord);

    return {
      user: toPublicUser(userRecord),
      tokens: issueTokenPair(userRecord),
    };
  }

  function verifyAccessToken(accessToken) {
    return verifyToken(accessToken, ACCESS_TOKEN_TYPE);
  }

  return {
    login,
    refresh,
    verifyAccessToken,
    getAuthenticatedUserById,
  };
}

module.exports = {
  createAuthService,
};
