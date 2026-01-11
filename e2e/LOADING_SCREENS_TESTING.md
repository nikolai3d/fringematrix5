# Loading Screens Testing Guide

This document explains how to test the three loading screen variants.

## Prerequisites

Before running the tests, ensure Playwright browsers are installed:

```bash
npx playwright install --with-deps
```

## Overview

The Fringe Matrix Gallery has three configurable loading screens:

1. **Terminal** (default) - Terminal-style boot sequence with typing animation
2. **Legacy** - Simple "Fringe Matrix 5 Loading..." message
3. **Glyphs** - Fringe glyphs rotating on black background

The loading screen is determined at build time via the `VITE_LOADING_SCREEN` environment variable.

## Quick Test

To test the default (terminal) loading screen:

```bash
npm run test:e2e -- loading-screens.spec.ts
```

## Test All Variants

To test all three loading screen variants sequentially:

```bash
npm run test:e2e:loading-screens
```

This will:
1. Build with each loading screen variant
2. Run the appropriate tests
3. Restore your original build when done

## Test Individual Variants

### Terminal Loading Screen (Default)

```bash
# Build with terminal loading screen
VITE_LOADING_SCREEN=terminal npm run build:client

# Run terminal tests
npm run test:e2e -- loading-screens.spec.ts --grep "Terminal"
```

### Legacy Loading Screen

```bash
# Build with legacy loading screen
VITE_LOADING_SCREEN=legacy npm run build:client

# Run legacy tests (remove skip)
npm run test:e2e -- loading-screens.spec.ts --grep "Legacy" --grep-invert "skip"
```

### Glyphs Loading Screen

```bash
# Build with glyphs loading screen
VITE_LOADING_SCREEN=glyphs npm run build:client

# Run glyphs tests (remove skip)
npm run test:e2e -- loading-screens.spec.ts --grep "Glyphs" --grep-invert "skip"
```

## Test Structure

The test file `loading-screens.spec.ts` contains:

### Terminal Loading Screen Tests
- ✅ Verifies terminal UI elements (header, status, scanlines)
- ✅ Tests typing animation
- ✅ Tests skip functionality (click and keyboard)
- ✅ Always runs (not skipped)

### Legacy Loading Screen Tests
- ✅ Verifies legacy loading text
- ✅ Tests skip functionality
- ⚠️ Skipped by default (requires legacy build)

### Glyphs Loading Screen Tests
- ✅ Verifies glyphs spinner elements
- ✅ Tests skip functionality
- ⚠️ Skipped by default (requires glyphs build)

### Configuration Tests
- ✅ Verifies loading completes successfully
- ✅ Tests app functionality after loading

## What Each Test Checks

### Terminal Loading Screen
- `.loading-terminal` element is visible
- Terminal header shows "FRINGE DIVISION"
- Terminal status shows "CONNECTED"
- Scanlines effect is present
- Terminal lines and cursor are visible
- Skip hint appears when data is ready
- Can skip with click or Enter key

### Legacy Loading Screen
- `.legacy-loading-content` element is visible
- Loading text contains "Fringe Matrix 5 Loading"
- Animated dots are present
- Skip hint appears when data is ready
- Terminal elements are NOT present

### Glyphs Loading Screen
- `.glyphs-loading-container` element is visible
- Glyphs spinner wrapper is present
- Skip hint appears when data is ready
- Terminal and legacy elements are NOT present

## CI/CD Testing

For CI/CD pipelines, you can set the environment variable before the build step:

```yaml
# Example GitHub Actions workflow
- name: Build with specific loading screen
  run: VITE_LOADING_SCREEN=terminal npm run build

- name: Run e2e tests
  run: npm run test:e2e
```

## Manual Testing

To manually verify loading screens in the browser:

1. Build with desired variant:
   ```bash
   VITE_LOADING_SCREEN=legacy npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open browser to `http://localhost:3000`

4. Observe the loading screen (may need to throttle network in DevTools to see it longer)

## Troubleshooting

### Tests fail with "element not found"
- The loading screen may have already completed (fast connection)
- Tests handle this gracefully by checking if loader is visible first

### Wrong loading screen shows
- Make sure you rebuilt the client after changing `VITE_LOADING_SCREEN`
- Clear browser cache and hard refresh

### Skip functionality doesn't work
- Wait for the skip hint to appear (requires data to be loaded first)
- Check that keyboard events are properly captured

## Performance Considerations

Loading screens are designed to:
- Show immediately while data loads
- Allow skipping once data is ready
- Auto-complete within reasonable time
- Not block app functionality

All tests verify these behaviors across all variants.
