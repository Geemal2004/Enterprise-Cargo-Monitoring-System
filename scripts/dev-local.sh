#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting backend and frontend in local dev mode..."
npm --prefix backend run dev &
BACKEND_PID=$!
npm --prefix frontend run dev &
FRONTEND_PID=$!

cleanup() {
  echo "Stopping local dev processes..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT
wait
