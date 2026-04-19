#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SCHEMA_SOURCE="$ROOT_DIR/database/schema.sql"
SEED_SOURCE="$ROOT_DIR/database/seed.sql"
SCHEMA_TARGET="$ROOT_DIR/backend/migrations/001_initial_schema.sql"
SEED_TARGET="$ROOT_DIR/backend/seeds/001_demo_seed.sql"

if [[ ! -f "$SCHEMA_SOURCE" ]]; then
  echo "Missing source schema file: $SCHEMA_SOURCE" >&2
  exit 1
fi

if [[ ! -f "$SEED_SOURCE" ]]; then
  echo "Missing source seed file: $SEED_SOURCE" >&2
  exit 1
fi

cp "$SCHEMA_SOURCE" "$SCHEMA_TARGET"
cp "$SEED_SOURCE" "$SEED_TARGET"

if ! cmp -s "$SCHEMA_SOURCE" "$SCHEMA_TARGET"; then
  echo "Schema sync verification failed." >&2
  exit 1
fi

if ! cmp -s "$SEED_SOURCE" "$SEED_TARGET"; then
  echo "Seed sync verification failed." >&2
  exit 1
fi

echo "SQL mirrors synchronized successfully."
echo "schema.sql -> backend/migrations/001_initial_schema.sql"
echo "seed.sql   -> backend/seeds/001_demo_seed.sql"
