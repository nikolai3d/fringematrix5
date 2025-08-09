## Deploying to a DigitalOcean Droplet

This folder contains everything you need to deploy the app to a regular Ubuntu Droplet without using GitHub deploys. You will upload only the runtime bits (backend in `server/`, built client, data, and images) from your local machine over SSH.

### What you get here
- `deploy.ps1`: PowerShell script you run on your Windows PC to build locally and deploy over SSH/SCP.
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
From your project root on Windows, run the PowerShell script. Replace values as needed:

```powershell
pwsh -File .\deploy\deploy.ps1 -HostName <DROPLET_IP_OR_HOSTNAME> -User deploy -RemoteDir /var/www/fringematrix -AppName fringematrix
```

What it does:
- Builds the client (`client/dist`)
- Bundles only the runtime bits: `server/` (backend), `data/`, `avatars/`, `client/dist/`
- Uploads the bundle via `scp`
- Installs production deps for the backend on the server (`npm ci --omit=dev` inside `server/`)
- Starts or reloads the app with PM2 as `fringematrix` (runs `server/server.js`)

Visit the app:
- If using IP only: `http://YOUR_DROPLET_IP`
- If using a domain and Nginx is pointed there: `http://yourdomain.com`

### Enable HTTPS (optional but recommended)
After a successful deploy and DNS pointing to your Droplet, SSH to the server and run:

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Notes
- The `avatars/` directory can be large and include binary files. This workflow uploads them directly; no GitHub restrictions apply.
- If `avatars/` doesn’t exist locally, the deploy script simply skips it.
- To run the app on boot: PM2’s `startup` is set during setup. After first `pm2 start` and `pm2 save`, the process is restored on reboot.


