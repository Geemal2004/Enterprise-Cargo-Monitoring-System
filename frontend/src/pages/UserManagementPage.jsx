import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAdminUser,
  fetchAdminRoles,
  fetchAdminUsers,
  patchAdminUser,
  resetAdminUserPassword,
} from "../api/adminApi";
import { useAuthContext } from "../context/AuthContext";
import { formatDateTime } from "../types/telemetry";

const PASSWORD_MIN_LENGTH = 12;

function normalizeRoleCodes(rawRoles) {
  if (!Array.isArray(rawRoles)) {
    return [];
  }

  return rawRoles
    .map((role) => String(role || "").trim().toLowerCase())
    .filter(Boolean);
}

function extractErrorMessage(error) {
  if (Array.isArray(error?.response?.data?.details?.failures)) {
    return error.response.data.details.failures.join(" ");
  }

  return (
    error?.response?.data?.message ||
    error?.message ||
    "Request failed. Try again in a moment."
  );
}

function validatePasswordPolicy(password) {
  const failures = [];

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    failures.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (!/[a-z]/.test(password)) {
    failures.push("Password must include at least one lowercase letter.");
  }
  if (!/[A-Z]/.test(password)) {
    failures.push("Password must include at least one uppercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    failures.push("Password must include at least one number.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    failures.push("Password must include at least one symbol.");
  }

  return failures;
}

function RolePicker({ roles, selectedRoleCodes, onToggle, disabled = false }) {
  return (
    <div className="role-picker-grid">
      {(roles || []).map((role) => {
        const roleCode = String(role.role_code || "").toLowerCase();
        const checked = selectedRoleCodes.includes(roleCode);

        return (
          <label key={role.id || roleCode} className="checkbox-row">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(roleCode)}
              disabled={disabled}
            />
            <span>{role.role_name || roleCode}</span>
          </label>
        );
      })}
    </div>
  );
}

export default function UserManagementPage() {
  const { user, hasAnyRole } = useAuthContext();

  const isSuperAdmin = hasAnyRole(["super_admin"]);
  const canManageUsers = hasAnyRole(["super_admin", "tenant_admin", "admin"]);

  const [tenantCodeFilter, setTenantCodeFilter] = useState("");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [createSaving, setCreateSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    tenantCode: "",
    email: "",
    fullName: "",
    password: "",
    confirmPassword: "",
    roleCodes: [],
    status: "ACTIVE",
    isActive: true,
  });

  const [editingUserId, setEditingUserId] = useState("");
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    if (!isSuperAdmin && user?.tenant?.code) {
      setCreateForm((current) => ({
        ...current,
        tenantCode: user.tenant.code,
      }));
    }
  }, [isSuperAdmin, user]);

  const roleNameByCode = useMemo(() => {
    const map = {};

    for (const role of roles || []) {
      if (!role?.role_code) {
        continue;
      }
      map[String(role.role_code).toLowerCase()] = role.role_name || role.role_code;
    }

    return map;
  }, [roles]);

  const scopedTenantCode = useMemo(() => {
    if (isSuperAdmin) {
      return tenantCodeFilter.trim();
    }
    return user?.tenant?.code || "";
  }, [isSuperAdmin, tenantCodeFilter, user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = scopedTenantCode ? { tenantCode: scopedTenantCode } : {};
      const [usersPayload, rolesPayload] = await Promise.all([
        fetchAdminUsers(query),
        fetchAdminRoles(),
      ]);

      setUsers(Array.isArray(usersPayload?.items) ? usersPayload.items : []);
      setRoles(Array.isArray(rolesPayload?.items) ? rolesPayload.items : []);
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [scopedTenantCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleCreateRole(roleCode) {
    setCreateForm((current) => {
      const exists = current.roleCodes.includes(roleCode);
      return {
        ...current,
        roleCodes: exists
          ? current.roleCodes.filter((item) => item !== roleCode)
          : [...current.roleCodes, roleCode],
      };
    });
  }

  function toggleEditRole(roleCode) {
    setEditForm((current) => {
      if (!current) {
        return current;
      }

      const exists = current.roleCodes.includes(roleCode);
      return {
        ...current,
        roleCodes: exists
          ? current.roleCodes.filter((item) => item !== roleCode)
          : [...current.roleCodes, roleCode],
      };
    });
  }

  async function handleCreateUser(event) {
    event.preventDefault();

    if (!canManageUsers) {
      setError("You do not have permission to create users.");
      return;
    }

    const nextErrors = [];

    if (isSuperAdmin && !createForm.tenantCode.trim()) {
      nextErrors.push("tenantCode is required for super_admin user creation.");
    }
    if (!createForm.email.trim()) {
      nextErrors.push("email is required.");
    }
    if (!createForm.fullName.trim()) {
      nextErrors.push("fullName is required.");
    }
    if (!createForm.password) {
      nextErrors.push("password is required.");
    }
    if (createForm.password !== createForm.confirmPassword) {
      nextErrors.push("Password confirmation does not match.");
    }
    if (!Array.isArray(createForm.roleCodes) || createForm.roleCodes.length === 0) {
      nextErrors.push("At least one role must be selected.");
    }

    nextErrors.push(...validatePasswordPolicy(createForm.password));

    if (nextErrors.length > 0) {
      setError(nextErrors.join(" "));
      return;
    }

    setCreateSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        email: createForm.email.trim(),
        fullName: createForm.fullName.trim(),
        password: createForm.password,
        roleCodes: createForm.roleCodes,
        status: createForm.status,
        isActive: Boolean(createForm.isActive),
      };

      if (isSuperAdmin) {
        payload.tenantCode = createForm.tenantCode.trim();
      }

      await createAdminUser(payload);
      setNotice("User created successfully.");
      setCreateForm((current) => ({
        ...current,
        email: "",
        fullName: "",
        password: "",
        confirmPassword: "",
        roleCodes: [],
      }));

      await loadData();
    } catch (createError) {
      setError(extractErrorMessage(createError));
    } finally {
      setCreateSaving(false);
    }
  }

  function startEdit(userRecord) {
    setEditingUserId(userRecord.id);
    setEditForm({
      fullName: userRecord.full_name || "",
      status: String(userRecord.status || "ACTIVE").toUpperCase(),
      isActive: Boolean(userRecord.is_active),
      roleCodes: normalizeRoleCodes(userRecord.roles),
      newPassword: "",
      confirmNewPassword: "",
    });
    setError("");
    setNotice("");
  }

  function cancelEdit() {
    setEditingUserId("");
    setEditForm(null);
  }

  async function handlePatchUser(event) {
    event.preventDefault();

    if (!editingUserId || !editForm) {
      return;
    }

    if (!canManageUsers) {
      setError("You do not have permission to modify users.");
      return;
    }

    if (!editForm.fullName.trim()) {
      setError("fullName is required.");
      return;
    }

    if (!Array.isArray(editForm.roleCodes) || editForm.roleCodes.length === 0) {
      setError("At least one role must be selected.");
      return;
    }

    setEditSaving(true);
    setError("");
    setNotice("");

    try {
      await patchAdminUser(editingUserId, {
        fullName: editForm.fullName.trim(),
        status: editForm.status,
        isActive: Boolean(editForm.isActive),
        roleCodes: editForm.roleCodes,
      });

      setNotice("User updated successfully.");
      await loadData();
    } catch (patchError) {
      setError(extractErrorMessage(patchError));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();

    if (!editingUserId || !editForm) {
      return;
    }

    if (!editForm.newPassword) {
      setError("New password is required.");
      return;
    }

    if (editForm.newPassword !== editForm.confirmNewPassword) {
      setError("New password confirmation does not match.");
      return;
    }

    const policyFailures = validatePasswordPolicy(editForm.newPassword);
    if (policyFailures.length > 0) {
      setError(policyFailures.join(" "));
      return;
    }

    setResetSaving(true);
    setError("");
    setNotice("");

    try {
      await resetAdminUserPassword(editingUserId, editForm.newPassword);
      setNotice("Password reset completed.");
      setEditForm((current) =>
        current
          ? {
              ...current,
              newPassword: "",
              confirmNewPassword: "",
            }
          : current
      );
      await loadData();
    } catch (resetError) {
      setError(extractErrorMessage(resetError));
    } finally {
      setResetSaving(false);
    }
  }

  return (
    <div className="page-grid">
      <section>
        <div className="panel-headline spaced-bottom">
          <h2>User Management</h2>
          <p>Tenant-scoped identity operations with role assignment and password governance.</p>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <p className="summary-title">Total Users</p>
            <p className="summary-value">{users.length}</p>
            <p className="summary-subtitle">Current filtered scope</p>
          </div>
          <div className="summary-card summary-success">
            <p className="summary-title">Active Users</p>
            <p className="summary-value">{users.filter((userItem) => userItem.is_active).length}</p>
            <p className="summary-subtitle">Enabled accounts</p>
          </div>
          <div className="summary-card summary-warning">
            <p className="summary-title">Available Roles</p>
            <p className="summary-value">{roles.length}</p>
            <p className="summary-subtitle">From backend RBAC catalog</p>
          </div>
        </div>
      </section>

      <section className="panel-surface">
        <div className="admin-toolbar">
          {isSuperAdmin ? (
            <label className="filter-label">
              Tenant filter
              <input
                className="form-input"
                value={tenantCodeFilter}
                onChange={(event) => setTenantCodeFilter(event.target.value)}
                placeholder="demo"
              />
            </label>
          ) : (
            <div className="locked-scope">
              <p className="summary-title">Tenant scope</p>
              <p className="summary-value-small">{user?.tenant?.code || "-"}</p>
            </div>
          )}

          <button className="table-action" type="button" onClick={loadData} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error ? <div className="error-box">{error}</div> : null}
        {notice ? <div className="notice-box">{notice}</div> : null}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Tenant</th>
                <th>Status</th>
                <th>Roles</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    {loading ? "Loading users..." : "No users found for the selected scope."}
                  </td>
                </tr>
              ) : (
                users.map((userItem) => {
                  const rowRoles = normalizeRoleCodes(userItem.roles);

                  return (
                    <tr key={userItem.id}>
                      <td>{userItem.full_name || "-"}</td>
                      <td>{userItem.email || "-"}</td>
                      <td>{userItem.tenant_code || "-"}</td>
                      <td>
                        <StatusChip
                          status={userItem.is_active ? String(userItem.status || "ACTIVE") : "DISABLED"}
                        />
                      </td>
                      <td>{rowRoles.map((roleCode) => roleNameByCode[roleCode] || roleCode).join(", ") || "-"}</td>
                      <td>{formatDateTime(userItem.last_login_at)}</td>
                      <td>
                        <button
                          className="table-action"
                          type="button"
                          onClick={() => startEdit(userItem)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-form-grid">
        <section className="panel-surface">
          <div className="panel-headline">
            <h3>Create User</h3>
            <p>Provision tenant users with roles and compliant credentials.</p>
          </div>

          <form className="admin-form" onSubmit={handleCreateUser}>
            {isSuperAdmin ? (
              <label className="form-label" htmlFor="create-tenant-code">
                Tenant Code
                <input
                  id="create-tenant-code"
                  className="form-input"
                  value={createForm.tenantCode}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      tenantCode: event.target.value,
                    }))
                  }
                  disabled={createSaving}
                  required
                />
              </label>
            ) : null}

            <label className="form-label" htmlFor="create-full-name">
              Full Name
              <input
                id="create-full-name"
                className="form-input"
                value={createForm.fullName}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                disabled={createSaving}
                required
              />
            </label>

            <label className="form-label" htmlFor="create-email">
              Email
              <input
                id="create-email"
                type="email"
                className="form-input"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                disabled={createSaving}
                required
              />
            </label>

            <label className="form-label" htmlFor="create-password">
              Password
              <input
                id="create-password"
                type="password"
                className="form-input"
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                disabled={createSaving}
                required
              />
            </label>

            <label className="form-label" htmlFor="create-password-confirm">
              Confirm Password
              <input
                id="create-password-confirm"
                type="password"
                className="form-input"
                value={createForm.confirmPassword}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
                disabled={createSaving}
                required
              />
            </label>

            <div>
              <p className="summary-title">Role Assignment</p>
              <RolePicker
                roles={roles}
                selectedRoleCodes={createForm.roleCodes}
                onToggle={toggleCreateRole}
                disabled={createSaving}
              />
            </div>

            <div className="inline-actions">
              <button className="table-action" type="submit" disabled={createSaving}>
                {createSaving ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        </section>

        <section className="panel-surface">
          <div className="panel-headline">
            <h3>Edit User</h3>
            <p>Update profile, status, roles, and reset password.</p>
          </div>

          {!editForm || !editingUserId ? (
            <p className="empty-state">Select a user from the table to edit.</p>
          ) : (
            <>
              <form className="admin-form" onSubmit={handlePatchUser}>
                <label className="form-label" htmlFor="edit-full-name">
                  Full Name
                  <input
                    id="edit-full-name"
                    className="form-input"
                    value={editForm.fullName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    disabled={editSaving}
                    required
                  />
                </label>

                <label className="form-label" htmlFor="edit-status">
                  Status
                  <select
                    id="edit-status"
                    className="form-input"
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    disabled={editSaving}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DISABLED">DISABLED</option>
                  </select>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(editForm.isActive)}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    disabled={editSaving}
                  />
                  <span>Account enabled</span>
                </label>

                <div>
                  <p className="summary-title">Role Assignment</p>
                  <RolePicker
                    roles={roles}
                    selectedRoleCodes={editForm.roleCodes}
                    onToggle={toggleEditRole}
                    disabled={editSaving}
                  />
                </div>

                <div className="inline-actions">
                  <button className="table-action" type="submit" disabled={editSaving}>
                    {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button className="table-action" type="button" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </form>

              <form className="admin-form top-gap" onSubmit={handleResetPassword}>
                <label className="form-label" htmlFor="edit-new-password">
                  New Password
                  <input
                    id="edit-new-password"
                    type="password"
                    className="form-input"
                    value={editForm.newPassword}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        newPassword: event.target.value,
                      }))
                    }
                    disabled={resetSaving}
                  />
                </label>

                <label className="form-label" htmlFor="edit-new-password-confirm">
                  Confirm New Password
                  <input
                    id="edit-new-password-confirm"
                    type="password"
                    className="form-input"
                    value={editForm.confirmNewPassword}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        confirmNewPassword: event.target.value,
                      }))
                    }
                    disabled={resetSaving}
                  />
                </label>

                <div className="inline-actions">
                  <button className="table-action" type="submit" disabled={resetSaving}>
                    {resetSaving ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </section>
    </div>
  );
}

function StatusChip({ status }) {
  const value = String(status || "").toUpperCase();
  const tone = value === "ACTIVE" ? "ok" : "critical";

  return <span className={`pill pill-${tone}`}>{value || "UNKNOWN"}</span>;
}
