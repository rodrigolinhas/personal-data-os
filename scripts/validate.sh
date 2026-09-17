#!/usr/bin/env bash
# scripts/validate.sh
#
# Runs the full validation suite locally — mirrors exactly what CI runs.
# Usage: ./scripts/validate.sh
#        ./scripts/validate.sh --backend-only
#        ./scripts/validate.sh --frontend-only

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_ONLY=false
FRONTEND_ONLY=false

for arg in "$@"; do
  case $arg in
    --backend-only)  BACKEND_ONLY=true ;;
    --frontend-only) FRONTEND_ONLY=true ;;
  esac
done

# Colour helpers
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BOLD='\033[1m'; RESET='\033[0m'

pass() { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; exit 1; }
section() { echo -e "\n${BOLD}${YELLOW}── $1 ──${RESET}"; }

# ─────────────────────────────────────────────────────────────────────────────
# BACKEND
# ─────────────────────────────────────────────────────────────────────────────
run_backend() {
  section "Backend (Go)"
  cd "$ROOT/api"

  echo "  Checking gofmt..."
  UNFORMATTED=$(gofmt -l .)
  if [ -n "$UNFORMATTED" ]; then
    echo "$UNFORMATTED"
    fail "Unformatted Go files found. Run: cd api && gofmt -w ."
  fi
  pass "gofmt"

  echo "  Running go vet..."
  go vet ./... && pass "go vet"

  echo "  Running tests (race detector)..."
  go test -race ./... && pass "go test -race ./..."

  echo "  Building binary..."
  go build -o /dev/null ./cmd/api && pass "go build"
}

# ─────────────────────────────────────────────────────────────────────────────
# FRONTEND
# ─────────────────────────────────────────────────────────────────────────────
run_frontend() {
  section "Frontend (React + TypeScript)"
  cd "$ROOT/web"

  echo "  Running TypeScript typecheck..."
  npm run typecheck && pass "typecheck"

  echo "  Running ESLint..."
  npm run lint && pass "lint"

  echo "  Checking Prettier formatting..."
  npm run format:check && pass "format:check"

  echo "  Running Vitest tests..."
  npm test -- --run && pass "vitest"

  echo "  Building production bundle..."
  npm run build && pass "build"
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${BOLD}Personal Data OS — Full Validation${RESET}"
echo "Mirrors CI pipeline (ci.yml)"

if $FRONTEND_ONLY; then
  run_frontend
elif $BACKEND_ONLY; then
  run_backend
else
  run_backend
  run_frontend
fi

echo -e "\n${GREEN}${BOLD}All checks passed! ✓${RESET}\n"
