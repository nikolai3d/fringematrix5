# Vercel Build Debugging Guide

This document helps debug build-info.json generation issues in Vercel deployments.

## Expected Behavior

In Vercel deployments, build-info.json should contain:
- `commitHash`: Actual Git commit SHA (40 characters)
- `committedAt`: Actual commit timestamp
- `repoUrl`: Repository URL
- `builtAt`: Build timestamp

## Debugging Steps

### 1. Check Vercel Build Logs

In your Vercel deployment, look for build-info generation logs:

```
🔧 Generating build-info.json:
   Environment: CI/Deployment
   VERCEL: 1
   VERCEL_ENV: preview (or production)
   VERCEL_GIT_COMMIT_SHA: abc123... (should be actual SHA)
   CI: not set (Vercel doesn't set this)
   Repo URL: https://github.com/owner/repo
   Commit Hash: abc123... (should match VERCEL_GIT_COMMIT_SHA)
   Built At: 2025-08-18T...
   Committed At: 2025-08-18T... (should be actual timestamp)
✅ build-info.json written to /vercel/path0/build-info.json
```

### 2. Common Issues

**Issue**: Still shows "dev-local" in Vercel
- **Cause**: Build script not running or failing
- **Check**: Look for "Generating build-info.json" in build logs
- **Fix**: Ensure `vercel.json` has correct build command

**Issue**: VERCEL_GIT_COMMIT_SHA is "not set"
- **Cause**: Vercel not providing Git environment variables
- **Check**: Repository is properly connected to Vercel
- **Fix**: Reconnect repository in Vercel dashboard

**Issue**: Build script runs but still shows dev-local
- **Cause**: Git commands failing in Vercel environment
- **Check**: Look for Git errors in logs
- **Fix**: Environment variables should be used instead

### 3. Environment Variables Vercel Should Provide

Vercel automatically sets these during builds:
- `VERCEL=1`
- `VERCEL_ENV` (preview/production/development)
- `VERCEL_GIT_COMMIT_SHA` (commit hash)
- `VERCEL_GIT_REPO_OWNER` (GitHub username/org)
- `VERCEL_GIT_REPO_SLUG` (repository name)

### 4. Manual Debug

If build info is still wrong, you can test the build script locally with Vercel environment:

```bash
# Simulate Vercel environment
VERCEL=1 VERCEL_ENV=preview VERCEL_GIT_COMMIT_SHA=abc123 node scripts/generate-build-info.js
```

### 5. Vercel Build Command

Check `vercel.json` has the correct build command:

```json
{
  "buildCommand": "npm ci && npm run build"
}
```

This ensures:
1. `npm ci` installs dependencies  
2. `npm run build` runs our build script which includes:
   - `npm run generate:build-info` (creates build-info.json)
   - `npm run build:client` (builds React app)

### 6. If All Else Fails

**Temporary workaround**: Force environment detection by setting environment variables in Vercel dashboard:
- Add `CI=1` to Vercel environment variables
- This will ensure deployment environment detection works

**Check deployment**: Look at the deployed site's build info popup to see current values.

## Expected Output

### Local Development
```json
{
  "repoUrl": "git@github.com:owner/repo.git",
  "commitHash": "dev-local", 
  "builtAt": "2025-08-18T...",
  "committedAt": "N/A"
}
```

### Vercel Deployment  
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "commitHash": "a1b2c3d4e5f6...", 
  "builtAt": "2025-08-18T...",
  "committedAt": "2025-08-17T..."
}
```

## Still Having Issues?

1. Check Vercel function logs for build-info generation
2. Verify Git integration in Vercel dashboard
3. Check that repository has proper Git history
4. Ensure build command runs successfully
