## Deploying to a DigitalOcean Droplet

This folder contains everything you need to deploy the app to a regular Ubuntu Droplet without using GitHub deploys. You will upload only the runtime bits (backend in `server/`, built client, data, and images) from your local machine over SSH.

### What you get here
- `deploy.sh`: Bash script to build locally and deploy over SSH/SCP (supports branch deployments).
- `deploy.ps1`: PowerShell script you run on your Windows PC to build locally and deploy over SSH/SCP.
- `remove_deployment.sh`: Script to remove branch deployments from the server.
- `server-setup.sh`: One-time setup script to harden and prepare a fresh Ubuntu server (user, firewall, Node, PM2, Nginx).
- `nginx.conf`: Nginx site template to reverse-proxy to the Node app.

### Prerequisites (your Windows PC)
- Node.js 18+ and npm
- PowerShell 7 (pwsh) or Windows PowerShell 5.1
- OpenSSH client available on PATH (`ssh`, `scp`). On Windows 10/11 it usually is.

### One-time: create your Droplet
1. In your DigitalOcean dashboard, create a Droplet:
   - Image: Ubuntu 22.04 LTS (or newer)
   - Plan: Basic → Regular CPU (any size works for testing)
   - Datacenter: choose closest region
   - Authentication: SSH Keys → select your public key
   - Finalize and create. Copy the public IPv4 address.

### One-time: prepare the server
1. SSH in as `root` using the Droplet IP: `ssh root@YOUR_DROPLET_IP`
2. Copy `deploy/server-setup.sh` to the server or curl it from your repo, then run it. Easiest is to paste it via a here-doc on the server or upload with `scp`.
3. Run the setup script (edit variables inside as needed):

   ```bash
   sudo bash server-setup.sh
   ```

   This will:
   - Create user `deploy` with sudo, set up SSH keys by copying from root
   - Install UFW, Node.js 20, PM2, and Nginx
   - Open firewall for SSH and HTTP(S)
   - Create `/var/www/fringematrix` app directory
   - Install an Nginx site pointing to `http://127.0.0.1:3000`

4. If you have a domain, point DNS A record to the Droplet IP. After your first deploy works, you can enable TLS with Let’s Encrypt (instructions in the setup output and notes below).

### Deploy (every time)

#### Main Production Deployment
Deploy to the main production site (accessible at `fringematrix.art/`):

```bash
# Using bash script (recommended)
bash deploy/deploy.sh -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy

# Using PowerShell (Windows)
pwsh -File .\deploy\deploy.ps1 -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy -RemoteDir /var/www/fringematrix -AppName fringematrix
```

#### Branch/PR Deployment
Deploy a branch or PR version (accessible at `fringematrix.art/pr-500/`):

```bash
# Deploy PR 500
bash deploy/deploy.sh -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy -Version pr-500

# Deploy a feature branch
bash deploy/deploy.sh -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy -Version feature-auth

# Custom settings
bash deploy/deploy.sh -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy -Version pr-500 -RemoteDir /var/www/fringematrix -AppName fringematrix
```

#### What the deployment does:
- Builds the client (`client/dist`)
- Bundles only the runtime bits: `server/` (backend), `data/`, `avatars/`, `client/dist/`
- Uploads the bundle via `scp`
- For branch deployments: creates version-specific directory (e.g., `/var/www/fringematrix/pr-500/`)
- Installs production deps for the backend on the server (`npm ci --omit=dev` inside `server/`)
- Starts or reloads the app with PM2:
  - Main: `fringematrix` on port 3000
  - Branch: `fringematrix-pr-500` on auto-assigned port (3001-3100)

#### Access your deployments:
- **Main production**: `http://yourdomain.com` or `http://YOUR_DROPLET_IP`
- **Branch deployment**: `http://yourdomain.com/pr-500/` (requires nginx configuration - see below)

### Remove Branch Deployments

To clean up branch deployments when they're no longer needed:

```bash
# Remove a PR deployment
bash deploy/remove_deployment.sh -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy -Version pr-500

# Remove a feature branch deployment
bash deploy/remove_deployment.sh -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy -Version feature-auth
```

**Safety features:**
- Cannot remove the main production deployment (`-Version main` is blocked)
- Prompts for confirmation before removal
- Validates version names (alphanumeric, dash, underscore only)
- Stops PM2 processes and removes deployment directories

**What it removes:**
- PM2 process (e.g., `fringematrix-pr-500`)
- Deployment directory (e.g., `/var/www/fringematrix/pr-500/`)
- All associated files and data for that deployment

### Nginx Configuration for Branch Deployments

To enable access to branch deployments via URLs like `fringematrix.art/pr-500/`, you need to update your nginx configuration. Here's the required setup:

#### Updated Nginx Configuration

Replace your existing nginx site configuration (usually in `/etc/nginx/sites-available/fringematrix`) with:

```nginx
server {
    listen 80;
    server_name fringematrix.art;
    
    # Main production site (version: main)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Branch/PR deployments
    location ~ ^/([^/]+)/(.*)$ {
        set $branch $1;
        set $path $2;
        
        # Try serving static files first
        try_files /var/www/fringematrix/$branch/app/client/dist/$path @branch_proxy;
    }
    
    location @branch_proxy {
        # Extract branch name from URL
        if ($uri ~ ^/([^/]+)/(.*)$) {
            set $branch $1;
            set $remaining_path /$2;
        }
        
        # Calculate port based on branch name hash (same logic as deploy script)
        # You'll need a lua script or map for dynamic port calculation
        # For now, manually map known branches:
        set $backend_port 3001;  # Default fallback port
        
        proxy_pass http://localhost:$backend_port$remaining_path;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Dynamic Port Assignment

Since nginx doesn't easily support dynamic port calculation, you have a few options:

1. **Manual mapping** (simplest): Add specific location blocks for known branches:
   ```nginx
   location /pr-500/ {
       proxy_pass http://localhost:3042/;  # Calculate port manually
   }
   ```

2. **Use nginx lua module** for dynamic port calculation (requires `nginx-extras`):
   ```bash
   sudo apt install nginx-extras
   ```

3. **External service discovery**: Use a simple service that maintains branch→port mappings.

#### Apply Configuration

After updating nginx configuration:

```bash
# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Enable HTTPS (optional but recommended)
After a successful deploy and DNS pointing to your Droplet, SSH to the server and run:

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Notes
- The `avatars/` directory can be large and include binary files. This workflow uploads them directly; no GitHub restrictions apply.
- If `avatars/` doesn't exist locally, the deploy script simply skips it.
- To run the app on boot: PM2's `startup` is set during setup. After first `pm2 start` and `pm2 save`, the process is restored on reboot.
- Branch deployments use auto-calculated ports (3001-3100) based on branch name hash.
- For production use, consider implementing a service discovery mechanism for dynamic nginx routing.


