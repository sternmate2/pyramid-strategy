#!/usr/bin/env bash
set -euo pipefail
# Deployment script for Stock Anomaly System
# Generated: 2025-08-30 19:11:49

if command -v docker &>/dev/null && docker compose version &>/dev/null; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

REGISTRY="${REGISTRY:-}"

$COMPOSE build

if [[ -n "$REGISTRY" ]]; then
  echo "Pushing images to $REGISTRY (best effort)"
  python3 - <<'PY'
import yaml, subprocess, sys
with open('docker-compose.yml') as f:
    compose = yaml.safe_load(f)
for name, svc in compose.get('services', {}).items():
    image = svc.get('image')
    if not image: 
        continue
    try:
        subprocess.check_call(['docker','push',image])
    except subprocess.CalledProcessError:
        print(f"Warning: failed to push {{image}}", file=sys.stderr)
PY
fi

$COMPOSE up -d
echo "Deploy finished."
