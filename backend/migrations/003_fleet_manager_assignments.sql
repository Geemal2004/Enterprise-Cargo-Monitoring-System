BEGIN;

CREATE TABLE fleet_manager_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  truck_id UUID NOT NULL,
  container_id UUID NOT NULL,
  manager_user_id UUID NOT NULL,
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  status assignment_status_enum NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_fm_assign_truck_tenant FOREIGN KEY (truck_id, tenant_id)
    REFERENCES trucks(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_fm_assign_container_tenant FOREIGN KEY (container_id, tenant_id)
    REFERENCES containers(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_fm_assign_manager_tenant FOREIGN KEY (manager_user_id, tenant_id)
    REFERENCES users(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT chk_fm_assign_status_window CHECK (
    (status = 'ACTIVE' AND unassigned_at IS NULL) OR
    (status = 'ENDED' AND unassigned_at IS NOT NULL)
  ),
  CONSTRAINT chk_fm_assign_unassigned_after_assigned CHECK (
    unassigned_at IS NULL OR unassigned_at >= assigned_at
  )
);

CREATE INDEX idx_fm_assign_tenant_manager
  ON fleet_manager_assignments(tenant_id, manager_user_id, assigned_at DESC);
CREATE INDEX idx_fm_assign_tenant_asset
  ON fleet_manager_assignments(tenant_id, truck_id, container_id, assigned_at DESC);
CREATE UNIQUE INDEX uq_fm_assign_active_container
  ON fleet_manager_assignments(tenant_id, container_id)
  WHERE status = 'ACTIVE' AND unassigned_at IS NULL;

CREATE TRIGGER trg_fm_assign_set_updated_at
BEFORE UPDATE ON fleet_manager_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
