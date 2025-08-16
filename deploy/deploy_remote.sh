#!/usr/bin/env bash
set -euo pipefail

# Usage: deploy_remote.sh <REMOTE_DIR> <ARCHIVE_NAME> <APP_NAME>
# Example: deploy_remote.sh /var/www/fringematrix release-20250101010101.tar.gz fringematrix

REMOTE_DIR="${1:-/var/www/fringematrix}"
ARCHIVE_NAME="${2:?Missing archive name}"
APP_NAME="${3:-fringematrix}"

# Determine port based on app name/version
if [[ "$APP_NAME" == "fringematrix" ]]; then
    PORT=3000  # Main production port
else
    # For branch deployments, calculate port from branch name hash
    BRANCH_HASH=$(echo "$APP_NAME" | sha256sum | cut -c1-8)
    PORT=$((3001 + (0x$BRANCH_HASH % 100)))  # Ports 3001-3100
fi

echo "[remote] Deploying to ${REMOTE_DIR}/app"
mkdir -p "${REMOTE_DIR}/app"
cd "${REMOTE_DIR}/app"

echo "[remote] Extracting ${REMOTE_DIR}/${ARCHIVE_NAME}"
tar -xzf "${REMOTE_DIR}/${ARCHIVE_NAME}"

echo "[remote] Cleaning up archive"
rm -f "${REMOTE_DIR}/${ARCHIVE_NAME}"

echo "[remote] Installing production dependencies for backend"
cd server
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
cd ..

echo "[remote] Reloading with pm2 on port $PORT"
if pm2 list | grep -q "${APP_NAME}"; then
  pm2 reload "${APP_NAME}"
else
  PORT=$PORT pm2 start server/server.js --name "${APP_NAME}"
  pm2 save
fi

echo "[remote] Deployment complete"


