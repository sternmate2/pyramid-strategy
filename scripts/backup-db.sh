#!/usr/bin/env bash
set -euo pipefail
# Database backup script for Stock Anomaly System
# Generated: 2025-08-30 19:11:49

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

DB_SERVICE="${DB_SERVICE:-postgres}"
PGUSER="${POSTGRES_USER:-postgres}"
PGDATABASE="${POSTGRES_DB:-stockdb}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/${PGDATABASE}-$TS.sql"

echo "Backing up database '$PGDATABASE' from service '$DB_SERVICE' to '$OUT'"
$COMPOSE exec -T "$DB_SERVICE" pg_dump -U "$PGUSER" "$PGDATABASE" > "$OUT"
echo "Backup complete: $OUT"
