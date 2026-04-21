#!/usr/bin/env python3
"""
Smart Cargo fleet simulator (road-following GPS route mode).

Publishes telemetry messages to EMQX in the same topic and payload shape
used by the gateway firmware:
  tenant/{tenantId}/truck/{truckId}/container/{containerId}/telemetry

Default GPS route:
  Start: Jaffna  (9.6606, 80.0117)
  End:   Matara  (6.1329, 80.5280)

This variant fetches actual driving geometry from the public OSRM API and
then moves each simulated truck along those road points.

Usage examples:
  python scripts/simulate_truck_jaffna_matara_osrm.py
  python scripts/simulate_truck_jaffna_matara_osrm.py --truck-id TRUCK03 --container-id CONT03
  python scripts/simulate_truck_jaffna_matara_osrm.py --route-steps 300 --interval 1.0
  python scripts/simulate_truck_jaffna_matara_osrm.py --loop-route
"""

from __future__ import annotations

import argparse
import json
import os
import random
import signal
import ssl
import sys
import threading
import time
import uuid
import requests
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple


def load_env_file(path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not path.exists():
        return values

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def parse_bool(value: str | None, fallback: bool) -> bool:
    if value is None or value == "":
        return fallback
    return value.strip().lower() in {"1", "true", "yes", "on"}


def import_mqtt_client_module():
    try:
        import paho.mqtt.client as mqtt  # type: ignore
    except ImportError:
        print(
            "Missing dependency: paho-mqtt\n"
            "Install it with: pip install paho-mqtt",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return mqtt


def make_parser(defaults: Dict[str, str]) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Publish simulated truck telemetry to EMQX (road-following OSRM mode).",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )

    parser.add_argument("--broker-host", default=defaults.get("MQTT_BROKER_HOST", ""))
    parser.add_argument("--broker-port", type=int, default=int(defaults.get("MQTT_BROKER_PORT", "8883")))
    parser.add_argument("--username", default=defaults.get("MQTT_USERNAME", ""))
    parser.add_argument("--password", default=defaults.get("MQTT_PASSWORD", ""))
    parser.add_argument("--ca-path", default=defaults.get("MQTT_CA_PATH", ""))
    parser.add_argument(
        "--reject-unauthorized",
        type=lambda s: str(s).lower() in {"1", "true", "yes", "on"},
        default=parse_bool(defaults.get("MQTT_REJECT_UNAUTHORIZED"), True),
        help="Validate broker certificate.",
    )

    parser.add_argument("--tenant-id", default="demo")
    parser.add_argument("--fleet-id", default="fleet-01")

    parser.add_argument("--truck-id", default="TRUCK02", help="Used when fleet-size=1.")
    parser.add_argument("--container-id", default="CONT02", help="Used when fleet-size=1.")

    parser.add_argument("--fleet-size", type=int, default=1, help="Number of truck/container pairs to simulate.")
    parser.add_argument("--start-index", type=int, default=2, help="Starting index for generated IDs when fleet-size>1.")
    parser.add_argument("--truck-prefix", default="TRUCK")
    parser.add_argument("--container-prefix", default="CONT")

    parser.add_argument("--interval", type=float, default=2.5, help="Seconds between publish cycles.")
    parser.add_argument("--qos", type=int, choices=[0, 1], default=1)
    parser.add_argument("--count", type=int, default=0, help="Publish cycles before exit. 0 means forever.")

    parser.add_argument("--start-lat", type=float, default=9.6606, help="Route start latitude (Jaffna).")
    parser.add_argument("--start-lon", type=float, default=80.0117, help="Route start longitude (Jaffna).")
    parser.add_argument("--end-lat", type=float, default=6.1329, help="Route end latitude (Matara).")
    parser.add_argument("--end-lon", type=float, default=80.5280, help="Route end longitude (Matara).")
    parser.add_argument("--route-steps", type=int, default=1200, help="Number of publish cycles to move from start to end.")
    parser.add_argument("--loop-route", action="store_true", help="Restart route from start after reaching end.")
    parser.add_argument("--speed-kph", type=float, default=45.0, help="Stable speed value for GPS payload.")

    parser.add_argument("--temp-base", type=float, default=29.5)
    parser.add_argument("--temp-noise", type=float, default=2.2)
    parser.add_argument("--temp-spike-every", type=int, default=0, help="Every N cycles force high temperature. 0 disables.")

    parser.add_argument("--humidity-base", type=float, default=78.0)
    parser.add_argument("--humidity-noise", type=float, default=8.0)

    parser.add_argument("--pressure-base", type=float, default=1009.4)
    parser.add_argument("--pressure-noise", type=float, default=1.5)

    parser.add_argument("--gas-base", type=float, default=250.0)
    parser.add_argument("--gas-noise", type=float, default=120.0)
    parser.add_argument("--gas-spike-every", type=int, default=0, help="Every N cycles force high gas level. 0 disables.")

    parser.add_argument("--tilt-base", type=float, default=0.8)
    parser.add_argument("--tilt-noise", type=float, default=4.0)
    parser.add_argument("--shock-every", type=int, default=0, help="Every N cycles set shock=true. 0 disables.")

    parser.add_argument("--client-id", default="", help="Optional fixed MQTT client id.")
    parser.add_argument("--print-payload", action="store_true")

    return parser


@dataclass
class DeviceState:
    truck_id: str
    container_id: str
    seq: int
    route_step: int


def make_device_ids(args: argparse.Namespace) -> List[Tuple[str, str]]:
    if args.fleet_size <= 1:
        return [(args.truck_id, args.container_id)]

    pairs: List[Tuple[str, str]] = []
    for idx in range(args.start_index, args.start_index + args.fleet_size):
        truck = f"{args.truck_prefix}{idx:02d}"
        container = f"{args.container_prefix}{idx:02d}"
        pairs.append((truck, container))
    return pairs


def make_topic(tenant_id: str, truck_id: str, container_id: str) -> str:
    return f"tenant/{tenant_id}/truck/{truck_id}/container/{container_id}/telemetry"


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def should_spike(cycle_no: int, every_n: int) -> bool:
    return every_n > 0 and cycle_no > 0 and (cycle_no % every_n == 0)


def fetch_real_route(start_lat: float, start_lon: float, end_lat: float, end_lon: float) -> List[Tuple[float, float]]:
    print("[ROUTE] Fetching real road route from OSRM API...")
    url = (
        "http://router.project-osrm.org/route/v1/driving/"
        f"{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&geometries=geojson"
    )

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("code") == "Ok":
            coords = data.get("routes", [{}])[0].get("geometry", {}).get("coordinates", [])
            route: List[Tuple[float, float]] = []
            for point in coords:
                if isinstance(point, (list, tuple)) and len(point) >= 2:
                    route.append((float(point[0]), float(point[1])))

            if route:
                print(f"[ROUTE] Successfully fetched {len(route)} GPS points along the road.")
                return route

            print("[ROUTE] OSRM response had no usable coordinates.", file=sys.stderr)
        else:
            print(f"[ROUTE] Failed to get route: {data.get('message')}", file=sys.stderr)
    except Exception as error:
        print(f"[ROUTE] Error contacting OSRM API: {error}", file=sys.stderr)

    print("[ROUTE] Falling back to linear interpolation.")
    return []


def compute_route_position(
    args: argparse.Namespace,
    device: DeviceState,
    route_coords: List[Tuple[float, float]],
) -> Tuple[float, float]:
    steps = max(1, args.route_steps)
    progress = clamp(device.route_step / steps, 0.0, 1.0)

    if not route_coords:
        lat = args.start_lat + (args.end_lat - args.start_lat) * progress
        lon = args.start_lon + (args.end_lon - args.start_lon) * progress
    else:
        total_points = len(route_coords)
        float_index = progress * (total_points - 1)
        idx = int(float_index)

        if idx >= total_points - 1:
            lon, lat = route_coords[-1]
        else:
            lon1, lat1 = route_coords[idx]
            lon2, lat2 = route_coords[idx + 1]
            t = float_index - idx
            lon = lon1 + (lon2 - lon1) * t
            lat = lat1 + (lat2 - lat1) * t

    if device.route_step < steps:
        device.route_step += 1
    elif args.loop_route:
        device.route_step = 0

    return round(lat, 6), round(lon, 6)


def build_payload(
    args: argparse.Namespace,
    device: DeviceState,
    cycle_no: int,
    route_coords: List[Tuple[float, float]],
) -> dict:
    device.seq += 1

    lat, lon = compute_route_position(args, device, route_coords)
    gps_fix = True
    speed = round(clamp(args.speed_kph, 0.0, 140.0), 2)

    temp = args.temp_base + random.uniform(-args.temp_noise, args.temp_noise)
    if should_spike(cycle_no, args.temp_spike_every):
        temp = random.uniform(38.0, 45.0)

    humidity = args.humidity_base + random.uniform(-args.humidity_noise, args.humidity_noise)
    humidity = clamp(humidity, 30.0, 95.0)

    pressure = args.pressure_base + random.uniform(-args.pressure_noise, args.pressure_noise)

    gas = args.gas_base + random.uniform(-args.gas_noise, args.gas_noise)
    if should_spike(cycle_no, args.gas_spike_every):
        gas = random.uniform(1700.0, 2600.0)
    gas = clamp(gas, 0.0, 4095.0)

    shock = should_spike(cycle_no, args.shock_every)
    tilt = args.tilt_base + random.uniform(-args.tilt_noise, args.tilt_noise)

    payload = {
        "tenantId": args.tenant_id,
        "fleetId": args.fleet_id,
        "truckId": device.truck_id,
        "containerId": device.container_id,
        "gatewayMac": "EC:E3:34:23:43:24",
        "sensorNodeMac": "AC:A7:04:27:BD:00",
        "seq": device.seq,
        "ts": int(time.time()),
        "gps": {
            "lat": lat,
            "lon": lon,
            "speedKph": speed,
        },
        "env": {
            "temperatureC": round(temp, 2),
            "humidityPct": round(humidity, 2),
            "pressureHpa": round(pressure, 2),
        },
        "motion": {
            "tiltDeg": round(tilt, 2),
            "shock": shock,
        },
        "gas": {
            "mq2Raw": int(gas),
            "alert": gas > 1500,
        },
        "status": {
            "sdOk": True,
            "gpsFix": gps_fix,
            "uplink": "simulator",
        },
    }
    return payload


def format_reason_code(reason_code) -> str:
    if reason_code is None:
        return "unknown"
    return str(reason_code)


def is_success_reason_code(reason_code) -> bool:
    # Supports paho v1 int rc and paho v2 ReasonCode objects.
    if reason_code == 0:
        return True
    text = str(reason_code).strip().lower()
    return text in {"0", "success"}


def create_client(mqtt, args: argparse.Namespace, connected_event: threading.Event):
    client_id = args.client_id or f"sim-{uuid.uuid4().hex[:10]}"

    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id, protocol=mqtt.MQTTv311)
    except AttributeError:
        client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)

    if args.username:
        client.username_pw_set(username=args.username, password=args.password)

    # Use TLS for EMQX Serverless (typically port 8883).
    if args.broker_port == 8883:
        cert_reqs = ssl.CERT_REQUIRED if args.reject_unauthorized else ssl.CERT_NONE
        client.tls_set(
            ca_certs=args.ca_path or None,
            certfile=None,
            keyfile=None,
            cert_reqs=cert_reqs,
            tls_version=ssl.PROTOCOL_TLS_CLIENT,
        )
        if not args.reject_unauthorized:
            client.tls_insecure_set(True)

    def on_connect(_client, _userdata, _flags, reason_code, _properties=None):
        rc_text = format_reason_code(reason_code)
        if is_success_reason_code(reason_code):
            print(f"[MQTT] Connected clientId={client_id} host={args.broker_host}:{args.broker_port}")
            connected_event.set()
        else:
            print(f"[MQTT] Connect failed rc={rc_text}", file=sys.stderr)

    def on_disconnect(_client, _userdata, _flags, reason_code, _properties=None):
        print(f"[MQTT] Disconnected rc={format_reason_code(reason_code)}")

    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    return client


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    env_file_values = load_env_file(project_root / ".env")

    # Process env vars override file values.
    defaults = {**env_file_values, **os.environ}
    parser = make_parser(defaults)
    args = parser.parse_args()

    if not args.broker_host:
        print("Missing broker host. Set MQTT_BROKER_HOST in .env or pass --broker-host.", file=sys.stderr)
        return 2

    if args.fleet_size < 1:
        print("--fleet-size must be >= 1", file=sys.stderr)
        return 2

    mqtt = import_mqtt_client_module()

    pairs = make_device_ids(args)
    devices = [
        DeviceState(
            truck_id=truck,
            container_id=container,
            seq=random.randint(1, 5000),
            route_step=0,
        )
        for truck, container in pairs
    ]

    stop_event = threading.Event()
    connected_event = threading.Event()

    def stop_handler(_signum, _frame):
        stop_event.set()

    signal.signal(signal.SIGINT, stop_handler)
    signal.signal(signal.SIGTERM, stop_handler)

    client = create_client(mqtt, args, connected_event)
    client.connect(args.broker_host, args.broker_port, keepalive=60)
    client.loop_start()

    if not connected_event.wait(timeout=20):
        print("[MQTT] Timed out waiting for connection.", file=sys.stderr)
        client.loop_stop()
        client.disconnect()
        return 1

    print(
        f"[SIM] Started: devices={len(devices)} interval={args.interval}s qos={args.qos} "
        f"tenant={args.tenant_id} fleet={args.fleet_id} "
        f"start=({args.start_lat},{args.start_lon}) end=({args.end_lat},{args.end_lon})"
    )

    real_route = fetch_real_route(args.start_lat, args.start_lon, args.end_lat, args.end_lon)

    cycle_no = 0
    try:
        while not stop_event.is_set():
            cycle_no += 1

            for device in devices:
                payload = build_payload(args, device, cycle_no, real_route)
                topic = make_topic(args.tenant_id, device.truck_id, device.container_id)
                payload_json = json.dumps(payload, separators=(",", ":"))

                info = client.publish(topic, payload_json, qos=args.qos)
                if info.rc != mqtt.MQTT_ERR_SUCCESS:
                    print(
                        f"[PUB] failed rc={info.rc} topic={topic} seq={payload['seq']}",
                        file=sys.stderr,
                    )
                else:
                    print(
                        f"[PUB] topic={topic} seq={payload['seq']} "
                        f"lat={payload['gps']['lat']} lon={payload['gps']['lon']} "
                        f"temp={payload['env']['temperatureC']} gas={payload['gas']['mq2Raw']} "
                        f"shock={int(payload['motion']['shock'])} gpsFix={int(payload['status']['gpsFix'])}"
                    )
                    if args.print_payload:
                        print(payload_json)

            if args.count > 0 and cycle_no >= args.count:
                break

            if args.interval > 0:
                stop_event.wait(args.interval)
    finally:
        client.loop_stop()
        client.disconnect()
        print("[SIM] Stopped")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
