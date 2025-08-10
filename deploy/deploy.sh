#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Parse named args like -HostName value -User value -RemoteDir value -AppName value
function usage() {
  cat <<USAGE
Usage: bash deploy/deploy.sh -HostName <host> -User <user> [-RemoteDir /var/www/fringematrix] [-AppName fringematrix]

Required:
  -HostName    Remote host (e.g., 137.184.115.206)
  -User        SSH user (e.g., deploy)

Optional:
  -RemoteDir   Remote base directory (default: /var/www/fringematrix)
  -AppName     pm2 app name (default: fringematrix)
USAGE
}

HOSTNAME=""
USER_NAME=""
REMOTE_DIR="/var/www/fringematrix"
APP_NAME="fringematrix"

# Ensure Linux toolchain inside WSL (avoid Windows Node/npm on PATH)
if [[ -f /proc/version ]] && grep -qi "microsoft" /proc/version 2>/dev/null; then
  export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
  # Try to enable nvm if present
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$HOME/.nvm/nvm.sh"
    nvm use --silent 20 >/dev/null 2>&1 || true
  fi
fi

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
    -AppName)
      APP_NAME=${2:-}
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

if [[ -z "$HOSTNAME" || -z "$USER_NAME" ]]; then
  echo "-HostName and -User are required." >&2
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

TMP_DIR="$(mktemp -d -t fringematrix-XXXXXXXX)"
ARCHIVE_NAME="release-$(date +%Y%m%d%H%M%S).tar.gz"
ARCHIVE_PATH="${TMPDIR:-/tmp}/$ARCHIVE_NAME"
REMOTE_SH_TMP=""

function cleanup() {
  if [[ -n "$REMOTE_SH_TMP" && -f "$REMOTE_SH_TMP" ]]; then rm -f "$REMOTE_SH_TMP" || true; fi
  if [[ -d "$TMP_DIR" ]]; then rm -rf "$TMP_DIR" || true; fi
}
trap cleanup EXIT

echo "Building client locally in a clean temp dir..."
TMP_CLIENT="$(mktemp -d -t fringematrix-client-XXXXXXXX)"
# Copy client sources excluding heavy/build artifacts
find "$REPO_ROOT/client" -maxdepth 1 -mindepth 1 \
  -not -name node_modules \
  -not -name dist \
  -exec cp -a {} "$TMP_CLIENT/" \;
(
  cd "$TMP_CLIENT"
  rm -f package-lock.json || true
  npm install --no-audit --no-fund
  npm run build
)

echo "Staging runtime files in $TMP_DIR"

# Backend (server/)
cp -a "$REPO_ROOT/server" "$TMP_DIR/server"
# Drop local node_modules from the staged backend to reduce archive size
if [[ -d "$TMP_DIR/server/node_modules" ]]; then
  rm -rf "$TMP_DIR/server/node_modules"
fi

# Data and assets
cp -a "$REPO_ROOT/data" "$TMP_DIR/data"
if [[ -d "$REPO_ROOT/avatars" ]]; then
  cp -a "$REPO_ROOT/avatars" "$TMP_DIR/avatars"
fi

# Built client assets
mkdir -p "$TMP_DIR/client"
cp -a "$TMP_CLIENT/dist" "$TMP_DIR/client/"

# Repo metadata
repoUrl="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)"
commitHash="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
deployedAt="$(TZ="America/Los_Angeles" date +"%Y-%m-%d %H:%M:%S %Z")"

cat > "$TMP_DIR/build-info.json" <<EOF
{
  "repoUrl": "$(printf '%s' "$repoUrl" | sed 's/"/\\"/g')",
  "commitHash": "$(printf '%s' "$commitHash" | sed 's/"/\\"/g')",
  "deployedAt": "$(printf '%s' "$deployedAt" | sed 's/"/\\"/g')"
}
EOF

echo "Creating archive $ARCHIVE_NAME"
( cd "$TMP_DIR" && tar -czf "$ARCHIVE_PATH" . )

echo "Uploading $ARCHIVE_NAME to ${USER_NAME}@${HOSTNAME}:${REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "${USER_NAME}@${HOSTNAME}" "mkdir -p '${REMOTE_DIR}/app'"
scp "${SSH_OPTS[@]}" "$ARCHIVE_PATH" "${USER_NAME}@${HOSTNAME}:${REMOTE_DIR}/"

echo "Uploading remote deploy script..."
REMOTE_SH_LOCAL="$SCRIPT_DIR/deploy_remote.sh"
if [[ ! -f "$REMOTE_SH_LOCAL" ]]; then
  echo "deploy_remote.sh not found at $REMOTE_SH_LOCAL" >&2
  exit 1
fi
REMOTE_SH_TMP="$(mktemp -t deploy_remote.XXXXXXXX.sh)"
tr -d '\r' < "$REMOTE_SH_LOCAL" > "$REMOTE_SH_TMP"
scp "${SSH_OPTS[@]}" "$REMOTE_SH_TMP" "${USER_NAME}@${HOSTNAME}:${REMOTE_DIR}/deploy_remote.sh"
ssh "${SSH_OPTS[@]}" "${USER_NAME}@${HOSTNAME}" "chmod +x '${REMOTE_DIR}/deploy_remote.sh'"

echo "Deploying remotely..."
ssh "${SSH_OPTS[@]}" "${USER_NAME}@${HOSTNAME}" "'${REMOTE_DIR}/deploy_remote.sh' '$REMOTE_DIR' '$ARCHIVE_NAME' '$APP_NAME'"

echo "Done. App should be running on port 3000 behind Nginx if configured."


