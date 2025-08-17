#!/bin/bash
set -euo pipefail

# Script to update nginx configuration for multi-branch deployment
# This script needs to be run with sudo on the server

NGINX_CONFIG="/etc/nginx/sites-available/fringematrix"

echo "Backing up current nginx config..."
cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup"

echo "Creating new nginx configuration..."
cat > "$NGINX_CONFIG" << 'EOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name fringematrix.art www.fringematrix.art;
    return 301 https://$host$request_uri;
}

# Main HTTPS server with branch routing
server {
    server_name fringematrix.art www.fringematrix.art; # managed by Certbot

    # Main production site (version: main)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Branch deployments - dynamic routing
    # This handles URLs like /test-branch/, /pr-123/, etc.
    location ~ ^/([a-zA-Z0-9][a-zA-Z0-9_-]+)(/.*)?$ {
        set $branch $1;
        set $path $2;
        
        # Calculate port based on branch name hash (same logic as deploy script)
        # For now, we'll use a map for known branches and fallback to 3001
        set $backend_port 3001;
        
        # Known branch mappings (add more as needed)
        if ($branch = "test-branch") {
            set $backend_port 3033;
        }
        
        # Try to proxy to the calculated port
        proxy_pass http://127.0.0.1:$backend_port$path;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Add custom header to identify which branch is being served
        proxy_set_header X-Branch-Name $branch;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/fringematrix.art/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/fringematrix.art/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

# Fallback HTTP server (managed by Certbot)
server {
    if ($host = www.fringematrix.art) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = fringematrix.art) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name fringematrix.art www.fringematrix.art;
    return 404; # managed by Certbot
}
EOF

echo "Testing nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "Configuration is valid. Reloading nginx..."
    systemctl reload nginx
    echo "Nginx configuration updated successfully!"
else
    echo "Configuration test failed. Restoring backup..."
    cp "${NGINX_CONFIG}.backup" "$NGINX_CONFIG"
    exit 1
fi