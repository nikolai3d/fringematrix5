# Vercel Deployment Guide

## Migration from Manual DigitalOcean Deployment

This project has been migrated from a manual DigitalOcean deployment to Vercel for automatic branch/PR deployments.

## What Changed

### ✅ What You Gain
- **Automatic PR Previews**: Every PR gets its own URL (e.g., `fringematrix-git-feature-yourname.vercel.app`)
- **Zero Server Management**: No more PM2, NGINX, or port conflicts
- **Instant Deployments**: Deploy in seconds, not minutes
- **Automatic SSL**: HTTPS everywhere by default
- **CDN Optimization**: Your avatar images are automatically optimized
- **Easy Rollbacks**: One-click rollback to any previous deployment

### 🗑️ What's Removed
- Manual deployment scripts (`deploy/` folder)
- Port management complexity
- NGINX configuration hassles
- SSH server setup
- PM2 process management

## Setup Instructions

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login and Link Project
```bash
cd /path/to/fringematrix
vercel login
vercel --confirm
```

### 3. Test Local Development
```bash
# Install dependencies (unified npm structure)
npm ci

# Test the full application locally
npm run dev

# Or test with Vercel CLI for serverless function testing
vercel dev
```

### 4. Deploy
```bash
# Deploy to production
vercel --prod

# Or just push to GitHub - Vercel will auto-deploy!
git push origin main
```

## Environment Setup

Vercel automatically handles:
- Node.js 20 runtime
- Build process for React frontend
- Serverless function for Express backend
- Static file serving for avatars

## URLs After Deployment

- **Production**: `https://your-project.vercel.app`
- **PR Previews**: `https://fringematrix-git-branch-name-username.vercel.app`
- **Branch Deployments**: Automatic for every push

## GitHub Integration

Once connected to GitHub:
- Every PR automatically gets a preview deployment
- Main branch deploys to production
- Comments are added to PRs with deployment URLs
- No manual intervention needed

## Build Process

Vercel automatically:
1. Installs dependencies: `npm ci` (unified package.json)
2. Generates build info: `npm run generate:build-info`
3. Builds React app: `npm run build:client`
4. Deploys serverless function: `api/index.js`

## URL Management

### Default URLs
Vercel automatically generates URLs with random characters:
- `https://fringematrix5-abc123def-yourname.vercel.app`

### Creating Clean Aliases

For cleaner URLs, create an alias:

```bash
# Set an alias to a clean vercel.app subdomain
vercel alias set fringematrix5-abc123def-yourname.vercel.app fringematrix.vercel.app

# Result: https://fringematrix.vercel.app
```

**Benefits of Aliases:**
- ✅ Clean, memorable URLs
- ✅ Automatically updates with new deployments
- ✅ Works for both production and preview deployments
- ✅ Free on all Vercel plans

### Current Project URLs

After setup:
- **Production**: `https://fringematrix.vercel.app`
- **PR Previews**: `https://fringematrix-git-branch-name.vercel.app`

### Managing Aliases

```bash
# List all aliases
vercel alias list

# Remove an alias
vercel alias remove fringematrix.vercel.app

# Check alias status
curl -I https://fringematrix.vercel.app
```

## Custom Domains

To add your own domain:
1. Go to Vercel dashboard
2. Project Settings → Domains
3. Add your domain
4. Update DNS records as shown

## Rollback Strategy

If something goes wrong:
1. Go to Vercel dashboard
2. Deployments tab
3. Click "Promote to Production" on any previous deployment
4. Instant rollback complete

## Local Development

Development workflow (unified npm structure):
```bash
# Start both backend and frontend concurrently
npm run dev
```

This automatically starts:
- Backend server on `http://localhost:3000`
- Frontend dev server (proxied through backend)

The proxy configuration in `client/vite.config.js` handles API routing in development.

## Troubleshooting

### Build Fails
- Check build logs in Vercel dashboard
- Ensure all dependencies are in package.json files
- Verify Node.js version compatibility

### 404 Errors
- Check `vercel.json` routing rules
- Verify static file paths
- Test locally with `vercel dev`

### Performance Issues
- Use Vercel Analytics to identify bottlenecks
- Optimize images in `/avatars` directory
- Enable caching headers for static assets

## Cost Comparison

**Before (DigitalOcean)**:
- $12/month droplet
- Manual server maintenance
- Limited scalability

**After (Vercel)**:
- Free tier: 100GB bandwidth, unlimited deployments
- Pro tier: $20/month for team features
- Automatic scaling
- Zero maintenance

## Next Steps

1. ✅ Test deployment locally with `vercel dev`
2. ✅ Deploy to Vercel: `vercel --prod`  
3. ✅ Connect GitHub repository
4. ✅ Test PR preview functionality
5. ✅ Update DNS to point to Vercel (optional)
6. ✅ Clean up DigitalOcean droplet
