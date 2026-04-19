const bcrypt = require("bcryptjs");
const { withTransaction } = require("../db/transaction");
const { AppError } = require("../utils/appError");
const { assertPasswordPolicy } = require("../utils/passwordPolicy");

const BCRYPT_SALT_ROUNDS = 12;

function normalizeRoleCodes(raw) {
  if (!raw) {
    return [];
  }

  if (!Array.isArray(raw)) {
    throw new AppError("roleCodes must be an array", 400);
  }

  return raw
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase())
    .filter((value, index, self) => self.indexOf(value) === index);
}

function coerceUserStatus(raw) {
  const normalized = (raw || "ACTIVE").toString().toUpperCase();
  if (!["ACTIVE", "DISABLED"].includes(normalized)) {
    throw new AppError("status must be ACTIVE or DISABLED", 400);
  }
  return normalized;
}

function isSuperAdminContext(context) {
  return Boolean(context?.isSuperAdmin);
}

function assertTenantAccess(context, tenantCode) {
  if (isSuperAdminContext(context)) {
    return;
  }

  const actorTenantCode = context?.actorTenantCode || null;
  if (!actorTenantCode) {
    throw new AppError("Authenticated actor has no tenant scope", 403);
  }

  if (tenantCode !== actorTenantCode) {
    throw new AppError("Cross-tenant user administration is forbidden", 403, {
      code: "TENANT_SCOPE_VIOLATION",
      actorTenantCode,
      tenantCode,
    });
  }
}

async function assertRoleCodesAreValid(executor, adminRepository, roleCodes) {
  if (!roleCodes || roleCodes.length === 0) {
    return [];
  }

  const existing = await adminRepository.getExistingRoleCodes(executor, roleCodes);
  const existingSet = new Set(existing);
  const missing = roleCodes.filter((roleCode) => !existingSet.has(roleCode));

  if (missing.length > 0) {
    throw new AppError(`Unknown role codes: ${missing.join(", ")}`, 400, {
      code: "ROLE_CODE_INVALID",
      missing,
    });
  }

  return roleCodes;
}

function assertRoleAssignmentAllowed(context, roleCodes) {
  if (isSuperAdminContext(context)) {
    return;
  }

  if (roleCodes.includes("super_admin")) {
    throw new AppError("Only super_admin can assign super_admin role", 403, {
      code: "ROLE_ASSIGNMENT_FORBIDDEN",
    });
  }
}

function createAdminService(deps) {
  const { pool, adminRepository, auditRepository } = deps;

  async function listTenants(query) {
    return adminRepository.listTenants(pool, Math.min(Number(query.limit) || 500, 2000));
  }

  async function listUsers(query) {
    return adminRepository.listUsers(pool, {
      tenantCode: query.tenantCode || null,
      limit: Math.min(Number(query.limit) || 500, 2000),
    });
  }

  async function listRoles() {
    return adminRepository.listRoles(pool);
  }

  async function createUser(input, context) {
    if (!input || typeof input !== "object") {
      throw new AppError("Request body must be a JSON object", 400);
    }

    if (!input.email) {
      throw new AppError("email is required", 400);
    }
    if (!input.fullName) {
      throw new AppError("fullName is required", 400);
    }
    if (!input.password) {
      throw new AppError("password is required", 400);
    }

    const tenantCode = String(input.tenantCode || context?.actorTenantCode || "").trim();
    if (!tenantCode) {
      throw new AppError("tenantCode is required", 400);
    }

    const roleCodes = normalizeRoleCodes(input.roleCodes);
    if (roleCodes.length === 0) {
      throw new AppError("roleCodes must include at least one role", 400);
    }
    const status = coerceUserStatus(input.status);
    const isActive = input.isActive === undefined ? true : Boolean(input.isActive);

    assertPasswordPolicy(String(input.password));
    assertRoleAssignmentAllowed(context, roleCodes);

    const tenant = await adminRepository.findTenantByCode(pool, tenantCode);
    if (!tenant) {
      throw new AppError("Tenant not found", 404);
    }
    if (!tenant.is_active) {
      throw new AppError("Tenant is inactive", 403, {
        code: "TENANT_INACTIVE",
      });
    }

    assertTenantAccess(context, tenant.tenant_code);

    const passwordHash = await bcrypt.hash(String(input.password), BCRYPT_SALT_ROUNDS);

    try {
      return await withTransaction(pool, async (client) => {
        const validRoleCodes = await assertRoleCodesAreValid(client, adminRepository, roleCodes);

        const user = await adminRepository.createUser(client, {
          tenantId: tenant.id,
          email: String(input.email).toLowerCase(),
          fullName: String(input.fullName),
          passwordHash,
          status,
          isActive,
        });

        const roles = await adminRepository.replaceUserRoles(client, {
          tenantId: tenant.id,
          userId: user.id,
          roleCodes: validRoleCodes,
        });

        await auditRepository.insertAuditLog(client, {
          tenantId: tenant.id,
          actorUserId: context.actorUserId,
          action: "ADMIN_USER_CREATE",
          targetType: "user",
          targetId: user.id,
          metadata: {
            email: user.email,
            roleCodes: roles,
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return {
          ...user,
          tenantCode: tenant.tenant_code,
          roles,
        };
      });
    } catch (error) {
      if (error && error.code === "23505") {
        throw new AppError("User with this email already exists for the tenant", 409);
      }
      throw error;
    }
  }

  async function patchUser(userId, input, context) {
    if (!input || typeof input !== "object") {
      throw new AppError("Request body must be a JSON object", 400);
    }

    const roleCodes =
      input.roleCodes === undefined ? undefined : normalizeRoleCodes(input.roleCodes);

    if (roleCodes !== undefined) {
      if (roleCodes.length === 0) {
        throw new AppError("roleCodes must include at least one role", 400);
      }
      assertRoleAssignmentAllowed(context, roleCodes);
    }

    if (input.password !== undefined) {
      assertPasswordPolicy(String(input.password));
    }

    const patch = {
      fullName: input.fullName !== undefined ? String(input.fullName) : undefined,
      status: input.status !== undefined ? coerceUserStatus(input.status) : undefined,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : undefined,
      passwordHash:
        input.password !== undefined
          ? await bcrypt.hash(String(input.password), BCRYPT_SALT_ROUNDS)
          : undefined,
    };

    return withTransaction(pool, async (client) => {
      const existing = await adminRepository.getUserById(client, userId);
      if (!existing) {
        throw new AppError("User not found", 404);
      }

      assertTenantAccess(context, existing.tenant_code);
      if (!isSuperAdminContext(context) && normalizeRoleCodes(existing.roles).includes("super_admin")) {
        throw new AppError("Only super_admin can modify a super_admin user", 403, {
          code: "SUPER_ADMIN_PROTECTED",
        });
      }

      const updated = await adminRepository.patchUser(client, userId, patch);
      if (!updated) {
        throw new AppError("User not found", 404);
      }

      let roles = normalizeRoleCodes(existing.roles);
      if (roleCodes !== undefined) {
        const validRoleCodes = await assertRoleCodesAreValid(client, adminRepository, roleCodes);
        roles = await adminRepository.replaceUserRoles(client, {
          tenantId: existing.tenant_id,
          userId,
          roleCodes: validRoleCodes,
        });
      }

      await auditRepository.insertAuditLog(client, {
        tenantId: existing.tenant_id,
        actorUserId: context.actorUserId,
        action: "ADMIN_USER_UPDATE",
        targetType: "user",
        targetId: existing.id,
        metadata: {
          fullNameChanged: patch.fullName !== undefined,
          statusChanged: patch.status !== undefined,
          isActiveChanged: patch.isActive !== undefined,
          passwordChanged: patch.passwordHash !== undefined,
          roles,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        ...updated,
        tenantCode: existing.tenant_code,
        roles,
      };
    });
  }

  async function resetUserPassword(userId, input, context) {
    if (!input || typeof input !== "object") {
      throw new AppError("Request body must be a JSON object", 400);
    }

    const newPassword = String(input.newPassword || "");
    if (!newPassword) {
      throw new AppError("newPassword is required", 400);
    }

    assertPasswordPolicy(newPassword);

    return withTransaction(pool, async (client) => {
      const existing = await adminRepository.getUserById(client, userId);
      if (!existing) {
        throw new AppError("User not found", 404);
      }

      assertTenantAccess(context, existing.tenant_code);
      if (!isSuperAdminContext(context) && normalizeRoleCodes(existing.roles).includes("super_admin")) {
        throw new AppError("Only super_admin can reset password of a super_admin user", 403, {
          code: "SUPER_ADMIN_PROTECTED",
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
      const updated = await adminRepository.updateUserPassword(client, userId, passwordHash);
      if (!updated) {
        throw new AppError("User not found", 404);
      }

      await auditRepository.insertAuditLog(client, {
        tenantId: existing.tenant_id,
        actorUserId: context.actorUserId,
        action: "ADMIN_USER_PASSWORD_RESET",
        targetType: "user",
        targetId: existing.id,
        metadata: {
          email: existing.email,
          initiatedByRole: context.actorRoles || [],
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        id: existing.id,
        tenantCode: existing.tenant_code,
        email: existing.email,
        passwordReset: true,
        updatedAt: updated.updated_at,
      };
    });
  }

  async function listDeviceRegistry(query) {
    return adminRepository.listDeviceRegistry(pool, {
      tenantCode: query.tenantCode || null,
      limit: Math.min(Number(query.limit) || 500, 2000),
    });
  }

  async function listAuditLogs(query) {
    return adminRepository.listAuditLogs(pool, {
      tenantCode: query.tenantCode || null,
      limit: Math.min(Number(query.limit) || 500, 2000),
    });
  }

  return {
    listTenants,
    listRoles,
    listUsers,
    createUser,
    patchUser,
    resetUserPassword,
    listDeviceRegistry,
    listAuditLogs,
  };
}

module.exports = {
  createAdminService,
};
