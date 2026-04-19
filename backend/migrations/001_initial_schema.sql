BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Enum Types
-- -----------------------------------------------------------------------------

CREATE TYPE user_status_enum AS ENUM (
  'ACTIVE',
  'DISABLED'
);

CREATE TYPE assignment_status_enum AS ENUM (
  'ACTIVE',
  'ENDED'
);

CREATE TYPE trip_status_enum AS ENUM (
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE device_type_enum AS ENUM (
  'SENSOR_NODE',
  'GATEWAY_NODE'
);

CREATE TYPE alert_type_enum AS ENUM (
  'HIGH_TEMPERATURE',
  'GAS_SPIKE',
  'SHOCK_DETECTED',
  'OFFLINE',
  'GPS_LOST'
);

CREATE TYPE alert_severity_enum AS ENUM (
  'INFO',
  'WARNING',
  'CRITICAL'
);

CREATE TYPE alert_status_enum AS ENUM (
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED'
);

CREATE TYPE alert_event_type_enum AS ENUM (
  'OPENED',
  'ACKNOWLEDGED',
  'RESOLVED',
  'REOPENED',
  'NOTE'
);

-- -----------------------------------------------------------------------------
-- Utility Functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_update_delete_on_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % operations are not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- Core Identity / Access
-- -----------------------------------------------------------------------------

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_tenants_code_format CHECK (tenant_code ~ '^[a-z0-9][a-z0-9_-]{1,63}$')
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status user_status_enum NOT NULL DEFAULT 'ACTIVE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email),
  CONSTRAINT uq_users_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT chk_users_email_format CHECK (position('@' in email) > 1),
  CONSTRAINT chk_users_deleted_after_created CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code TEXT NOT NULL UNIQUE,
  role_name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_roles_code_format CHECK (role_code ~ '^[a-z][a-z0-9_]{2,63}$')
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_roles_tenant_user_role UNIQUE (tenant_id, user_id, role_id),
  CONSTRAINT fk_user_roles_user_tenant FOREIGN KEY (user_id, tenant_id)
    REFERENCES users(id, tenant_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Fleet Domain
-- -----------------------------------------------------------------------------

CREATE TABLE fleets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fleets_tenant_code UNIQUE (tenant_id, fleet_code),
  CONSTRAINT uq_fleets_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT chk_fleets_code_format CHECK (fleet_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$'),
  CONSTRAINT chk_fleets_deleted_after_created CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

CREATE TABLE trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_id UUID NOT NULL,
  truck_code TEXT NOT NULL,
  plate_number TEXT,
  model TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_trucks_tenant_code UNIQUE (tenant_id, truck_code),
  CONSTRAINT uq_trucks_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT fk_trucks_fleet_tenant FOREIGN KEY (fleet_id, tenant_id)
    REFERENCES fleets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT chk_trucks_code_format CHECK (truck_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$'),
  CONSTRAINT chk_trucks_deleted_after_created CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

CREATE TABLE containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  container_code TEXT NOT NULL,
  container_type TEXT,
  cargo_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_containers_tenant_code UNIQUE (tenant_id, container_code),
  CONSTRAINT uq_containers_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT chk_containers_code_format CHECK (container_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$'),
  CONSTRAINT chk_containers_deleted_after_created CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

CREATE TABLE truck_container_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  truck_id UUID NOT NULL,
  container_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  status assignment_status_enum NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_assignments_truck_tenant FOREIGN KEY (truck_id, tenant_id)
    REFERENCES trucks(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_container_tenant FOREIGN KEY (container_id, tenant_id)
    REFERENCES containers(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT chk_assignments_status_window CHECK (
    (status = 'ACTIVE' AND unassigned_at IS NULL) OR
    (status = 'ENDED' AND unassigned_at IS NOT NULL)
  ),
  CONSTRAINT chk_assignments_unassigned_after_assigned CHECK (
    unassigned_at IS NULL OR unassigned_at >= assigned_at
  )
);

CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_code TEXT NOT NULL,
  route_name TEXT,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  origin_lat NUMERIC(9,6),
  origin_lon NUMERIC(9,6),
  destination_lat NUMERIC(9,6),
  destination_lon NUMERIC(9,6),
  waypoints_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_routes_tenant_code UNIQUE (tenant_id, route_code),
  CONSTRAINT uq_routes_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT chk_routes_code_format CHECK (route_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$'),
  CONSTRAINT chk_routes_origin_lat CHECK (origin_lat IS NULL OR origin_lat BETWEEN -90 AND 90),
  CONSTRAINT chk_routes_origin_lon CHECK (origin_lon IS NULL OR origin_lon BETWEEN -180 AND 180),
  CONSTRAINT chk_routes_destination_lat CHECK (destination_lat IS NULL OR destination_lat BETWEEN -90 AND 90),
  CONSTRAINT chk_routes_destination_lon CHECK (destination_lon IS NULL OR destination_lon BETWEEN -180 AND 180),
  CONSTRAINT chk_routes_waypoints_json CHECK (jsonb_typeof(waypoints_json) = 'array')
);

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trip_code TEXT NOT NULL,
  fleet_id UUID,
  truck_id UUID NOT NULL,
  container_id UUID NOT NULL,
  route_id UUID,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  planned_start_at TIMESTAMPTZ,
  planned_end_at TIMESTAMPTZ,
  actual_start_at TIMESTAMPTZ,
  actual_end_at TIMESTAMPTZ,
  status trip_status_enum NOT NULL DEFAULT 'PLANNED',
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_trips_tenant_code UNIQUE (tenant_id, trip_code),
  CONSTRAINT uq_trips_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT fk_trips_fleet_tenant FOREIGN KEY (fleet_id, tenant_id)
    REFERENCES fleets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_truck_tenant FOREIGN KEY (truck_id, tenant_id)
    REFERENCES trucks(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_container_tenant FOREIGN KEY (container_id, tenant_id)
    REFERENCES containers(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_trips_route_tenant FOREIGN KEY (route_id, tenant_id)
    REFERENCES routes(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT chk_trips_code_format CHECK (trip_code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$'),
  CONSTRAINT chk_trips_planned_window CHECK (
    planned_end_at IS NULL OR planned_start_at IS NULL OR planned_end_at >= planned_start_at
  ),
  CONSTRAINT chk_trips_actual_window CHECK (
    actual_end_at IS NULL OR actual_start_at IS NULL OR actual_end_at >= actual_start_at
  ),
  CONSTRAINT chk_trips_completed_has_end CHECK (
    status <> 'COMPLETED' OR actual_end_at IS NOT NULL
  ),
  CONSTRAINT chk_trips_metadata_json CHECK (jsonb_typeof(metadata_json) = 'object')
);

-- -----------------------------------------------------------------------------
-- Device Domain
-- -----------------------------------------------------------------------------

CREATE TABLE device_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_id UUID,
  truck_id UUID,
  container_id UUID,
  device_type device_type_enum NOT NULL,
  device_code TEXT NOT NULL,
  mac_address TEXT,
  serial_number TEXT,
  firmware_version TEXT,
  last_seen_at TIMESTAMPTZ,
  active_flag BOOLEAN NOT NULL DEFAULT TRUE,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_device_registry_tenant_code UNIQUE (tenant_id, device_code),
  CONSTRAINT uq_device_registry_tenant_mac UNIQUE (tenant_id, mac_address),
  CONSTRAINT uq_device_registry_tenant_serial UNIQUE (tenant_id, serial_number),
  CONSTRAINT uq_device_registry_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT fk_device_registry_fleet_tenant FOREIGN KEY (fleet_id, tenant_id)
    REFERENCES fleets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_device_registry_truck_tenant FOREIGN KEY (truck_id, tenant_id)
    REFERENCES trucks(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_device_registry_container_tenant FOREIGN KEY (container_id, tenant_id)
    REFERENCES containers(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT chk_device_registry_code_format CHECK (device_code ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{1,63}$'),
  CONSTRAINT chk_device_registry_mac_format CHECK (
    mac_address IS NULL OR mac_address ~* '^([0-9A-F]{2}:){5}[0-9A-F]{2}$'
  ),
  CONSTRAINT chk_device_registry_metadata_json CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE TABLE device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID NOT NULL,
  mqtt_client_id TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  disconnect_reason TEXT,
  ip_address INET,
  active_flag BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_device_sessions_device_tenant FOREIGN KEY (device_id, tenant_id)
    REFERENCES device_registry(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT chk_device_sessions_window CHECK (
    disconnected_at IS NULL OR disconnected_at >= connected_at
  ),
  CONSTRAINT chk_device_sessions_active_consistency CHECK (
    (active_flag AND disconnected_at IS NULL) OR
    ((NOT active_flag) AND disconnected_at IS NOT NULL)
  )
);

-- -----------------------------------------------------------------------------
-- Telemetry Domain
-- -----------------------------------------------------------------------------

CREATE TABLE telemetry_latest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_id UUID,
  truck_id UUID NOT NULL,
  container_id UUID NOT NULL,
  trip_id UUID,
  gateway_device_id UUID,
  sensor_device_id UUID,
  mqtt_topic TEXT NOT NULL,
  seq BIGINT NOT NULL,
  source_ts TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gps_lat NUMERIC(9,6),
  gps_lon NUMERIC(9,6),
  speed_kph NUMERIC(8,2),
  temperature_c NUMERIC(7,2),
  humidity_pct NUMERIC(5,2),
  pressure_hpa NUMERIC(7,2),
  tilt_deg NUMERIC(7,2),
  shock BOOLEAN NOT NULL DEFAULT FALSE,
  gas_raw INTEGER,
  gas_alert BOOLEAN NOT NULL DEFAULT FALSE,
  sd_ok BOOLEAN,
  gps_fix BOOLEAN,
  uplink TEXT,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_telemetry_latest_scope UNIQUE (tenant_id, truck_id, container_id),
  CONSTRAINT uq_telemetry_latest_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT fk_telemetry_latest_fleet_tenant FOREIGN KEY (fleet_id, tenant_id)
    REFERENCES fleets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_telemetry_latest_truck_tenant FOREIGN KEY (truck_id, tenant_id)
    REFERENCES trucks(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_telemetry_latest_container_tenant FOREIGN KEY (container_id, tenant_id)
    REFERENCES containers(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_telemetry_latest_trip_tenant FOREIGN KEY (trip_id, tenant_id)
    REFERENCES trips(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_telemetry_latest_gateway_tenant FOREIGN KEY (gateway_device_id, tenant_id)
    REFERENCES device_registry(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_telemetry_latest_sensor_tenant FOREIGN KEY (sensor_device_id, tenant_id)
    REFERENCES device_registry(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT chk_telemetry_latest_seq CHECK (seq >= 0),
  CONSTRAINT chk_telemetry_latest_gps_lat CHECK (gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90),
  CONSTRAINT chk_telemetry_latest_gps_lon CHECK (gps_lon IS NULL OR gps_lon BETWEEN -180 AND 180),
  CONSTRAINT chk_telemetry_latest_speed CHECK (speed_kph IS NULL OR speed_kph >= 0),
  CONSTRAINT chk_telemetry_latest_humidity CHECK (humidity_pct IS NULL OR humidity_pct BETWEEN 0 AND 100),
  CONSTRAINT chk_telemetry_latest_pressure CHECK (pressure_hpa IS NULL OR pressure_hpa > 0),
  CONSTRAINT chk_telemetry_latest_gas CHECK (gas_raw IS NULL OR gas_raw BETWEEN 0 AND 4095),
  CONSTRAINT chk_telemetry_latest_payload CHECK (jsonb_typeof(raw_payload) = 'object')
);

CREATE TABLE telemetry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_id UUID,
  truck_id UUID NOT NULL,
  container_id UUID NOT NULL,
  trip_id UUID,
  gateway_device_id UUID,
  sensor_device_id UUID,
  mqtt_topic TEXT NOT NULL,
  seq BIGINT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gps_lat NUMERIC(9,6),
  gps_lon NUMERIC(9,6),
  speed_kph NUMERIC(8,2),
  temperature_c NUMERIC(7,2),
  humidity_pct NUMERIC(5,2),
  pressure_hpa NUMERIC(7,2),
  tilt_deg NUMERIC(7,2),
  shock BOOLEAN NOT NULL DEFAULT FALSE,
  gas_raw INTEGER,
  gas_alert BOOLEAN NOT NULL DEFAULT FALSE,
  sd_ok BOOLEAN,
  gps_fix BOOLEAN,
  uplink TEXT,
  raw_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_telemetry_history_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT fk_telemetry_history_fleet_tenant FOREIGN KEY (fleet_id, tenant_id)
    REFERENCES fleets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_telemetry_history_truck_tenant FOREIGN KEY (truck_id, tenant_id)
    REFERENCES trucks(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_telemetry_history_container_tenant FOREIGN KEY (container_id, tenant_id)
    REFERENCES containers(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_telemetry_history_trip_tenant FOREIGN KEY (trip_id, tenant_id)
    REFERENCES trips(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_telemetry_history_gateway_tenant FOREIGN KEY (gateway_device_id, tenant_id)
    REFERENCES device_registry(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_telemetry_history_sensor_tenant FOREIGN KEY (sensor_device_id, tenant_id)
    REFERENCES device_registry(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT chk_telemetry_history_seq CHECK (seq >= 0),
  CONSTRAINT chk_telemetry_history_gps_lat CHECK (gps_lat IS NULL OR gps_lat BETWEEN -90 AND 90),
  CONSTRAINT chk_telemetry_history_gps_lon CHECK (gps_lon IS NULL OR gps_lon BETWEEN -180 AND 180),
  CONSTRAINT chk_telemetry_history_speed CHECK (speed_kph IS NULL OR speed_kph >= 0),
  CONSTRAINT chk_telemetry_history_humidity CHECK (humidity_pct IS NULL OR humidity_pct BETWEEN 0 AND 100),
  CONSTRAINT chk_telemetry_history_pressure CHECK (pressure_hpa IS NULL OR pressure_hpa > 0),
  CONSTRAINT chk_telemetry_history_gas CHECK (gas_raw IS NULL OR gas_raw BETWEEN 0 AND 4095),
  CONSTRAINT chk_telemetry_history_payload CHECK (jsonb_typeof(raw_payload) = 'object')
);

-- -----------------------------------------------------------------------------
-- Alerting Domain
-- -----------------------------------------------------------------------------

CREATE TABLE alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_id UUID,
  rule_name TEXT NOT NULL,
  alert_type alert_type_enum NOT NULL,
  severity alert_severity_enum NOT NULL,
  threshold_numeric NUMERIC(12,2),
  threshold_boolean BOOLEAN,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  config_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_alert_rules_tenant_name UNIQUE (tenant_id, rule_name),
  CONSTRAINT uq_alert_rules_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT fk_alert_rules_fleet_tenant FOREIGN KEY (fleet_id, tenant_id)
    REFERENCES fleets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT chk_alert_rules_duration CHECK (duration_seconds >= 0),
  CONSTRAINT chk_alert_rules_threshold_present CHECK (
    threshold_numeric IS NOT NULL OR threshold_boolean IS NOT NULL OR duration_seconds > 0
  ),
  CONSTRAINT chk_alert_rules_config_json CHECK (jsonb_typeof(config_json) = 'object')
);

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fleet_id UUID,
  truck_id UUID NOT NULL,
  container_id UUID NOT NULL,
  trip_id UUID,
  alert_rule_id UUID,
  alert_type alert_type_enum NOT NULL,
  severity alert_severity_enum NOT NULL,
  status alert_status_enum NOT NULL DEFAULT 'OPEN',
  title TEXT,
  message TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latest_value_numeric NUMERIC(12,2),
  latest_value_boolean BOOLEAN,
  threshold_value_numeric NUMERIC(12,2),
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_alerts_id_tenant UNIQUE (id, tenant_id),
  CONSTRAINT fk_alerts_fleet_tenant FOREIGN KEY (fleet_id, tenant_id)
    REFERENCES fleets(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_alerts_truck_tenant FOREIGN KEY (truck_id, tenant_id)
    REFERENCES trucks(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_alerts_container_tenant FOREIGN KEY (container_id, tenant_id)
    REFERENCES containers(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_alerts_trip_tenant FOREIGN KEY (trip_id, tenant_id)
    REFERENCES trips(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT fk_alerts_rule_tenant FOREIGN KEY (alert_rule_id, tenant_id)
    REFERENCES alert_rules(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT chk_alerts_ack_after_open CHECK (
    acknowledged_at IS NULL OR acknowledged_at >= opened_at
  ),
  CONSTRAINT chk_alerts_resolved_after_open CHECK (
    resolved_at IS NULL OR resolved_at >= opened_at
  ),
  CONSTRAINT chk_alerts_last_event_after_open CHECK (
    last_event_at >= opened_at
  ),
  CONSTRAINT chk_alerts_lifecycle_consistency CHECK (
    (status = 'OPEN' AND acknowledged_at IS NULL AND resolved_at IS NULL) OR
    (status = 'ACKNOWLEDGED' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL) OR
    (status = 'RESOLVED' AND resolved_at IS NOT NULL)
  ),
  CONSTRAINT chk_alerts_metadata_json CHECK (jsonb_typeof(metadata_json) = 'object')
);

CREATE TABLE alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL,
  event_type alert_event_type_enum NOT NULL,
  from_status alert_status_enum,
  to_status alert_status_enum NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_alert_events_alert_tenant FOREIGN KEY (alert_id, tenant_id)
    REFERENCES alerts(id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT chk_alert_events_transition_consistency CHECK (
    (event_type = 'OPENED' AND to_status = 'OPEN') OR
    (event_type = 'ACKNOWLEDGED' AND to_status = 'ACKNOWLEDGED') OR
    (event_type = 'RESOLVED' AND to_status = 'RESOLVED') OR
    (event_type = 'REOPENED' AND to_status = 'OPEN') OR
    (event_type = 'NOTE')
  ),
  CONSTRAINT chk_alert_events_metadata_json CHECK (jsonb_typeof(metadata_json) = 'object')
);

-- -----------------------------------------------------------------------------
-- Audit Domain
-- -----------------------------------------------------------------------------

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_audit_logs_action_not_blank CHECK (length(trim(action)) > 0),
  CONSTRAINT chk_audit_logs_target_type_not_blank CHECK (length(trim(target_type)) > 0),
  CONSTRAINT chk_audit_logs_metadata_json CHECK (jsonb_typeof(metadata_json) = 'object')
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

CREATE INDEX idx_users_tenant_status ON users(tenant_id, is_active, status);
CREATE INDEX idx_users_last_login_at ON users(last_login_at DESC);

CREATE INDEX idx_user_roles_tenant_user ON user_roles(tenant_id, user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

CREATE INDEX idx_fleets_tenant_active ON fleets(tenant_id, is_active);

CREATE INDEX idx_trucks_tenant_fleet ON trucks(tenant_id, fleet_id);
CREATE INDEX idx_trucks_tenant_active ON trucks(tenant_id, is_active);

CREATE INDEX idx_containers_tenant_active ON containers(tenant_id, is_active);

CREATE INDEX idx_assignments_tenant_truck ON truck_container_assignments(tenant_id, truck_id, assigned_at DESC);
CREATE INDEX idx_assignments_tenant_container ON truck_container_assignments(tenant_id, container_id, assigned_at DESC);
CREATE UNIQUE INDEX uq_assignments_active_truck ON truck_container_assignments(tenant_id, truck_id)
  WHERE status = 'ACTIVE' AND unassigned_at IS NULL;
CREATE UNIQUE INDEX uq_assignments_active_container ON truck_container_assignments(tenant_id, container_id)
  WHERE status = 'ACTIVE' AND unassigned_at IS NULL;

CREATE INDEX idx_routes_tenant ON routes(tenant_id);

CREATE INDEX idx_trips_tenant_status ON trips(tenant_id, status, planned_start_at DESC);
CREATE INDEX idx_trips_tenant_asset ON trips(tenant_id, truck_id, container_id);

CREATE INDEX idx_device_registry_tenant_type_active ON device_registry(tenant_id, device_type, active_flag);
CREATE INDEX idx_device_registry_last_seen_at ON device_registry(last_seen_at DESC);
CREATE INDEX idx_device_registry_tenant_asset ON device_registry(tenant_id, truck_id, container_id);

CREATE INDEX idx_device_sessions_tenant_device_time ON device_sessions(tenant_id, device_id, connected_at DESC);
CREATE INDEX idx_device_sessions_active ON device_sessions(tenant_id, connected_at DESC)
  WHERE active_flag = TRUE;

CREATE INDEX idx_telemetry_latest_tenant_received ON telemetry_latest(tenant_id, received_at DESC);
CREATE INDEX idx_telemetry_latest_tenant_fleet ON telemetry_latest(tenant_id, fleet_id);
CREATE INDEX idx_telemetry_latest_status_flags ON telemetry_latest(tenant_id, gps_fix, gas_alert, shock);

CREATE INDEX idx_telemetry_history_tenant_time ON telemetry_history(tenant_id, occurred_at DESC);
CREATE INDEX idx_telemetry_history_tenant_asset_time ON telemetry_history(tenant_id, truck_id, container_id, occurred_at DESC);
CREATE INDEX idx_telemetry_history_tenant_trip_time ON telemetry_history(tenant_id, trip_id, occurred_at DESC);
CREATE INDEX idx_telemetry_history_payload_gin ON telemetry_history USING GIN(raw_payload);

CREATE INDEX idx_alert_rules_tenant_enabled ON alert_rules(tenant_id, enabled, alert_type);

CREATE INDEX idx_alerts_tenant_status_severity ON alerts(tenant_id, status, severity, opened_at DESC);
CREATE INDEX idx_alerts_tenant_asset_status ON alerts(tenant_id, truck_id, container_id, status);
CREATE INDEX idx_alerts_tenant_type_status ON alerts(tenant_id, alert_type, status);
CREATE UNIQUE INDEX uq_alerts_active_per_source ON alerts(tenant_id, truck_id, container_id, alert_type)
  WHERE status IN ('OPEN', 'ACKNOWLEDGED');

CREATE INDEX idx_alert_events_alert_time ON alert_events(alert_id, event_at DESC);
CREATE INDEX idx_alert_events_tenant_time ON alert_events(tenant_id, event_at DESC);

CREATE INDEX idx_audit_logs_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor_time ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_target_lookup ON audit_logs(target_type, target_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- Triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER trg_tenants_set_updated_at
BEFORE UPDATE ON tenants
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fleets_set_updated_at
BEFORE UPDATE ON fleets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trucks_set_updated_at
BEFORE UPDATE ON trucks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_containers_set_updated_at
BEFORE UPDATE ON containers
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_assignments_set_updated_at
BEFORE UPDATE ON truck_container_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_routes_set_updated_at
BEFORE UPDATE ON routes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trips_set_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_device_registry_set_updated_at
BEFORE UPDATE ON device_registry
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_device_sessions_set_updated_at
BEFORE UPDATE ON device_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_telemetry_latest_set_updated_at
BEFORE UPDATE ON telemetry_latest
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_alert_rules_set_updated_at
BEFORE UPDATE ON alert_rules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_alerts_set_updated_at
BEFORE UPDATE ON alerts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_telemetry_history_append_only
BEFORE UPDATE OR DELETE ON telemetry_history
FOR EACH ROW EXECUTE FUNCTION reject_update_delete_on_append_only();

CREATE TRIGGER trg_alert_events_append_only
BEFORE UPDATE OR DELETE ON alert_events
FOR EACH ROW EXECUTE FUNCTION reject_update_delete_on_append_only();

CREATE TRIGGER trg_audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_update_delete_on_append_only();

COMMIT;
