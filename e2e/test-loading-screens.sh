#!/bin/bash
# Script to test all loading screen variants
# Usage: ./e2e/test-loading-screens.sh

set -e  # Exit on error

echo "======================================"
echo "Testing Loading Screen Variants"
echo "======================================"
echo ""

# Save original build if it exists
if [ -d "client/dist" ]; then
  echo "📦 Backing up current build..."
  mv client/dist client/dist.backup
fi

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  if [ -d "client/dist.backup" ]; then
    rm -rf client/dist
    mv client/dist.backup client/dist
    echo "✅ Restored original build"
  fi
}

# Set up trap to ensure cleanup runs
trap cleanup EXIT

# Test Terminal Loading Screen (default)
echo "======================================"
echo "1/3 Testing Terminal Loading Screen"
echo "======================================"
VITE_LOADING_SCREEN=terminal npm run build:client
npm run test:e2e -- loading-screens.spec.ts --grep "Terminal"
echo "✅ Terminal loading screen tests passed"
echo ""

# Test Legacy Loading Screen
echo "======================================"
echo "2/3 Testing Legacy Loading Screen"
echo "======================================"
VITE_LOADING_SCREEN=legacy npm run build:client
npm run test:e2e -- loading-screens.spec.ts --grep "Legacy" --grep-invert "skip"
echo "✅ Legacy loading screen tests passed"
echo ""

# Test Glyphs Loading Screen
echo "======================================"
echo "3/3 Testing Glyphs Loading Screen"
echo "======================================"
VITE_LOADING_SCREEN=glyphs npm run build:client
npm run test:e2e -- loading-screens.spec.ts --grep "Glyphs" --grep-invert "skip"
echo "✅ Glyphs loading screen tests passed"
echo ""

echo "======================================"
echo "✨ All loading screen tests passed!"
echo "======================================"
