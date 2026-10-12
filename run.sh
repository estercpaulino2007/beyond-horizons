#!/usr/bin/env bash
# Beyond Horizons -- one-command local start.
#
# Usage:
#   ./run.sh
#
# What it does, in order (each step is skipped if already done, so
# re-running this after the first time is fast):
#   1. Creates backend/.venv and installs backend/requirements-dev.txt, if missing.
#   2. Confirms the Ares-180 seed data exists under data/synthetic/ (it is
#      committed to the repo already; regenerated only if somehow absent).
#   3. Starts the backend (uvicorn) in the background.
#   4. Installs frontend dependencies (npm ci), if missing.
#   5. Starts the frontend (next dev) in the foreground.
#   6. On Ctrl+C (or any exit), stops the backend too.
#
# Requires Python 3.12 and Node 22+ already installed. Does not require
# Docker. See docs/reproducibility.md for the Docker Compose alternative
# (not verified in this project's own build environment -- see that file).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

BACKEND_DIR="$REPO_ROOT/backend"
FRONTEND_DIR="$REPO_ROOT/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# Pick a Python 3.12 interpreter (name varies by OS/install).
PYTHON_BIN=""
for candidate in python3.12 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    if "$candidate" -c 'import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)' 2>/dev/null; then
      PYTHON_BIN="$candidate"
      break
    fi
  fi
done
if [ -z "$PYTHON_BIN" ]; then
  echo "Python 3.12 not found. Install it (e.g. https://www.python.org/downloads/) and try again." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 22+ (e.g. https://nodejs.org/) and try again." >&2
  exit 1
fi

echo "==> Backend: Python interpreter: $($PYTHON_BIN --version)"

if [ ! -d "$VENV_DIR" ]; then
  echo "==> Backend: creating virtual environment (first run only)..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

echo "==> Backend: installing/checking dependencies..."
"$VENV_DIR/bin/pip" install -q -r "$BACKEND_DIR/requirements-dev.txt"

if [ ! -f "$REPO_ROOT/data/synthetic/mission_ares180.json" ]; then
  echo "==> Seed data missing; generating it (should not normally happen -- it is committed to the repo)..."
  (cd "$REPO_ROOT" && "$VENV_DIR/bin/python" scripts/seed_ares180.py)
fi

echo "==> Backend: starting on http://localhost:$BACKEND_PORT (logs: /tmp/beyond-horizons-backend.log)"
cd "$BACKEND_DIR"
"$VENV_DIR/bin/uvicorn" app.main:app --port "$BACKEND_PORT" >/tmp/beyond-horizons-backend.log 2>&1 &
BACKEND_PID=$!
cd "$REPO_ROOT"

for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:$BACKEND_PORT/health"; then
    break
  fi
  sleep 0.5
done
if ! curl -s -o /dev/null "http://localhost:$BACKEND_PORT/health"; then
  echo "Backend did not become healthy in time. Check /tmp/beyond-horizons-backend.log" >&2
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 1
fi

cleanup() {
  if [ -n "${CLEANED_UP:-}" ]; then
    return
  fi
  CLEANED_UP=1
  echo ""
  echo "==> Stopping backend..."
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Backend is up: http://localhost:$BACKEND_PORT/docs"

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "==> Frontend: installing dependencies (first run only, this can take a minute)..."
  (cd "$FRONTEND_DIR" && npm ci)
fi

echo "==> Frontend: starting on http://localhost:$FRONTEND_PORT"
echo ""
echo "    Frontend:  http://localhost:$FRONTEND_PORT"
echo "    API docs:  http://localhost:$BACKEND_PORT/docs"
echo ""
echo "    Press Ctrl+C to stop both."
echo ""

cd "$FRONTEND_DIR"
NEXT_PUBLIC_API_BASE_URL="http://localhost:$BACKEND_PORT" PORT="$FRONTEND_PORT" npm run dev
