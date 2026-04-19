BEGIN;

-- -----------------------------------------------------------------------------
-- Required seed set: tenant, roles, default admin user, fleet, TRUCK01, CONT01
-- -----------------------------------------------------------------------------

INSERT INTO tenants (tenant_code, name, is_active)
VALUES ('demo', 'Demo Logistics', TRUE)
ON CONFLICT (tenant_code)
DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO roles (role_code, role_name, description)
VALUES
  ('super_admin', 'Super Admin', 'Cross-tenant platform administration with full access'),
  ('admin', 'Admin', 'Platform-level administration capabilities'),
  ('tenant_admin', 'Tenant Admin', 'Tenant administration and configuration'),
  ('fleet_manager', 'Fleet Manager', 'Fleet operations and logistics management'),
  ('viewer', 'Viewer', 'Read-only dashboard and reporting access')
ON CONFLICT (role_code)
DO UPDATE SET
  role_name = EXCLUDED.role_name,
  description = EXCLUDED.description,
  updated_at = NOW();

WITH selected_tenant AS (
  SELECT id
  FROM tenants
  WHERE tenant_code = 'demo'
)
INSERT INTO users (
  tenant_id,
  email,
  full_name,
  password_hash,
  status,
  is_active
)
SELECT
  t.id,
  'admin@demo.local',
  'Demo Admin',
  '$2b$12$C6UzMDM.H6dfI/f/IKcEe.6Q4fA9M9vDOMkMt2rt7NmBGG99nmCa',
  'ACTIVE',
  TRUE
FROM selected_tenant t
ON CONFLICT (tenant_id, email)
DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

WITH selected_tenant AS (
  SELECT id
  FROM tenants
  WHERE tenant_code = 'demo'
),
selected_user AS (
  SELECT u.id, u.tenant_id
  FROM users u
  JOIN selected_tenant t ON t.id = u.tenant_id
  WHERE u.email = 'admin@demo.local'
)
INSERT INTO user_roles (tenant_id, user_id, role_id)
SELECT
  su.tenant_id,
  su.id,
  r.id
FROM selected_user su
JOIN roles r ON r.role_code IN ('admin', 'tenant_admin')
ON CONFLICT (tenant_id, user_id, role_id)
DO NOTHING;

WITH selected_tenant AS (
  SELECT id
  FROM tenants
  WHERE tenant_code = 'demo'
)
INSERT INTO fleets (tenant_id, fleet_code, name, description, is_active)
SELECT
  t.id,
  'fleet-01',
  'Primary Fleet',
  'Default seeded fleet for Smart Cargo Monitoring demo',
  TRUE
FROM selected_tenant t
ON CONFLICT (tenant_id, fleet_code)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

WITH selected_tenant AS (
  SELECT id
  FROM tenants
  WHERE tenant_code = 'demo'
),
selected_fleet AS (
  SELECT f.id, f.tenant_id
  FROM fleets f
  JOIN selected_tenant t ON t.id = f.tenant_id
  WHERE f.fleet_code = 'fleet-01'
)
INSERT INTO trucks (
  tenant_id,
  fleet_id,
  truck_code,
  plate_number,
  model,
  is_active
)
SELECT
  sf.tenant_id,
  sf.id,
  'TRUCK01',
  'ABC-1234',
  'Demo Truck Unit',
  TRUE
FROM selected_fleet sf
ON CONFLICT (tenant_id, truck_code)
DO UPDATE SET
  fleet_id = EXCLUDED.fleet_id,
  plate_number = EXCLUDED.plate_number,
  model = EXCLUDED.model,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

WITH selected_tenant AS (
  SELECT id
  FROM tenants
  WHERE tenant_code = 'demo'
)
INSERT INTO containers (
  tenant_id,
  container_code,
  container_type,
  cargo_type,
  is_active
)
SELECT
  t.id,
  'CONT01',
  'STANDARD',
  'General Cargo',
  TRUE
FROM selected_tenant t
ON CONFLICT (tenant_id, container_code)
DO UPDATE SET
  container_type = EXCLUDED.container_type,
  cargo_type = EXCLUDED.cargo_type,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

WITH selected_tenant AS (
  SELECT id
  FROM tenants
  WHERE tenant_code = 'demo'
),
selected_truck AS (
  SELECT tr.id, tr.tenant_id
  FROM trucks tr
  JOIN selected_tenant t ON t.id = tr.tenant_id
  WHERE tr.truck_code = 'TRUCK01'
),
selected_container AS (
  SELECT c.id, c.tenant_id
  FROM containers c
  JOIN selected_tenant t ON t.id = c.tenant_id
  WHERE c.container_code = 'CONT01'
)
INSERT INTO truck_container_assignments (
  tenant_id,
  truck_id,
  container_id,
  status,
  assigned_at
)
SELECT
  st.tenant_id,
  st.id,
  sc.id,
  'ACTIVE',
  NOW()
FROM selected_truck st
JOIN selected_container sc ON sc.tenant_id = st.tenant_id
WHERE NOT EXISTS (
  SELECT 1
  FROM truck_container_assignments a
  WHERE a.tenant_id = st.tenant_id
    AND a.truck_id = st.id
    AND a.container_id = sc.id
    AND a.status = 'ACTIVE'
    AND a.unassigned_at IS NULL
);

COMMIT;
