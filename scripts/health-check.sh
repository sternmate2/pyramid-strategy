#!/usr/bin/env bash
set -euo pipefail
# Health check script for Stock Anomaly System
# Generated: 2025-08-30 19:11:49

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

$COMPOSE ps

API_URL="${API_URL:-http://localhost:8000/health}"
NGINX_URL="${NGINX_URL:-http://localhost/health}"

echo "Checking API: $API_URL"
if curl -fsS "$API_URL" >/dev/null; then
  echo "API OK"
else
  echo "API health failed (non-fatal)"
fi

echo "Checking NGINX: $NGINX_URL"
if curl -fsS "$NGINX_URL" >/dev/null; then
  echo "NGINX OK"
else
  echo "NGINX health failed (non-fatal)"
fi

DB_SERVICE="${DB_SERVICE:-postgres}"
if $COMPOSE ps --status running | grep -q "\b$DB_SERVICE\b"; then
  echo "DB service '$DB_SERVICE' appears running."
else
  echo "DB service '$DB_SERVICE' not running."
fi
