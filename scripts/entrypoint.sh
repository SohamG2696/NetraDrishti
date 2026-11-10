#!/bin/sh
set -eu

# Self-contained container: required model artifacts are bundled under /app/models.
# Start production Uvicorn server with 1 worker (shared models in memory)
exec uvicorn backend.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --workers 1 \
  --proxy-headers \
  --forwarded-allow-ips="*" \
  --timeout-graceful-shutdown 30

