#!/usr/bin/env bash
#
# Starts the MiniLedger API and the Expo app side by side.
#
#   ./scripts/dev.sh
#
# Ctrl-C stops both.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
MOBILE_DIR="$ROOT_DIR/mobile"

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  echo "==> backend/.env is missing — creating it from .env.example"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "    Review it before continuing (JWT_SECRET, DATABASE_URL)."
fi

pids=()

cleanup() {
  echo ""
  echo "==> Shutting down…"
  for pid in "${pids[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting the API on http://localhost:3000"
(cd "$BACKEND_DIR" && npm run dev) &
pids+=($!)

# Give the API a moment to boot before the app starts hitting it.
sleep 3

echo "==> Starting the Expo app"
(cd "$MOBILE_DIR" && npm start) &
pids+=($!)

wait
