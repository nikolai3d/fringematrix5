#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Remove a branch deployment from the server
function usage() {
  cat <<USAGE
Usage: bash deploy/remove_deployment.sh -HostName <host> -User <user> -Version <version> [-RemoteDir /var/www/fringematrix]

Required:
  -HostName    Remote host (e.g., 137.184.115.206)
  -User        SSH user (e.g., deploy)
  -Version     Branch/version name to remove (cannot be 'main')

Optional:
  -RemoteDir   Remote base directory (default: /var/www/fringematrix)

Examples:
  bash deploy/remove_deployment.sh -HostName 137.184.115.206 -User deploy -Version pr-500
  bash deploy/remove_deployment.sh -HostName my-server -User deploy -Version feature-branch
USAGE
}

HOSTNAME=""
USER_NAME=""
REMOTE_DIR="/var/www/fringematrix"
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -HostName)
      HOSTNAME=${2:-}
      shift 2
      ;;
    -User)
      USER_NAME=${2:-}
      shift 2
      ;;
    -RemoteDir)
      REMOTE_DIR=${2:-}
      shift 2
      ;;
    -Version)
      VERSION=${2:-}
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# Validation
if [[ -z "$HOSTNAME" || -z "$USER_NAME" || -z "$VERSION" ]]; then
  echo "ERROR: -HostName, -User, and -Version are required." >&2
  usage
  exit 1
fi

# Safety check: prevent removal of main deployment
if [[ "$VERSION" == "main" ]]; then
  echo "ERROR: Cannot remove the main deployment. Only branch deployments can be removed." >&2
  exit 1
fi

# Safety check: version name validation
if [[ ! "$VERSION" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]]; then
  echo "ERROR: Version name '$VERSION' contains invalid characters. Use only alphanumeric, dash, and underscore." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

DEPLOY_DIR="$REMOTE_DIR/$VERSION"
APP_VERSION_NAME="fringematrix-${VERSION}"

echo "WARNING: This will permanently remove the deployment for version '$VERSION'"
echo "  - Stop pm2 process: $APP_VERSION_NAME"
echo "  - Delete directory: $DEPLOY_DIR"
echo ""
read -p "Are you sure you want to continue? (y/N): " -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Removal cancelled."
  exit 0
fi

echo "Uploading removal script..."
REMOTE_SH_LOCAL="$SCRIPT_DIR/remove_deployment_remote.sh"
if [[ ! -f "$REMOTE_SH_LOCAL" ]]; then
  echo "remove_deployment_remote.sh not found at $REMOTE_SH_LOCAL" >&2
  exit 1
fi

REMOTE_SH_TMP="$(mktemp -t remove_deployment_remote.XXXXXXXX.sh)"
tr -d '\r' < "$REMOTE_SH_LOCAL" > "$REMOTE_SH_TMP"

function cleanup() {
  if [[ -n "$REMOTE_SH_TMP" && -f "$REMOTE_SH_TMP" ]]; then rm -f "$REMOTE_SH_TMP" || true; fi
}
trap cleanup EXIT

scp "${SSH_OPTS[@]}" "$REMOTE_SH_TMP" "${USER_NAME}@${HOSTNAME}:/tmp/remove_deployment_remote.sh"
ssh "${SSH_OPTS[@]}" "${USER_NAME}@${HOSTNAME}" "chmod +x /tmp/remove_deployment_remote.sh"

echo "Removing deployment remotely..."
ssh "${SSH_OPTS[@]}" "${USER_NAME}@${HOSTNAME}" "/tmp/remove_deployment_remote.sh '$DEPLOY_DIR' '$APP_VERSION_NAME'"

echo "Cleaning up remote script..."
ssh "${SSH_OPTS[@]}" "${USER_NAME}@${HOSTNAME}" "rm -f /tmp/remove_deployment_remote.sh"

echo "Done. Deployment '$VERSION' has been removed."