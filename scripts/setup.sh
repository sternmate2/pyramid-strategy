#!/usr/bin/env bash
set -euo pipefail
# Setup script for Stock Anomaly System
# Generated: 2025-08-30 19:11:49

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "Error: docker compose/docker-compose is not installed." >&2
  exit 1
fi

if [[ ! -f .env && -f .env.example ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

$COMPOSE build
$COMPOSE up -d
echo "All services are up."
