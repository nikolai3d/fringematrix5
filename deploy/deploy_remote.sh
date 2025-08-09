#!/usr/bin/env bash
set -euo pipefail

# Usage: deploy_remote.sh <REMOTE_DIR> <ARCHIVE_NAME> <APP_NAME>
# Example: deploy_remote.sh /var/www/fringematrix release-20250101010101.tar.gz fringematrix

REMOTE_DIR="${1:-/var/www/fringematrix}"
ARCHIVE_NAME="${2:?Missing archive name}"
APP_NAME="${3:-fringematrix}"

echo "[remote] Deploying to ${REMOTE_DIR}/app"
mkdir -p "${REMOTE_DIR}/app"
cd "${REMOTE_DIR}/app"

echo "[remote] Extracting ${REMOTE_DIR}/${ARCHIVE_NAME}"
tar -xzf "${REMOTE_DIR}/${ARCHIVE_NAME}"

echo "[remote] Cleaning up archive"
rm -f "${REMOTE_DIR}/${ARCHIVE_NAME}"

echo "[remote] Installing production dependencies"
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

echo "[remote] Reloading with pm2"
if pm2 list | grep -q "${APP_NAME}"; then
  pm2 reload "${APP_NAME}"
else
  pm2 start server.js --name "${APP_NAME}"
  pm2 save
fi

echo "[remote] Deployment complete"


