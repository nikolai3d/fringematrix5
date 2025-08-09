#!/usr/bin/env bash
set -euo pipefail

# Configurable
APP_NAME="fringematrix"
APP_DIR="/var/www/fringematrix"
SITE_NAME="fringematrix"
SERVER_NAME="_" # change to yourdomain.com after DNS is ready

echo "[+] System update"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y

echo "[+] Create deploy user if missing"
if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
  mkdir -p /home/deploy/.ssh
  if [ -f /root/.ssh/authorized_keys ]; then
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/
  fi
  chown -R deploy:deploy /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  chmod 600 /home/deploy/.ssh/authorized_keys || true
fi

echo "[+] Firewall (UFW)"
apt-get install -y ufw
ufw allow OpenSSH || true
ufw allow 80 || true
ufw allow 443 || true
yes | ufw enable || true

echo "[+] Install Node.js 20 and PM2"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "[+] Install Nginx"
apt-get install -y nginx
systemctl enable nginx

echo "[+] Create app directory"
mkdir -p "$APP_DIR/app"
chown -R deploy:deploy "$APP_DIR"

echo "[+] Configure Nginx site"
cat >/etc/nginx/sites-available/$SITE_NAME <<NGINX
server {
    listen 80;
    server_name $SERVER_NAME;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/$SITE_NAME /etc/nginx/sites-enabled/$SITE_NAME
nginx -t && systemctl reload nginx

echo "[+] Enable PM2 startup"
sudo -u deploy pm2 startup systemd -u deploy --hp /home/deploy >/dev/null

echo "[✓] Setup complete. Deploy from your workstation with deploy/deploy.ps1."
echo "    Once DNS points to this server, enable TLS: apt -y install certbot python3-certbot-nginx && certbot --nginx -d yourdomain.com"


