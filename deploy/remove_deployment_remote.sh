#!/usr/bin/env bash
set -euo pipefail

# Remote script to remove a branch deployment
# Usage: remove_deployment_remote.sh <DEPLOY_DIR> <APP_NAME>
# Example: remove_deployment_remote.sh /var/www/fringematrix/pr-500 fringematrix-pr-500

DEPLOY_DIR="${1:?Missing deployment directory}"
APP_NAME="${2:?Missing app name}"

echo "[remote] Removing deployment: $APP_NAME from $DEPLOY_DIR"

# Safety check: prevent removal of main deployment directory
if [[ "$DEPLOY_DIR" == "/var/www/fringematrix" ]] || [[ "$DEPLOY_DIR" =~ ^/var/www/fringematrix/?$ ]]; then
  echo "[remote] ERROR: Cannot remove main deployment directory" >&2
  exit 1
fi

# Safety check: ensure we're not removing the main app
if [[ "$APP_NAME" == "fringematrix" ]]; then
  echo "[remote] ERROR: Cannot remove main application" >&2
  exit 1
fi

# Check if pm2 process exists and stop it
echo "[remote] Checking for pm2 process: $APP_NAME"
if pm2 list | grep -q "$APP_NAME"; then
  echo "[remote] Stopping pm2 process: $APP_NAME"
  pm2 stop "$APP_NAME" || true
  pm2 delete "$APP_NAME" || true
  pm2 save
  echo "[remote] Process $APP_NAME stopped and removed"
else
  echo "[remote] No pm2 process found for $APP_NAME"
fi

# Remove deployment directory
if [[ -d "$DEPLOY_DIR" ]]; then
  echo "[remote] Removing deployment directory: $DEPLOY_DIR"
  rm -rf "$DEPLOY_DIR"
  echo "[remote] Directory removed successfully"
else
  echo "[remote] Directory $DEPLOY_DIR does not exist"
fi

# Verify removal
if [[ -d "$DEPLOY_DIR" ]]; then
  echo "[remote] ERROR: Failed to remove directory $DEPLOY_DIR" >&2
  exit 1
fi

if pm2 list | grep -q "$APP_NAME"; then
  echo "[remote] ERROR: Failed to remove pm2 process $APP_NAME" >&2
  exit 1
fi

echo "[remote] Deployment removal complete"