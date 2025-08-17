# ⚠️ DEPRECATED DEPLOYMENT SYSTEM

This `deploy/` directory contains the old manual deployment system that has been **REPLACED** by Vercel.

## What This Directory Contains

- `deploy.sh` - Manual deployment script (no longer needed)
- `deploy_remote.sh` - Remote server setup (no longer needed)
- `nginx.conf` - NGINX configuration (replaced by Vercel routing)
- Various server management scripts (replaced by Vercel Functions)

## Migration Status

✅ **COMPLETED**: Migrated to Vercel
- Automatic PR previews
- Zero server management  
- Instant deployments
- Built-in CDN and SSL

## Safe to Delete

This entire `deploy/` folder can be safely deleted after confirming Vercel deployment works.

## New Deployment Process

Instead of running `bash deploy/deploy.sh`, simply:
```bash
git push origin main          # Auto-deploys to production
git push origin feature-branch  # Auto-deploys to preview URL
```

See `VERCEL_DEPLOYMENT.md` for complete migration guide.
