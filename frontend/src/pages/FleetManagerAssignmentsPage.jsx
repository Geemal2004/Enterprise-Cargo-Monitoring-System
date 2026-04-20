import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFleetManagerAssignment,
  endFleetManagerAssignment,
  fetchAssignablePairs,
  fetchFleetManagerAssignments,
  fetchFleetManagers,
} from "../api/adminApi";
import { useAuthContext } from "../context/AuthContext";
import { formatDateTime } from "../types/telemetry";

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

export default function FleetManagerAssignmentsPage() {
  const { user, hasAnyRole } = useAuthContext();
  const isSuperAdmin = hasAnyRole(["super_admin"]);

  const [tenantCodeFilter, setTenantCodeFilter] = useState("");

  const [managers, setManagers] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [assignSaving, setAssignSaving] = useState(false);
  const [endSavingId, setEndSavingId] = useState("");

  const [formState, setFormState] = useState({
    managerUserId: "",
    pairId: "",
    notes: "",
  });

  const scopedTenantCode = useMemo(() => {
    if (isSuperAdmin) {
      return tenantCodeFilter.trim();
    }
    return user?.tenant?.code || "";
  }, [isSuperAdmin, tenantCodeFilter, user]);

  const pairById = useMemo(() => {
    const map = new Map();
    for (const pair of pairs) {
      if (pair?.assignment_id) {
        map.set(pair.assignment_id, pair);
      }
    }
    return map;
  }, [pairs]);

  const loadData = useCallback(async () => {
    if (!scopedTenantCode) {
      setManagers([]);
      setPairs([]);
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = { tenantCode: scopedTenantCode };
      const [managersPayload, pairsPayload, assignmentsPayload] = await Promise.all([
        fetchFleetManagers(query),
        fetchAssignablePairs(query),
        fetchFleetManagerAssignments({ ...query, status: "ACTIVE" }),
      ]);

      setManagers(Array.isArray(managersPayload?.items) ? managersPayload.items : []);
      setPairs(Array.isArray(pairsPayload?.items) ? pairsPayload.items : []);
      setAssignments(
        Array.isArray(assignmentsPayload?.items) ? assignmentsPayload.items : []
      );
    } catch (loadError) {
      setError(extractErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [scopedTenantCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAssign(event) {
    event.preventDefault();

    if (!scopedTenantCode) {
      setError("tenantCode is required for assignment.");
      return;
    }

    const pair = pairById.get(formState.pairId);
    if (!pair) {
      setError("Select a truck + container pair.");
      return;
    }

    if (!formState.managerUserId) {
      setError("Select a fleet manager.");
      return;
    }

    setAssignSaving(true);
    setError("");
    setNotice("");

    try {
      await createFleetManagerAssignment({
        tenantCode: scopedTenantCode,
        truckId: pair.truck_id,
        containerId: pair.container_id,
        managerUserId: formState.managerUserId,
        notes: formState.notes.trim() ? formState.notes.trim() : null,
      });

      setNotice("Assignment created.");
      setFormState({
        managerUserId: "",
        pairId: "",
        notes: "",
      });
      await loadData();
    } catch (assignError) {
      setError(extractErrorMessage(assignError));
    } finally {
      setAssignSaving(false);
    }
  }

  async function handleEndAssignment(assignmentId) {
    if (!assignmentId) {
      return;
    }

    setEndSavingId(assignmentId);
    setError("");
    setNotice("");

    try {
      await endFleetManagerAssignment(assignmentId, {});
      setNotice("Assignment ended.");
      await loadData();
    } catch (endError) {
      setError(extractErrorMessage(endError));
    } finally {
      setEndSavingId("");
    }
  }

  return (
    <div className="page-grid">
      <section>
        <div className="panel-headline spaced-bottom">
          <h2>Fleet Manager Assignments</h2>
          <p>Assign active truck + container pairs to fleet managers.</p>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <p className="summary-title">Active Managers</p>
            <p className="summary-value">{managers.length}</p>
            <p className="summary-subtitle">Fleet managers in scope</p>
          </div>
          <div className="summary-card summary-success">
            <p className="summary-title">Assignable Pairs</p>
            <p className="summary-value">{pairs.length}</p>
            <p className="summary-subtitle">Truck + container matches</p>
          </div>
          <div className="summary-card summary-warning">
            <p className="summary-title">Active Assignments</p>
            <p className="summary-value">{assignments.length}</p>
            <p className="summary-subtitle">Containers with owners</p>
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

        {!scopedTenantCode ? (
          <p className="empty-state">Enter a tenant code to load assignments.</p>
        ) : null}

        <form className="admin-form" onSubmit={handleAssign}>
          <label className="form-label" htmlFor="assign-manager">
            Fleet Manager
            <select
              id="assign-manager"
              className="form-input"
              value={formState.managerUserId}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  managerUserId: event.target.value,
                }))
              }
              disabled={assignSaving || !scopedTenantCode}
              required
            >
              <option value="">Select manager</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name || manager.email}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label" htmlFor="assign-pair">
            Truck + Container Pair
            <select
              id="assign-pair"
              className="form-input"
              value={formState.pairId}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  pairId: event.target.value,
                }))
              }
              disabled={assignSaving || !scopedTenantCode}
              required
            >
              <option value="">Select pair</option>
              {pairs.map((pair) => (
                <option key={pair.assignment_id} value={pair.assignment_id}>
                  {pair.truck_code} / {pair.container_code}
                </option>
              ))}
            </select>
          </label>

          <label className="form-label" htmlFor="assign-notes">
            Notes (optional)
            <textarea
              id="assign-notes"
              className="form-input"
              rows={3}
              value={formState.notes}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              disabled={assignSaving}
            />
          </label>

          <div className="inline-actions">
            <button className="table-action" type="submit" disabled={assignSaving}>
              {assignSaving ? "Assigning..." : "Assign Manager"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel-surface">
        <div className="panel-headline">
          <h3>Active Assignments</h3>
          <p>Current ownership for each active container.</p>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Truck</th>
                <th>Container</th>
                <th>Assigned At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    {loading ? "Loading assignments..." : "No active assignments."}
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.manager_name || assignment.manager_email || "-"}</td>
                    <td>{assignment.truck_code || "-"}</td>
                    <td>{assignment.container_code || "-"}</td>
                    <td>{formatDateTime(assignment.assigned_at)}</td>
                    <td>
                      <button
                        className="table-action"
                        type="button"
                        onClick={() => handleEndAssignment(assignment.id)}
                        disabled={endSavingId === assignment.id}
                      >
                        {endSavingId === assignment.id ? "Ending..." : "End"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
