# E2E Testing Guide

This document explains the end-to-end testing setup for Fringe Matrix, including important considerations for Vercel Blob API rate limiting.

## Overview

The e2e tests use Playwright to test the full application stack, including:
- React frontend 
- Express backend
- Vercel Blob CDN integration for avatar images

## ⚠️ Rate Limiting Considerations

**Important**: The application uses Vercel Blob API to serve avatar images from a CDN. During testing, multiple concurrent requests can trigger rate limiting:

```
BlobServiceRateLimited [Error]: Vercel Blob: Too many requests please lower the number of concurrent requests - try again in 58 seconds.
```

### Rate Limit Protections

We've implemented several protections to handle this:

1. **Sequential execution**: `fullyParallel: false` 
2. **Limited workers**: `workers: 2` (configurable)
3. **Server-side caching**: 30-second cache for blob listings
4. **Retry logic**: Automatic retry with exponential backoff
5. **Increased timeouts**: 90s for tests, 60s for actions

## Configuration

### Current Settings (`playwright.config.ts`)

```typescript
export default defineConfig({
  workers: process.env.CI ? 1 : 2, // Auto-adjust: 1 in CI, 2 locally
  fullyParallel: false, // Prevent too many concurrent requests
  timeout: process.env.CI ? 120_000 : 90_000, // 2min in CI, 90s locally
  use: {
    actionTimeout: process.env.CI ? 90_000 : 60_000, // 90s in CI, 60s locally
    navigationTimeout: process.env.CI ? 90_000 : 60_000, // 90s in CI, 60s locally
  }
});
```

**🤖 Automatic CI Detection**: The configuration automatically uses conservative settings when `process.env.CI` is detected.

**Supported CI Environments:**
- GitHub Actions (sets `CI=true`)
- Vercel Build (sets `CI=1`) 
- GitLab CI (sets `CI=true`)
- CircleCI (sets `CI=true`)
- Travis CI (sets `CI=true`)
- Most other CI platforms

### Adjusting Workers

**Increase workers** (faster but higher rate limit risk):
```typescript
workers: 4, // or higher
```

**Decrease workers** (slower but safer):
```typescript
workers: 1, // Most conservative
```

### Server-Side Cache Tuning

Edit `server/server.js` to adjust cache behavior:

```javascript
const CACHE_TTL = 30000; // Cache time in milliseconds

// Increase for longer cache (fewer API calls)
const CACHE_TTL = 60000; // 60 seconds

// Decrease for fresher data (more API calls)
const CACHE_TTL = 15000; // 15 seconds
```

## Test Commands

### Standard Commands

```bash
# Run all e2e tests (2 workers)
npm run e2e

# Run with browser visible
npm run e2e:headed

# View test report
npm run e2e:report
```

### Conservative Mode

If you're hitting rate limits frequently:

```bash
# Use extra conservative settings (1 worker, longer timeouts)
npm run e2e:conservative
```

### Advanced Usage

```bash
# Run specific test file
npx playwright test app.spec.ts

# Run specific test by name
npx playwright test -g "Build Info"

# Run with custom worker count
npx playwright test --workers=1

# Debug mode
npx playwright test --debug
```

## Troubleshooting

### Missing Blob Token (CI)

**Symptoms:**
- Error: `No token found. Either configure the BLOB_READ_WRITE_TOKEN environment variable`
- Tests fail to load avatar images

**Automatic Solution:**
- Server automatically falls back to empty blob lists when no token is found
- Tests continue to work but with no avatar images
- Server logs: `⚪ Blob API: Disabled (no token - using fallback for testing)`

**To Enable Blob API in CI:**
1. **GitHub Actions**: Add `BLOB_READ_WRITE_TOKEN` to repository secrets
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `BLOB_READ_WRITE_TOKEN`
   - Value: Your Vercel Blob token
2. **Other CI platforms**: Add `BLOB_READ_WRITE_TOKEN` to environment variables
3. Server will log: `🔵 Blob API: Enabled (token found)`

### Rate Limit Errors

**Symptoms:**
- Tests timeout after 90 seconds
- Server logs show "BlobServiceRateLimited" errors
- Tests fail inconsistently

**Solutions:**
1. **Reduce workers**: Set `workers: 1` in config
2. **Use conservative mode**: `npm run e2e:conservative`
3. **Increase cache time**: Modify `CACHE_TTL` in server
4. **Wait between test runs**: Allow 1-2 minutes between runs

### Slow Test Performance

**If tests are too slow:**
1. **Increase workers**: `workers: 3` or `workers: 4`
2. **Decrease cache time**: Lower `CACHE_TTL` for faster data updates
3. **Run specific tests**: Target only the tests you need

**Monitor rate limits**: Watch server logs for rate limit warnings

### Test Environment Issues

**Server not starting:**
```bash
# Ensure server is running before tests
npm start
# Then in another terminal:
cd e2e && npx playwright test
```

**Stale client build:**
```bash
# Force rebuild client
npm run build:client
npm run e2e
```

## Best Practices

### For Development

1. **Start with conservative settings** when debugging
2. **Monitor server logs** for rate limit warnings
3. **Run targeted tests** instead of full suite during development
4. **Use headed mode** for debugging: `npm run e2e:headed`

### For CI/CD

1. **Automatic conservative mode**: CI automatically uses `workers: 1` and longer timeouts
2. **Enable retries**: Already configured for CI (`retries: 2`)
3. **Extended timeouts**: 2-minute test timeout, 90s action timeout in CI
4. **Environment detection**: Uses `process.env.CI` to detect CI environments

**CI Settings Applied Automatically:**
- `workers: 1` (vs 2 locally)
- `timeout: 120_000` (vs 90_000 locally) 
- `actionTimeout: 90_000` (vs 60_000 locally)
- `retries: 2` (vs 0 locally)

**GitHub Actions Configuration:**
The `.github/workflows/ci.yml` includes:
```yaml
- name: Run Playwright tests
  run: npm run e2e --prefix e2e
  env:
    BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
```

### Configuration Templates

**High-speed (local development):**
```typescript
workers: 4,
timeout: 60_000,
// Monitor for rate limits
```

**Balanced (default):**
```typescript
workers: 2,
timeout: 90_000,
// Current recommended settings
```

**Conservative (automatically applied in CI):**
```typescript
workers: 1,
timeout: 120_000,
actionTimeout: 90_000,
// Maximum reliability - applied automatically in CI environments
```

## File Structure

```
e2e/
├── README.md                    # This file
├── playwright.config.ts         # Main config (2 workers)
├── playwright.config.test.ts    # Conservative config (1 worker)
├── package.json                 # Scripts and dependencies
├── app.spec.ts                  # Main application tests
└── lightbox-animations.spec.ts  # Animation-specific tests
```

## Monitoring Performance

### Key Metrics

- **Test duration**: Should complete in 2-5 minutes
- **Rate limit frequency**: Check server logs
- **Test stability**: Consistent pass/fail results

### Warning Signs

- Tests taking >10 minutes
- Frequent "BlobServiceRateLimited" errors
- Inconsistent test results between runs

When these occur, reduce workers or increase cache time.

---

## Quick Reference

| Issue | Solution |
|-------|----------|
| Missing blob token | Automatic fallback (no action needed) |
| Rate limit errors | Reduce `workers` to 1 |
| Tests too slow | Increase `workers` to 3-4 |
| Timeouts | Increase `timeout` values |
| Stale data | Decrease `CACHE_TTL` |
| CI failures | Conservative config auto-applied |

For questions or issues, check server logs and adjust worker/cache settings accordingly.
